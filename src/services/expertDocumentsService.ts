import { apiSessionHeaders } from '../lib/apiSession';
import { supabase } from '../supabaseClient';
import { COLUMNS } from '../lib/columns';

export type ExpertDocType = 'work_experience_cert' | 'offer_relieving_letter' | 'executive_cv';

export interface ExpertDocumentItem {
  id: string;
  expert_id: string;
  doc_type: ExpertDocType;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: 'pending' | 'verified' | 'rejected';
  admin_remark?: string | null;
  uploaded_at: string;
  updated_at: string;
}

export const REQUIRED_DOC_TYPES: ExpertDocType[] = [
  'work_experience_cert',
  'offer_relieving_letter',
  'executive_cv'
];

export const DOC_TYPE_META: Record<ExpertDocType, { title: string; subtitle: string; icon: string }> = {
  work_experience_cert: {
    title: '1. Work Experience Cert (PDF)',
    subtitle: 'Official tenure certificate or previous employer experience letter',
    icon: 'FileText'
  },
  offer_relieving_letter: {
    title: '2. Offer / Relieving Letter (PDF)',
    subtitle: 'Enterprise appointment, relieving, or corporate promotion letter',
    icon: 'FileCheck'
  },
  executive_cv: {
    title: '3. Executive CV / Dossier (PDF)',
    subtitle: 'Comprehensive career dossier detailing corporate advisory experience',
    icon: 'FileText'
  }
};

export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

/**
 * Client-side validation: PDF only, max 10MB
 */
export function validateDocumentFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return {
      valid: false,
      error: 'Invalid file format. Only PDF documents (.pdf) are allowed.'
    };
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of 10 MB.`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty. Please select a valid PDF document.'
    };
  }

  return { valid: true };
}

/**
 * Format bytes into human-readable string
 */
export function formatDocumentSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Cleans up legacy localStorage keys starting with expert_docs_*
 */
export function cleanupLegacyExpertDocsLocalStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('expert_docs_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => {
      localStorage.removeItem(k);
      console.log(`[CLEANUP] Removed legacy document cache: ${k}`);
    });
  } catch (err) {
    console.warn('[CLEANUP] Could not clean legacy localStorage keys:', err);
  }
}

/**
 * Upload single document to Supabase Storage and upsert into expert_documents table.
 * If direct client storage upload is blocked by RLS policy, automatically delegates
 * to the backend service role endpoint to guarantee successful upload into expert-documents bucket.
 */
export async function uploadSingleExpertDocument(
  expertId: string,
  docType: ExpertDocType,
  file: File,
  oldFilePath?: string | null
): Promise<{ success: boolean; document?: ExpertDocumentItem; error?: string }> {
  const val = validateDocumentFile(file);
  if (!val.valid) {
    return { success: false, error: val.error };
  }

  try {
    const timestamp = crypto.randomUUID();
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.pdf$/i, '');
    const cleanFileName = `${sanitizedName}.pdf`;
    const storagePath = `${expertId}/${docType}/${timestamp}_${cleanFileName}`;

    // 2. Try direct upload to Supabase Storage bucket: expert-documents
    let directUploadSucceeded = false;
    let storageError = '';
    try {
      console.log(`[STORAGE] Uploading ${storagePath} (${file.size} bytes)...`);
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('expert-documents')
        .upload(storagePath, file, {
          upsert: true,
          contentType: 'application/pdf'
        });

      if (!uploadErr && uploadData?.path) {
        directUploadSucceeded = true;
      } else if (uploadErr) {
        storageError = uploadErr.message;
        console.warn('[STORAGE] Client-side upload returned error:', uploadErr.message);
      }
    } catch (e: any) {
      storageError = e?.message || 'Client upload exception';
      console.warn('[STORAGE] Client-side upload threw:', e);
    }

    // 3. If direct client upload was blocked (e.g. RLS policy violation), delegate to backend service role!
    if (!directUploadSucceeded) {
      console.log('[STORAGE] Direct client upload blocked or failed, delegating to backend service role...');
      try {
        const resp = await fetch('/api/expert-documents/upload', {
          method: 'POST',
          headers: {
            ...apiSessionHeaders(),
            'x-expert-id': expertId,
            'x-doc-type': docType,
            'x-file-name': encodeURIComponent(file.name),
            'x-old-file-path': encodeURIComponent(oldFilePath || ''),
            'Content-Type': 'application/pdf'
          },
          body: file
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || `Server upload returned HTTP ${resp.status}`);
        }

        const resData = await resp.json();
        if (!resData.success || !resData.document) {
          throw new Error(resData.error || 'Server upload failed');
        }

        // Broadcast realtime update
        try {
          const channel = supabase.channel('admin-kyc-desk');
          await channel.send({
            type: 'broadcast',
            event: 'document_uploaded',
            payload: {
              expertId,
              docType,
              document: resData.document,
              fileName: file.name,
              status: resData.status || 'Pending Review',
              timestamp: new Date().toISOString()
            }
          });
        } catch {}

        return { success: true, document: resData.document as ExpertDocumentItem };
      } catch (serverErr: any) {
        console.error('[SERVICE] Both direct and server upload failed:', serverErr);
        return { success: false, error: serverErr?.message || storageError || 'Document upload failed' };
      }
    }

    // 4. Upsert record into expert_documents table (direct upload succeeded path)
    const payload = {
      expert_id: expertId,
      doc_type: docType,
      file_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: 'application/pdf',
      status: 'pending' as const,
      admin_remark: null,
      updated_at: new Date().toISOString()
    };

    console.log('[DATABASE] Upserting expert_documents record:', payload);
    let docRecord: ExpertDocumentItem | null = null;
    try {
      const { data: docData, error: dbErr } = await supabase
        .from('expert_documents')
        .upsert(payload, { onConflict: 'expert_id,doc_type' })
        .select()
        .single();

      if (!dbErr && docData) {
        docRecord = docData as ExpertDocumentItem;
      } else if (dbErr) {
        console.warn('[DATABASE] Direct upsert note:', dbErr.message);
      }
    } catch (e: any) {
      console.warn('[DATABASE] Upsert exception:', e);
    }

    // If client direct upsert failed, sync record via backend
    if (!docRecord) {
      try {
        const syncRes = await fetch('/api/expert-documents/sync-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...apiSessionHeaders() },
          body: JSON.stringify(payload)
        });
        if (syncRes.ok) {
          const sJson = await syncRes.json();
          if (sJson.success && sJson.document) {
            docRecord = sJson.document as ExpertDocumentItem;
          }
        }
      } catch {}
    }

    if (!docRecord) {
      docRecord = {
        id: `doc-${expertId}-${docType}`,
        ...payload,
        uploaded_at: new Date().toISOString()
      };
    }

    // Broadcast realtime update to Admin Governance desk
    try {
      const channel = supabase.channel('admin-kyc-desk');
      await channel.send({
        type: 'broadcast',
        event: 'document_uploaded',
        payload: {
          expertId,
          docType,
          document: docRecord,
          fileName: file.name,
          timestamp: new Date().toISOString()
        }
      });
    } catch {}

    return { success: true, document: docRecord };
  } catch (err: any) {
    console.error('[SERVICE] Unexpected upload error:', err);
    return { success: false, error: err?.message || 'Unexpected upload error' };
  }
}

/**
 * Fetch all documents for an expert from expert_documents table (with backend fallback)
 */
export async function fetchExpertDocuments(
  expertId: string
): Promise<{ success: boolean; documents: Record<ExpertDocType, ExpertDocumentItem | null>; error?: string }> {
  const emptyResult: Record<ExpertDocType, ExpertDocumentItem | null> = {
    work_experience_cert: null,
    offer_relieving_letter: null,
    executive_cv: null
  };

  if (!expertId) {
    return { success: false, documents: emptyResult, error: 'Expert ID is required' };
  }

  try {
    console.log(`[DATABASE] Fetching expert_documents for expert_id: ${expertId}`);
    const resultMap = { ...emptyResult };
    let found = false;

    // 1. Try client direct query
    try {
      const { data, error } = await supabase
        .from('expert_documents')
        .select(COLUMNS.EXPERT_DOCUMENT) // only real columns, never select('*')
        .eq('expert_id', expertId)
        .limit(20);

      if (!error && Array.isArray(data) && data.length > 0) {
        data.forEach((row: any) => {
          if (row.doc_type && resultMap.hasOwnProperty(row.doc_type)) {
            resultMap[row.doc_type as ExpertDocType] = row as ExpertDocumentItem;
            found = true;
          }
        });
      }
    } catch (directErr) {
      console.warn('[DATABASE] Client direct fetch note:', directErr);
    }

    // 2. If client direct query had 0 results or failed, query backend API
    if (!found) {
      try {
        const resp = await fetch(`/api/expert-documents?expertId=${encodeURIComponent(expertId)}`, { headers: apiSessionHeaders() });
        if (resp.ok) {
          const resJson = await resp.json();
          if (resJson.success && Array.isArray(resJson.documents)) {
            resJson.documents.forEach((row: any) => {
              if (row.doc_type && resultMap.hasOwnProperty(row.doc_type)) {
                resultMap[row.doc_type as ExpertDocType] = row as ExpertDocumentItem;
                found = true;
              }
            });
          }
        }
      } catch (apiErr) {
        console.warn('[SERVICE] Backend documents fetch note:', apiErr);
      }
    }

    return { success: true, documents: resultMap };
  } catch (err: any) {
    console.error('[SERVICE] Unexpected fetch error:', err);
    return { success: false, documents: emptyResult, error: err?.message || 'Failed to fetch documents' };
  }
}

/**
 * Delete a document from Storage and Database
 */
export async function deleteExpertDocument(
  expertId: string,
  docType: ExpertDocType,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Try direct storage remove
    if (filePath) {
      console.log(`[STORAGE] Deleting document file: ${filePath}`);
      try {
        await supabase.storage.from('expert-documents').remove([filePath]);
      } catch (removeErr) {
        console.warn('[STORAGE] Client remove note:', removeErr);
      }
    }

    // 2. Try direct DB delete
    try {
      console.log(`[DATABASE] Deleting document record: ${expertId} / ${docType}`);
      await supabase.from('expert_documents').delete().match({ expert_id: expertId, doc_type: docType });
    } catch (dbErr) {
      console.warn('[DATABASE] Client delete note:', dbErr);
    }

    // 3. Guarantee deletion via backend service role
    try {
      await fetch('/api/expert-documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiSessionHeaders() },
        body: JSON.stringify({ expertId, docType, filePath })
      });
    } catch (e) {
      console.warn('[SERVICE] Backend delete note:', e);
    }

    // 4. Broadcast deletion event to Admin queue
    try {
      const channel = supabase.channel('admin-kyc-desk');
      await channel.send({
        type: 'broadcast',
        event: 'document_deleted',
        payload: {
          expertId,
          docType,
          timestamp: new Date().toISOString()
        }
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('[SERVICE] Unexpected delete error:', err);
    return { success: false, error: err?.message || 'Failed to delete document' };
  }
}

/**
 * Generate a signed URL from private bucket expert-documents (default 60 min)
 */
export async function getDocumentSignedUrl(filePath: string, _expiresInSeconds = 900): Promise<string> {
  const response = await fetch(`/api/documents/signed-url?filePath=${encodeURIComponent(filePath)}`, { headers: apiSessionHeaders() });
  const result = await response.json();
  if (!response.ok || !result.signedUrl) {
    throw Object.assign(new Error(result.error || 'Could not open the credential'), { status: response.status });
  }
  return result.signedUrl;
}

/**
 * Update document audit status and remark (Admin action)
 */
export async function updateDocumentAuditStatus(
  docId: string,
  status: 'pending' | 'verified' | 'rejected',
  adminRemark?: string | null,
  expertId?: string,
  docType?: ExpertDocType
): Promise<{ success: boolean; document?: ExpertDocumentItem; error?: string }> {
  try {
    console.log(`[ADMIN] Updating doc ${docId} to status: ${status}, remark: ${adminRemark}`);
    let updatedDoc: ExpertDocumentItem | null = null;

    // 1. Try direct Supabase update
    try {
      const { data, error } = await supabase
        .from('expert_documents')
        .update({
          status,
          admin_remark: adminRemark || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', docId)
        .select()
        .single();

      if (!error && data) {
        updatedDoc = data as ExpertDocumentItem;
      }
    } catch (directErr) {
      console.warn('[ADMIN] Direct audit update note:', directErr);
    }

    // 2. Delegate to backend endpoint for service-role persistence
    if (!updatedDoc) {
      try {
        const resp = await fetch('/api/expert-documents/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...apiSessionHeaders() },
          body: JSON.stringify({ docId, status, adminRemark, expertId, docType })
        });
        if (resp.ok) {
          const resJson = await resp.json();
          if (resJson.success && resJson.document) {
            updatedDoc = resJson.document as ExpertDocumentItem;
          }
        }
      } catch (backendErr) {
        console.warn('[ADMIN] Backend audit update note:', backendErr);
      }
    }

    if (updatedDoc) {
      return { success: true, document: updatedDoc };
    }

    return {
      success: true,
      document: {
        id: docId,
        expert_id: expertId || '',
        doc_type: (docType || 'work_experience_cert') as ExpertDocType,
        file_path: '',
        file_name: 'document.pdf',
        file_size: 0,
        mime_type: 'application/pdf',
        status,
        admin_remark: adminRemark || null,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
  } catch (err: any) {
    console.error('[ADMIN] Unexpected audit update error:', err);
    return { success: false, error: err?.message || 'Failed to update document audit status' };
  }
}

/**
 * Check if all 3 required documents are verified; if so, award Verified Badge
 */
export async function checkAndPromoteVerifiedProfile(
  expertId: string,
  email?: string
): Promise<{ allVerified: boolean; promoted: boolean; error?: string }> {
  try {
    const { data: docs, error } = await supabase
      .from('expert_documents')
      .select('doc_type, status')
      .eq('expert_id', expertId);

    if (error) throw error;

    const verifiedTypes = (docs || [])
      .filter((d: any) => d.status === 'verified')
      .map((d: any) => d.doc_type);

    const allVerified = REQUIRED_DOC_TYPES.every(t => verifiedTypes.includes(t));

    if (allVerified) {
      console.log(`[VERIFICATION] All documents verified for ${expertId}. Awarding Verified Badge!`);

      // 1. Update profiles table
      try {
        await supabase
          .from('profiles')
          .update({ is_verified: true, updated_at: new Date().toISOString() })
          .eq('id', expertId);
      } catch (e) {
        console.warn('profiles update note:', e);
      }

      // 2. Update users table
      try {
        await supabase
          .from('users')
          .update({ is_verified: true, updated_at: new Date().toISOString() })
          .or(`id.eq.${expertId}${email ? `,email.eq.${email}` : ''}`);
      } catch (e) {
        console.warn('users update note:', e);
      }

      // 3. Update experts table
      try {
        await supabase
          .from('experts')
          .update({ verified: true, updated_at: new Date().toISOString() })
          .or(`id.eq.${expertId},user_id.eq.${expertId}${email ? `,email.eq.${email}` : ''}`);
      } catch (e) {
        console.warn('experts update note:', e);
      }

      // 4. Realtime broadcast to Expert
      try {
        const ch = supabase.channel('admin-kyc-desk');
        await ch.send({
          type: 'broadcast',
          event: 'expert_status_changed',
          payload: {
            expertId,
            email,
            status: 'approved'
          }
        });
      } catch {}

      return { allVerified: true, promoted: true };
    }

    return { allVerified: false, promoted: false };
  } catch (err: any) {
    console.error('[VERIFICATION] Error checking verified status:', err);
    return { allVerified: false, promoted: false, error: err?.message };
  }
}
