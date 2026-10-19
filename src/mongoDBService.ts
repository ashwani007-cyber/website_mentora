/**
 * MongoDB Data Schema & Local/Atlas Service Layer
 * Supports MongoDB Atlas Connection String (mongodb+srv://...)
 * and provides persistent Collections for Users, Experts, Documents, Bookings & Transactions.
 */

export interface ExpertDoc {
  id: string;
  name: string;
  field: string;
  years: number;
  baseRate: number; // Expert demands
  adminMarkup: number; // Platform profit margin
  rate: number; // Client listed price = baseRate + adminMarkup
  rating: number;
  sessions: number;
  verified: boolean;
  verificationStatus?: string;
  rejected?: boolean;
  initials: string;
  title: string;
  phone: string;
  email: string;
  bio: string;
  company?: string;
  skills: string[];
  experience: { role: string; company: string; period: string }[];
  education: string;
  projectRate?: number; // Single authoritative active Project Review price (₹0 - ₹2,000)
  img?: string; // Custom profile photo URL
  featuredOnLanding?: boolean; // Controlled by Admin for Spotlight Grid
  heroSpotlight?: boolean; // Controlled by Admin for Hero 3D Floating Cards
  heroPosition?: "top" | "bottom" | "extra"; // Card 1 (Top-Right) vs Card 2 (Bottom-Left)
  documents?: {
    expCert?: string;
    offerLetter?: string;
    resume?: string;
    submittedDate?: string;
    status?: string;
    items?: Record<string, ExpertDocumentItem>;
    updatedAt?: string;
  };
}

export interface ExpertDocumentItem {
  id: string;
  type: "expCert" | "offerLetter" | "resume";
  title: string;
  fileName: string;
  fileSize?: string;
  fileData?: string; // Data URL or base64
  uploadedAt: string;
  updatedAt?: string;
  expertId: string;
  expertName: string;
  expertEmail: string;
  status: "Pending Audit" | "Verified" | "Rejected";
}

export interface ExpertDocumentsRecord {
  expertId: string;
  expertName: string;
  expertEmail: string;
  updatedAt: string;
  status: "Pending Audit" | "Verified" | "Rejected";
  docs: {
    expCert?: ExpertDocumentItem;
    offerLetter?: ExpertDocumentItem;
    resume?: ExpertDocumentItem;
  };
}

import { generateOfficialDocPdf } from "./utils/pdfGenerator";
import { ProjectReviewRecord, BlogArticleRecord, BlogCategoryRecord, BlogCMSStats } from "./types";


// IndexedDB storage for document files (PDFs)
const IDB_NAME = "RegistryDocStore_v2";
const IDB_STORE = "documents";
let cachedIDB: IDBDatabase | null = null;

function openDocDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (cachedIDB) {
    try {
      if (cachedIDB.objectStoreNames.contains(IDB_STORE)) {
        return Promise.resolve(cachedIDB);
      }
    } catch {}
    cachedIDB = null;
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.close();
          const upReq = window.indexedDB.open(IDB_NAME, (db.version || 1) + 1);
          upReq.onupgradeneeded = () => {
            const upDb = upReq.result;
            if (!upDb.objectStoreNames.contains(IDB_STORE)) {
              upDb.createObjectStore(IDB_STORE, { keyPath: "id" });
            }
          };
          upReq.onsuccess = () => {
            cachedIDB = upReq.result;
            resolve(cachedIDB);
          };
          upReq.onerror = () => resolve(null);
          return;
        }
        cachedIDB = db;
        resolve(db);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function storeDocFile(
  id: string,
  fileData: string,
  meta?: { fileName?: string; expertId?: string; expertName?: string; expertEmail?: string; type?: string }
): Promise<void> {
  if (!id || !fileData) return;

  // 1. In-memory cache
  if (typeof window !== "undefined") {
    (window as any).__docDataCache = (window as any).__docDataCache || {};
    (window as any).__docDataCache[id] = fileData;
    if (meta?.fileName) {
      const fn = meta.fileName.toLowerCase().trim();
      (window as any).__docDataCache[`file-${fn}`] = fileData;
      (window as any).__docDataCache[meta.fileName] = fileData;
      (window as any).__docDataCache[fn] = fileData;
    }
    if (meta?.expertName && meta?.type) {
      (window as any).__docDataCache[`doc-${meta.expertName.toLowerCase().trim()}-${meta.type}`] = fileData;
    }
    if (meta?.expertEmail && meta?.type) {
      (window as any).__docDataCache[`doc-${meta.expertEmail.toLowerCase().trim()}-${meta.type}`] = fileData;
    }
    if (meta?.expertId && meta?.type) {
      (window as any).__docDataCache[`doc-${meta.expertId.toLowerCase().trim()}-${meta.type}`] = fileData;
    }
  }

  // 2. Dedicated synchronous localStorage and sessionStorage keys
  if (typeof window !== "undefined") {
    try {
      if (meta?.fileName) {
        const fn = meta.fileName.toLowerCase().trim();
        safeSetItem(`doc_bin_${fn}`, fileData);
        try { sessionStorage.setItem(`doc_bin_${fn}`, fileData); } catch {}
      }
      safeSetItem(`doc_bin_${id}`, fileData);
      try { sessionStorage.setItem(`doc_bin_${id}`, fileData); } catch {}
      if (meta?.expertId && meta?.type) {
        safeSetItem(`doc_bin_${meta.expertId}_${meta.type}`, fileData);
      }
      if (meta?.expertName && meta?.type) {
        safeSetItem(`doc_bin_${meta.expertName.toLowerCase().trim()}_${meta.type}`, fileData);
      }
      if (meta?.expertEmail && meta?.type) {
        safeSetItem(`doc_bin_${meta.expertEmail.toLowerCase().trim()}_${meta.type}`, fileData);
      }
    } catch {}
  }

  // 3. IndexedDB
  try {
    const db = await openDocDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, "readwrite");
          const store = tx.objectStore(IDB_STORE);
          store.put({
            id,
            fileData,
            fileName: meta?.fileName,
            expertId: meta?.expertId,
            expertName: meta?.expertName,
            expertEmail: meta?.expertEmail,
            type: meta?.type,
            updatedAt: Date.now()
          });
          if (meta?.fileName) {
            store.put({
              id: `file-${meta.fileName.toLowerCase().trim()}`,
              fileData,
              fileName: meta?.fileName,
              expertId: meta?.expertId,
              expertName: meta?.expertName,
              expertEmail: meta?.expertEmail,
              type: meta?.type,
              updatedAt: Date.now()
            });
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {}

  // 4. Server API upload so files persist across all sessions, tabs, and origins permanently
  if (typeof window !== "undefined") {
    try {
      fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          fileName: meta?.fileName,
          fileData,
          expertId: meta?.expertId,
          expertName: meta?.expertName,
          expertEmail: meta?.expertEmail,
          type: meta?.type
        })
      }).catch(() => {});
    } catch {}
  }
}

export async function getDocFile(id: string, docMeta?: Partial<ExpertDocumentItem>): Promise<string | null> {
  const cleanFileName = docMeta?.fileName ? docMeta.fileName.toLowerCase().trim() : "";
  const cleanExpName = docMeta?.expertName ? docMeta.expertName.toLowerCase().trim() : "";
  const cleanExpEmail = docMeta?.expertEmail ? docMeta.expertEmail.toLowerCase().trim() : "";
  const cleanExpId = docMeta?.expertId ? docMeta.expertId.toLowerCase().trim() : "";
  const slotType = docMeta?.type;

  // 1. In-memory cache checks
  if (typeof window !== "undefined") {
    const cache = (window as any).__docDataCache;
    if (cache) {
      if (id && cache[id] && typeof cache[id] === "string" && (cache[id].startsWith("data:") || cache[id].startsWith("/uploaded_docs/"))) return cache[id];
      if (cleanFileName && cache[`file-${cleanFileName}`] && typeof cache[`file-${cleanFileName}`] === "string") {
        return cache[`file-${cleanFileName}`];
      }
      if (cleanFileName && cache[cleanFileName] && typeof cache[cleanFileName] === "string") {
        return cache[cleanFileName];
      }
      if (docMeta?.fileName && cache[docMeta.fileName] && typeof cache[docMeta.fileName] === "string") {
        return cache[docMeta.fileName];
      }
      if (cleanExpName && slotType && cache[`doc-${cleanExpName}-${slotType}`]) return cache[`doc-${cleanExpName}-${slotType}`];
      if (cleanExpEmail && slotType && cache[`doc-${cleanExpEmail}-${slotType}`]) return cache[`doc-${cleanExpEmail}-${slotType}`];
      if (cleanExpId && slotType && cache[`doc-${cleanExpId}-${slotType}`]) return cache[`doc-${cleanExpId}-${slotType}`];
    }
  }

  // 2. Check Server Storage via /api/documents or static /uploaded_docs/
  if (typeof window !== "undefined") {
    try {
      const fn = docMeta?.fileName || cleanFileName;
      if (fn) {
        const res = await fetch(`/api/documents?key=${encodeURIComponent(fn)}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.url) {
            const cache = (window as any).__docDataCache = (window as any).__docDataCache || {};
            cache[id || fn] = json.url;
            return json.url;
          }
          if (json?.fileData && typeof json.fileData === "string" && json.fileData.startsWith("data:")) {
            let data = json.fileData;
            if (fn.toLowerCase().endsWith(".png") && data.startsWith("data:application/pdf;")) {
              data = data.replace("data:application/pdf;", "data:image/png;");
            } else if ((fn.toLowerCase().endsWith(".jpg") || fn.toLowerCase().endsWith(".jpeg")) && data.startsWith("data:application/pdf;")) {
              data = data.replace("data:application/pdf;", "data:image/jpeg;");
            }
            const cache = (window as any).__docDataCache = (window as any).__docDataCache || {};
            cache[id || fn] = data;
            return data;
          }
        }
      }
      if (id) {
        const res = await fetch(`/api/documents?key=${encodeURIComponent(id)}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.url) {
            const cache = (window as any).__docDataCache = (window as any).__docDataCache || {};
            cache[id] = json.url;
            return json.url;
          }
          if (json?.fileData && typeof json.fileData === "string" && json.fileData.startsWith("data:")) {
            let data = json.fileData;
            const targetFn = docMeta?.fileName || cleanFileName;
            if (targetFn?.toLowerCase().endsWith(".png") && data.startsWith("data:application/pdf;")) {
              data = data.replace("data:application/pdf;", "data:image/png;");
            } else if ((targetFn?.toLowerCase().endsWith(".jpg") || targetFn?.toLowerCase().endsWith(".jpeg")) && data.startsWith("data:application/pdf;")) {
              data = data.replace("data:application/pdf;", "data:image/jpeg;");
            }
            const cache = (window as any).__docDataCache = (window as any).__docDataCache || {};
            cache[id] = data;
            return data;
          }
        }
      }
    } catch {}
  }

  // 3. Direct dedicated binary keys in localStorage & sessionStorage
  if (typeof window !== "undefined") {
    const tryStorage = (storage: Storage): string | null => {
      try {
        if (cleanFileName) {
          const v = storage.getItem(`doc_bin_${cleanFileName}`);
          if (v && (v.startsWith("data:") || v.startsWith("/uploaded_docs/"))) return v;
        }
        if (id) {
          const v = storage.getItem(`doc_bin_${id}`);
          if (v && (v.startsWith("data:") || v.startsWith("/uploaded_docs/"))) return v;
        }
        if (cleanExpId && slotType) {
          const v = storage.getItem(`doc_bin_${cleanExpId}_${slotType}`);
          if (v && (v.startsWith("data:") || v.startsWith("/uploaded_docs/"))) return v;
        }
        if (cleanExpName && slotType) {
          const v = storage.getItem(`doc_bin_${cleanExpName}_${slotType}`);
          if (v && (v.startsWith("data:") || v.startsWith("/uploaded_docs/"))) return v;
        }
        if (cleanExpEmail && slotType) {
          const v = storage.getItem(`doc_bin_${cleanExpEmail}_${slotType}`);
          if (v && (v.startsWith("data:") || v.startsWith("/uploaded_docs/"))) return v;
        }
      } catch {}
      return null;
    };

    const fromLocal = tryStorage(localStorage);
    if (fromLocal) return fromLocal;
    const fromSession = tryStorage(sessionStorage);
    if (fromSession) return fromSession;
  }

  // 3. Check current_logged_in_expert and admin_logged_in_expert
  if (typeof window !== "undefined") {
    try {
      for (const k of ["current_logged_in_expert", "admin_logged_in_expert"]) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          const items = parsed?.documents?.items;
          if (items) {
            for (const itemKey of Object.keys(items)) {
              const item = items[itemKey];
              if (item?.fileData && typeof item.fileData === "string" && item.fileData.startsWith("data:")) {
                if (cleanFileName && item.fileName && item.fileName.toLowerCase().trim() === cleanFileName) {
                  return item.fileData;
                }
                if (slotType && (item.type === slotType || itemKey === slotType)) {
                  if (!cleanExpName || !parsed.name || parsed.name.toLowerCase().trim() === cleanExpName) {
                    return item.fileData;
                  }
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  // 4. Check mongo_expert_documents
  if (typeof window !== "undefined") {
    try {
      const rawDocs = localStorage.getItem("mongo_expert_documents");
      if (rawDocs) {
        const records: Record<string, ExpertDocumentsRecord> = JSON.parse(rawDocs);
        for (const rec of Object.values(records)) {
          if (!rec?.docs) continue;
          for (const itemKey of Object.keys(rec.docs)) {
            const item = (rec.docs as any)[itemKey];
            if (item?.fileData && typeof item.fileData === "string" && item.fileData.startsWith("data:")) {
              if (cleanFileName && item.fileName && item.fileName.toLowerCase().trim() === cleanFileName) {
                return item.fileData;
              }
              const matchesOwner = (cleanExpId && rec.expertId?.toLowerCase() === cleanExpId) ||
                (cleanExpEmail && rec.expertEmail?.toLowerCase() === cleanExpEmail) ||
                (cleanExpName && rec.expertName?.toLowerCase().trim() === cleanExpName);
              if (matchesOwner && slotType && (item.type === slotType || itemKey === slotType)) {
                return item.fileData;
              }
            }
          }
        }
      }
    } catch {}
  }

  // 5. Check mongo_pending_verifications
  if (typeof window !== "undefined") {
    try {
      const pendRaw = localStorage.getItem("mongo_pending_verifications");
      if (pendRaw) {
        const pendings: any[] = JSON.parse(pendRaw);
        for (const p of pendings) {
          const items = p?.documents?.items;
          if (items) {
            for (const itemKey of Object.keys(items)) {
              const item = items[itemKey];
              if (item?.fileData && typeof item.fileData === "string" && item.fileData.startsWith("data:")) {
                if (cleanFileName && item.fileName && item.fileName.toLowerCase().trim() === cleanFileName) {
                  return item.fileData;
                }
                const matchesOwner = (cleanExpId && p.id?.toLowerCase() === cleanExpId) ||
                  (cleanExpEmail && p.email?.toLowerCase() === cleanExpEmail) ||
                  (cleanExpName && p.name?.toLowerCase().trim() === cleanExpName);
                if (matchesOwner && slotType && (item.type === slotType || itemKey === slotType)) {
                  return item.fileData;
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  // 6. Check mongo_experts
  if (typeof window !== "undefined") {
    try {
      const expRaw = localStorage.getItem("mongo_experts");
      if (expRaw) {
        const experts: any[] = JSON.parse(expRaw);
        for (const exp of experts) {
          const items = exp?.documents?.items;
          if (items) {
            for (const itemKey of Object.keys(items)) {
              const item = items[itemKey];
              if (item?.fileData && typeof item.fileData === "string" && item.fileData.startsWith("data:")) {
                if (cleanFileName && item.fileName && item.fileName.toLowerCase().trim() === cleanFileName) {
                  return item.fileData;
                }
                const matchesOwner = (cleanExpId && exp.id?.toLowerCase() === cleanExpId) ||
                  (cleanExpEmail && exp.email?.toLowerCase() === cleanExpEmail) ||
                  (cleanExpName && exp.name?.toLowerCase().trim() === cleanExpName);
                if (matchesOwner && slotType && (item.type === slotType || itemKey === slotType)) {
                  return item.fileData;
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  // 7. Exhaustive scan of localStorage keys for any key starting with doc_bin_
  if (typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("doc_bin_")) {
          const cleanK = k.toLowerCase();
          if (cleanFileName && (cleanK.includes(cleanFileName) || cleanFileName.includes(cleanK.replace("doc_bin_", "")))) {
            const v = localStorage.getItem(k);
            if (v && v.startsWith("data:")) return v;
          }
          if (id && cleanK.includes(id.toLowerCase())) {
            const v = localStorage.getItem(k);
            if (v && v.startsWith("data:")) return v;
          }
        }
      }
    } catch {}
  }

  // 8. IndexedDB lookups (direct, aliases, store scan)
  try {
    const db = await openDocDB();
    if (db) {
      const getFromStore = (key: string): Promise<string | null> => {
        return new Promise((resolve) => {
          try {
            const tx = db.transaction(IDB_STORE, "readonly");
            const store = tx.objectStore(IDB_STORE);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result?.fileData || null);
            req.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
      };

      if (id) {
        const directFile = await getFromStore(id);
        if (directFile && directFile.startsWith("data:")) return directFile;
      }
      if (cleanFileName) {
        const fileByAlias = await getFromStore(`file-${cleanFileName}`) || await getFromStore(cleanFileName);
        if (fileByAlias && fileByAlias.startsWith("data:")) return fileByAlias;
      }

      // Scan all IndexedDB records
      const allRecords = await new Promise<any[]>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, "readonly");
          const store = tx.objectStore(IDB_STORE);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });

      if (allRecords && allRecords.length > 0) {
        if (cleanFileName) {
          const m = allRecords.find(r => 
            (r.fileName && r.fileName.toLowerCase().trim() === cleanFileName) ||
            (r.id && r.id.toLowerCase().includes(cleanFileName))
          );
          if (m?.fileData && m.fileData.startsWith("data:")) return m.fileData;
        }
        if (cleanExpName) {
          const m = allRecords.find(r => {
            const matchesName = (r.expertName && r.expertName.toLowerCase().trim() === cleanExpName) ||
                                (r.id && r.id.toLowerCase().includes(cleanExpName));
            if (!matchesName) return false;
            return !slotType || r.type === slotType || r.id.includes(slotType);
          });
          if (m?.fileData && m.fileData.startsWith("data:")) return m.fileData;
        }
      }
    }
  } catch (err) {
    console.warn("[getDocFile] IndexedDB exception:", err);
  }

  // 9. Absolute last resort: If no uploaded file exists in ANY layer, generate official template PDF
  const fallbackPdf = generateOfficialDocPdf({
    title: docMeta?.title || (id.includes("expCert") || id.endsWith("-1") ? "Work Experience & Tenure Certificate" : (id.includes("offerLetter") || id.endsWith("-2") ? "Company Relieving / Promotion Letter" : "Executive Dossier & Bio Resume")),
    fileName: docMeta?.fileName || "Official_Verification_Proof.pdf",
    expertName: docMeta?.expertName || "Senior Advisory Expert",
    expertEmail: docMeta?.expertEmail || "expert@registry.com",
    date: docMeta?.uploadedAt || new Date().toISOString().split("T")[0],
    status: docMeta?.status || "Stored in Database"
  });

  if (typeof window !== "undefined") {
    (window as any).__docDataCache = (window as any).__docDataCache || {};
    (window as any).__docDataCache[id] = fallbackPdf;
  }
  return fallbackPdf;
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[Storage] Failed to set ${key} in localStorage, attempting cleanup...`, e);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("debug_") || k.startsWith("tmp_"))) {
          localStorage.removeItem(k);
        }
      }
      localStorage.setItem(key, value);
      return true;
    } catch (err2) {
      console.error(`[Storage] Fatal localStorage setItem error for key "${key}":`, err2);
      return false;
    }
  }
}

export interface UserDoc {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone: string;
  role: "client" | "expert" | "admin";
  company?: string;
  title?: string;
  field?: string;
  bio?: string;
  initials: string;
  createdAt: string;
}

export interface BookingDoc {
  id: string;
  expert: string;
  client: string;
  topic: string;
  when: string;
  status: "Confirmed" | "Completed" | "Pending";
  rate: number;
  roomCode: string;
  createdAt: string;
}

export interface ExpertAvailabilityDoc {
  id: string;
  expertId: string;
  availabilityDate: string; // YYYY-MM-DD
  startTime: string; // e.g. "10:00 AM"
  endTime: string; // e.g. "11:00 AM"
  status: "AVAILABLE" | "BOOKED" | "DISABLED";
  bookingId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Initial Seeded MongoDB Collections with realistic executive photo URLs & Admin landing page flags
const SEED_EXPERTS: ExpertDoc[] = [
  { 
    id: "exp-1", 
    name: "Sunita Rao", 
    field: "Finance & Taxation", 
    years: 34, 
    baseRate: 600, 
    adminMarkup: 150, 
    rate: 750, 
    rating: 4.9, 
    sessions: 128, 
    verified: true, 
    initials: "SR", 
    title: "Former Chief Financial Officer (Ex-CFO)",
    phone: "+91 98765 43210",
    email: "sunita.rao@registry.com",
    img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
    featuredOnLanding: true,
    heroSpotlight: false,
    company: "Tata Capital",
    bio: "Ex-CFO with 34 years in corporate tax audits, ESOP design, valuation readiness, and M&A compliance.",
    skills: ["Corporate Tax", "ESOP Structuring", "GST Audits", "Valuation Readiness", "Fundraising Advisory"],
    experience: [
      { role: "Chief Financial Officer", company: "Tata Capital & Financial Services", period: "2012 – 2022" },
      { role: "VP Financial Operations", company: "L&T Infrastructure Finance", period: "2002 – 2012" }
    ],
    education: "FCA (ICAI) & M.Com, University of Mumbai",
    documents: {
      expCert: "Tata_Capital_Experience_34yrs.pdf",
      offerLetter: "Tata_Capital_Relieving_Offer.pdf",
      resume: "Sunita_Rao_Executive_CV.pdf",
      submittedDate: "2026-08-28",
      status: "Verified"
    }
  },
  { 
    id: "exp-2", 
    name: "Krishnan Iyer", 
    field: "HR & Talent", 
    years: 29, 
    baseRate: 500, 
    adminMarkup: 150, 
    rate: 650, 
    rating: 4.8, 
    sessions: 96, 
    verified: true, 
    initials: "KI", 
    title: "Former VP Human Resources",
    phone: "+91 98234 56789",
    email: "krishnan.iyer@registry.com",
    img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80",
    featuredOnLanding: true,
    heroSpotlight: false,
    company: "Infosys BPM",
    bio: "Ex-VP HR specializing in POSH compliance, appraisal structuring, startup team scaling, and leadership coaching.",
    skills: ["POSH Compliance", "Performance Appraisals", "CXO Recruiting", "Org Restructuring", "Culture Design"],
    experience: [
      { role: "VP Human Resources", company: "Infosys BPM", period: "2014 – 2023" },
      { role: "Head of Talent Acquisition", company: "Wipro Technologies", period: "2005 – 2014" }
    ],
    education: "MBA (HR), XLRI Jamshedpur",
    documents: {
      expCert: "Infosys_Experience_29yrs.pdf",
      offerLetter: "Infosys_Relieving_Letter.pdf",
      resume: "Krishnan_Iyer_Executive_CV.pdf",
      submittedDate: "2026-08-25",
      status: "Verified"
    }
  },
  { 
    id: "exp-3", 
    name: "Meera Chatterjee", 
    field: "Marketing Strategy", 
    years: 22, 
    baseRate: 700, 
    adminMarkup: 150, 
    rate: 850, 
    rating: 5.0, 
    sessions: 61, 
    verified: true, 
    initials: "MC", 
    title: "Senior Brand Director & Strategy Advisor",
    phone: "+91 97111 22334",
    email: "meera.c@registry.com",
    img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    featuredOnLanding: true,
    heroSpotlight: false,
    company: "Unilever",
    bio: "Crafted iconic FMCG brand campaigns. Expert in D2C storytelling, customer acquisition economics, and market expansion.",
    skills: ["Brand Strategy", "D2C Marketing", "Customer Retention", "FMCG Launch", "GTM Strategy"],
    experience: [
      { role: "Global Marketing Director", company: "Unilever South Asia", period: "2015 – 2023" },
      { role: "Senior Brand Manager", company: "P&G India", period: "2007 – 2015" }
    ],
    education: "PGDM (Marketing), IIM Ahmedabad",
    documents: {
      expCert: "Unilever_Experience_22yrs.pdf",
      offerLetter: "Unilever_Relieving_Letter.pdf",
      resume: "Meera_Chatterjee_CV.pdf",
      submittedDate: "2026-08-29",
      status: "Verified"
    }
  },
  { 
    id: "exp-4", 
    name: "Vikram Deshpande", 
    field: "Manufacturing Ops", 
    years: 31, 
    baseRate: 600, 
    adminMarkup: 150, 
    rate: 750, 
    rating: 4.7, 
    sessions: 84, 
    verified: true, 
    initials: "VD", 
    title: "General Manager Manufacturing & Supply Chain",
    phone: "+91 99887 76655",
    email: "vikram.d@registry.com",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    featuredOnLanding: true,
    heroSpotlight: false,
    company: "Mahindra",
    bio: "Precision logistics & shop-floor optimization expert cutting inventory waste, bottleneck delays, and plant overheads.",
    skills: ["Shop-floor Optimization", "Lean Six Sigma", "Inventory Control", "Plant Maintenance", "Supply Chain"],
    experience: [
      { role: "GM Plant Operations", company: "Mahindra Automotive", period: "2010 – 2023" },
      { role: "Senior Operations Manager", company: "Tata Motors", period: "1997 – 2010" }
    ],
    education: "B.Tech Mechanical Engineering, COEP Pune",
    documents: {
      expCert: "Mahindra_Plant_Experience.pdf",
      offerLetter: "Mahindra_Relieving_Letter.pdf",
      resume: "Vikram_Deshpande_CV.pdf",
      submittedDate: "2026-08-30",
      status: "Verified"
    }
  },
  { 
    id: "exp-5", 
    name: "Anjali Menon", 
    field: "School Mathematics", 
    years: 27, 
    baseRate: 300, 
    adminMarkup: 100, 
    rate: 400, 
    rating: 4.9, 
    sessions: 210, 
    verified: true, 
    initials: "AM", 
    title: "Senior Mathematics Pedagogy Specialist",
    phone: "+91 98450 12345",
    email: "anjali.menon@registry.com",
    img: "https://images.unsplash.com/photo-1580894732413-80c749a0a033?w=300&auto=format&fit=crop&q=80",
    featuredOnLanding: true,
    heroSpotlight: true,
    heroPosition: "bottom", // Appears in Card 2 Bottom-Left on Hero Banner
    company: "Delhi Public School",
    bio: "Veteran educator designing intuitive pedagogy, Olympiad prep frameworks, and edtech curriculum standards.",
    skills: ["Curriculum Design", "Olympiad Math", "Teacher Mentorship", "EdTech Pedagogy", "K-12 Assessment"],
    experience: [
      { role: "Head of Mathematics Department", company: "Delhi Public School", period: "2008 – 2022" },
      { role: "Senior Mathematics Educator", company: "The Doon School", period: "1998 – 2008" }
    ],
    education: "M.Sc Mathematics, St. Stephen's College Delhi",
    documents: {
      expCert: "DPS_Service_Certificate.pdf",
      offerLetter: "DPS_Appointment_Letter.pdf",
      resume: "Anjali_Menon_Pedagogy_CV.pdf",
      submittedDate: "2026-08-20",
      status: "Verified"
    }
  },
  { 
    id: "exp-6", 
    name: "Ravi Subramaniam", 
    field: "Legal & Compliance", 
    years: 38, 
    baseRate: 800, 
    adminMarkup: 150, 
    rate: 950, 
    rating: 4.8, 
    sessions: 73, 
    verified: true, 
    initials: "RS", 
    title: "Senior Advocate & Board Legal Advisor",
    phone: "+91 98100 99887",
    email: "ravi.sub@registry.com",
    img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&auto=format&fit=crop&q=80",
    featuredOnLanding: true,
    heroSpotlight: true,
    heroPosition: "top", // Appears in Card 1 Top-Right on Hero Banner
    company: "Khaitan & Co Chambers",
    bio: "Senior Advocate advising on founder SHA/SSA agreements, IP law, regulatory arbitration, and commercial contracts.",
    skills: ["SHA/SSA Review", "IP Law & Patents", "Regulatory Compliance", "Commercial Contracts", "Arbitration"],
    experience: [
      { role: "Senior Partner Legal", company: "Khaitan & Co Chambers", period: "2005 – 2023" },
      { role: "Corporate Legal Counsel", company: "Reliance Industries", period: "1991 – 2005" }
    ],
    education: "LL.M, National Law School of India University",
    documents: {
      expCert: "Bar_Council_Senior_Advocate_Cert.pdf",
      offerLetter: "Khaitan_Partnership_Deed.pdf",
      resume: "Ravi_Subramaniam_Legal_CV.pdf",
      submittedDate: "2026-08-31",
      status: "Verified"
    }
  },
];

const SEED_USERS: UserDoc[] = [
  {
    id: "usr-client-1",
    name: "Vikramaditya Singh",
    email: "vikram@northwindretail.com",
    password: "password123",
    phone: "+91 98123 45678",
    role: "client",
    company: "Northwind Retail Pvt Ltd",
    field: "Retail & E-commerce",
    bio: "Managing Director seeking advisory for GST compliance.",
    initials: "VS",
    createdAt: new Date().toISOString()
  },
  {
    id: "usr-expert-1",
    name: "Sunita Rao",
    email: "sunita.rao@registry.com",
    password: "password123",
    phone: "+91 98765 43210",
    role: "expert",
    title: "Former Chief Financial Officer (Ex-CFO)",
    field: "Finance & Taxation",
    bio: "Ex-CFO with 34 years in corporate tax audits.",
    initials: "SR",
    createdAt: new Date().toISOString()
  },
  {
    id: "usr-admin-1",
    name: "Admin Governance Desk",
    email: "admin@registry.com",
    password: "adminpassword",
    phone: "+91 90000 00000",
    role: "admin",
    initials: "AG",
    createdAt: new Date().toISOString()
  }
];

export interface PendingVerificationDoc {
  id: string;
  name: string;
  field: string;
  years: number;
  applied: string;
  company: string;
  role: string;
  email?: string;
  documents: {
    expCert: string;
    offerLetter: string;
    resume: string;
    items?: Record<string, ExpertDocumentItem>;
    updatedAt?: string;
  };
}

const SEED_PENDING_VERIFICATION: PendingVerificationDoc[] = [
  { 
    id: "ver-1", 
    name: "Deepak Nair", 
    email: "deepak.nair@registry.com",
    field: "Civil Engineering", 
    years: 33, 
    applied: "2 days ago",
    company: "L&T Infrastructure Construction",
    role: "Chief Project Engineer",
    documents: {
      expCert: "LT_Construction_Experience_33yrs.pdf",
      offerLetter: "LT_Relieving_Letter_Offer.pdf",
      resume: "Deepak_Nair_Civil_CV.pdf"
    }
  },
  { 
    id: "ver-2", 
    name: "Lakshmi Pillai", 
    email: "lakshmi.pillai@registry.com",
    field: "Banking & Credit", 
    years: 30, 
    applied: "3 days ago",
    company: "State Bank of India (SBI)",
    role: "Chief General Manager Credit",
    documents: {
      expCert: "SBI_Service_Certificate_30yrs.pdf",
      offerLetter: "SBI_Executive_Appointment.pdf",
      resume: "Lakshmi_Pillai_Banking_CV.pdf"
    }
  },
  { 
    id: "ver-3", 
    name: "George Thomas", 
    email: "george.thomas@registry.com",
    field: "Textile Manufacturing", 
    years: 26, 
    applied: "5 days ago",
    company: "Arvind Mills Ltd",
    role: "VP Plant Operations",
    documents: {
      expCert: "Arvind_Mills_Ops_Cert.pdf",
      offerLetter: "Arvind_Relieving_Deed.pdf",
      resume: "George_Thomas_Textile_CV.pdf"
    }
  },
  {
    id: "ver-4",
    name: "Rajesh Kulkarni",
    email: "rajesh.kulkarni@registry.com",
    field: "Supply Chain & Logistics",
    years: 28,
    applied: "1 day ago",
    company: "Mahindra Logistics Ltd",
    role: "Senior VP Logistics Operations",
    documents: {
      expCert: "Mahindra_Logistics_Service_28yrs.pdf",
      offerLetter: "Mahindra_Relieving_Letter.pdf",
      resume: "Rajesh_Kulkarni_SupplyChain_CV.pdf"
    }
  },
  {
    id: "ver-5",
    name: "Dr. Shalini Deshmukh",
    email: "shalini.deshmukh@registry.com",
    field: "Pharmaceutical R&D",
    years: 31,
    applied: "4 days ago",
    company: "Sun Pharma Industries",
    role: "Head of Clinical Research & Drug Regulatory",
    documents: {
      expCert: "SunPharma_RD_Certificate_31yrs.pdf",
      offerLetter: "SunPharma_Executive_Offer.pdf",
      resume: "Shalini_Deshmukh_Pharma_CV.pdf"
    }
  },
  {
    id: "ver-6",
    name: "Sanjay Vardhan",
    email: "sanjay.vardhan@registry.com",
    field: "Corporate Law & SEBI Regulatory",
    years: 35,
    applied: "6 days ago",
    company: "Khaitan & Co Advocates",
    role: "Senior Partner Legal Compliance",
    documents: {
      expCert: "Khaitan_Legal_Partnership_35yrs.pdf",
      offerLetter: "Khaitan_Bar_Council_Affidavit.pdf",
      resume: "Sanjay_Vardhan_Legal_CV.pdf"
    }
  }
];

const getOffsetDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const SEED_AVAILABILITIES: ExpertAvailabilityDoc[] = [
  {
    id: "avail-1",
    expertId: "exp-1",
    availabilityDate: getOffsetDate(1),
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-2",
    expertId: "exp-1",
    availabilityDate: getOffsetDate(1),
    startTime: "02:00 PM",
    endTime: "03:00 PM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-3",
    expertId: "exp-1",
    availabilityDate: getOffsetDate(2),
    startTime: "11:00 AM",
    endTime: "12:00 PM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-4",
    expertId: "exp-1",
    availabilityDate: getOffsetDate(2),
    startTime: "04:00 PM",
    endTime: "05:00 PM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-5",
    expertId: "exp-1",
    availabilityDate: getOffsetDate(3),
    startTime: "09:00 AM",
    endTime: "10:00 AM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-6",
    expertId: "exp-2",
    availabilityDate: getOffsetDate(1),
    startTime: "09:00 AM",
    endTime: "10:00 AM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-7",
    expertId: "exp-2",
    availabilityDate: getOffsetDate(2),
    startTime: "02:00 PM",
    endTime: "03:00 PM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-8",
    expertId: "exp-3",
    availabilityDate: getOffsetDate(1),
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-9",
    expertId: "exp-3",
    availabilityDate: getOffsetDate(3),
    startTime: "03:00 PM",
    endTime: "04:00 PM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-10",
    expertId: "exp-4",
    availabilityDate: getOffsetDate(1),
    startTime: "11:00 AM",
    endTime: "12:00 PM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-11",
    expertId: "exp-4",
    availabilityDate: getOffsetDate(4),
    startTime: "04:00 PM",
    endTime: "05:00 PM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-12",
    expertId: "exp-5",
    availabilityDate: getOffsetDate(1),
    startTime: "11:00 AM",
    endTime: "12:00 PM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-13",
    expertId: "exp-5",
    availabilityDate: getOffsetDate(3),
    startTime: "02:00 PM",
    endTime: "03:00 PM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-14",
    expertId: "exp-6",
    availabilityDate: getOffsetDate(2),
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "avail-15",
    expertId: "exp-6",
    availabilityDate: getOffsetDate(4),
    startTime: "03:00 PM",
    endTime: "04:00 PM",
    status: "AVAILABLE",
    bookingId: null,
    clientId: null,
    clientName: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  }
];

class MongoDBService {
  private mongoUri: string = localStorage.getItem("MONGO_URI") || "mongodb+srv://admin:secret@cluster0.mongodb.net/silver_workforce?retryWrites=true&w=majority";
  private listeners: Array<(db: any) => void> = [];
  private isPolling: boolean = false;

  constructor() {
    if (!localStorage.getItem("mongo_experts")) {
      localStorage.setItem("mongo_experts", JSON.stringify(SEED_EXPERTS));
    }
    if (!localStorage.getItem("mongo_users")) {
      localStorage.setItem("mongo_users", JSON.stringify(SEED_USERS));
    }
    if (!localStorage.getItem("mongo_pending_verifications")) {
      localStorage.setItem("mongo_pending_verifications", JSON.stringify(SEED_PENDING_VERIFICATION));
    }
    if (!localStorage.getItem("mongo_availabilities")) {
      localStorage.setItem("mongo_availabilities", JSON.stringify(SEED_AVAILABILITIES));
    }
    if (!localStorage.getItem("mongo_expert_documents")) {
      const initialDocs: Record<string, ExpertDocumentsRecord> = {};
      SEED_EXPERTS.forEach(exp => {
        const safeName = exp.name.replace(/\s+/g, "_");
        initialDocs[exp.id] = {
          expertId: exp.id,
          expertName: exp.name,
          expertEmail: exp.email,
          updatedAt: new Date().toISOString(),
          status: exp.verified ? "Verified" : "Pending Audit",
          docs: {
            expCert: {
              id: `doc-${exp.id}-1`,
              type: "expCert",
              title: "Work Experience & Tenure Certificate",
              fileName: exp.documents?.expCert || `${safeName}_Work_Experience_Cert.pdf`,
              fileSize: "1.8 MB",
              uploadedAt: exp.documents?.submittedDate || new Date().toISOString(),
              expertId: exp.id,
              expertName: exp.name,
              expertEmail: exp.email,
              status: exp.verified ? "Verified" : "Pending Audit"
            },
            offerLetter: {
              id: `doc-${exp.id}-2`,
              type: "offerLetter",
              title: "Company Relieving / Promotion Letter",
              fileName: exp.documents?.offerLetter || `${safeName}_Offer_Relieving_Letter.pdf`,
              fileSize: "950 KB",
              uploadedAt: exp.documents?.submittedDate || new Date().toISOString(),
              expertId: exp.id,
              expertName: exp.name,
              expertEmail: exp.email,
              status: exp.verified ? "Verified" : "Pending Audit"
            },
            resume: {
              id: `doc-${exp.id}-3`,
              type: "resume",
              title: "Executive Dossier & Bio Resume",
              fileName: exp.documents?.resume || `${safeName}_Executive_CV_Dossier.pdf`,
              fileSize: "2.4 MB",
              uploadedAt: exp.documents?.submittedDate || new Date().toISOString(),
              expertId: exp.id,
              expertName: exp.name,
              expertEmail: exp.email,
              status: exp.verified ? "Verified" : "Pending Audit"
            }
          }
        };
      });
      SEED_PENDING_VERIFICATION.forEach(item => {
        const safeName = item.name.replace(/\s+/g, "_");
        initialDocs[item.id] = {
          expertId: item.id,
          expertName: item.name,
          expertEmail: `${item.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
          updatedAt: new Date().toISOString(),
          status: "Pending Audit",
          docs: {
            expCert: {
              id: `doc-${item.id}-1`,
              type: "expCert",
              title: "Work Experience & Tenure Certificate",
              fileName: item.documents?.expCert || `${safeName}_Work_Cert.pdf`,
              fileSize: "1.5 MB",
              uploadedAt: new Date().toISOString(),
              expertId: item.id,
              expertName: item.name,
              expertEmail: `${item.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
              status: "Pending Audit"
            },
            offerLetter: {
              id: `doc-${item.id}-2`,
              type: "offerLetter",
              title: "Company Relieving / Promotion Letter",
              fileName: item.documents?.offerLetter || `${safeName}_Offer_Letter.pdf`,
              fileSize: "880 KB",
              uploadedAt: new Date().toISOString(),
              expertId: item.id,
              expertName: item.name,
              expertEmail: `${item.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
              status: "Pending Audit"
            },
            resume: {
              id: `doc-${item.id}-3`,
              type: "resume",
              title: "Executive Dossier & Bio Resume",
              fileName: item.documents?.resume || `${safeName}_CV.pdf`,
              fileSize: "2.1 MB",
              uploadedAt: new Date().toISOString(),
              expertId: item.id,
              expertName: item.name,
              expertEmail: `${item.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
              status: "Pending Audit"
            }
          }
        };
      });
      localStorage.setItem("mongo_expert_documents", JSON.stringify(initialDocs));
    }

    if (typeof window !== "undefined") {
      this.pullServerDb();
      if (!this.isPolling) {
        this.isPolling = true;
        setInterval(() => this.pullServerDb(), 1500);
        window.addEventListener("focus", () => this.pullServerDb());
      }
    }
  }

  public subscribe(cb: (db: any) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify(db: any) {
    this.listeners.forEach(cb => {
      try { cb(db); } catch {}
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mongo_db_updated", { detail: db }));
    }
  }

  public async pullServerDb(): Promise<any> {
    try {
      const res = await fetch("/api/db");
      if (res.ok) {
        const db = await res.json();
        let changed = false;
        if (Array.isArray(db.experts) && db.experts.length > 0) {
          const currentExpRaw = localStorage.getItem("mongo_experts");
          let currentExp: any[] = [];
          try { if (currentExpRaw) currentExp = JSON.parse(currentExpRaw); } catch {}
          const mergedExp = db.experts.map((exp: any) => {
            const cur = currentExp.find((e: any) => e.id === exp.id || (e.name && exp.name && e.name.toLowerCase().trim() === exp.name.toLowerCase().trim()));
            if (!cur) return exp;
            const curItems = cur.documents?.items;
            const nextItems = exp.documents?.items;
            if (curItems && nextItems) {
              for (const slot of ["expCert", "offerLetter", "resume"]) {
                if (curItems[slot]?.fileData && nextItems[slot] && !nextItems[slot].fileData) {
                  nextItems[slot].fileData = curItems[slot].fileData;
                }
              }
            } else if (curItems && !nextItems) {
              return {
                ...exp,
                documents: {
                  ...(exp.documents || {}),
                  items: curItems
                }
              };
            }
            return exp;
          });
          const nextExp = JSON.stringify(mergedExp);
          if (currentExpRaw !== nextExp) {
            localStorage.setItem("mongo_experts", nextExp);
            changed = true;
          }
        }
        if (Array.isArray(db.users) && db.users.length > 0) {
          const currentUsers = localStorage.getItem("mongo_users");
          const nextUsers = JSON.stringify(db.users);
          if (currentUsers !== nextUsers) {
            localStorage.setItem("mongo_users", nextUsers);
            changed = true;
          }
        }
        if (Array.isArray(db.pendingVerifications)) {
          const currentPendRaw = localStorage.getItem("mongo_pending_verifications");
          let currentPend: any[] = [];
          try { if (currentPendRaw) currentPend = JSON.parse(currentPendRaw); } catch {}

          const mergedPend = db.pendingVerifications.map((item: any) => {
            const cur = currentPend.find((p: any) => p.id === item.id || (p.name && item.name && p.name.toLowerCase().trim() === item.name.toLowerCase().trim()));
            if (!cur) return item;
            const curItems = cur.documents?.items;
            const nextItems = item.documents?.items;
            if (curItems && nextItems) {
              for (const slot of ["expCert", "offerLetter", "resume"]) {
                if (curItems[slot]?.fileData && nextItems[slot] && !nextItems[slot].fileData) {
                  nextItems[slot].fileData = curItems[slot].fileData;
                }
              }
            } else if (curItems && !nextItems) {
              return {
                ...item,
                documents: {
                  ...(item.documents || {}),
                  items: curItems
                }
              };
            }
            return item;
          });

          // Retain only newly submitted applicants that are genuinely pending and not yet processed or deleted
          for (const cur of currentPend) {
            const curEmail = cur.email?.toLowerCase().trim();
            const curName = cur.name?.toLowerCase().trim();
            const curId = cur.id;

            const isAlreadyInMerged = mergedPend.some((p: any) => 
              p.id === curId || 
              (curName && p.name && p.name.toLowerCase().trim() === curName) ||
              (curEmail && p.email && p.email.toLowerCase().trim() === curEmail)
            );

            const isAlreadyProcessedInExperts = Array.isArray(db.experts) && db.experts.some((e: any) => 
              (e.id === curId || (curName && e.name && e.name.toLowerCase().trim() === curName) || (curEmail && e.email && e.email.toLowerCase().trim() === curEmail)) &&
              (e.verified === true || e.verificationStatus === "approved" || e.verificationStatus === "rejected" || e.rejected === true)
            );

            const isDeletedOrRejected = Array.isArray(db.deletedExperts) && (
              db.deletedExperts.includes(curId) || 
              (curName && db.deletedExperts.includes(curName)) || 
              (curEmail && db.deletedExperts.includes(curEmail))
            );

            if (!isAlreadyInMerged && !isAlreadyProcessedInExperts && !isDeletedOrRejected) {
              mergedPend.unshift(cur);
            }
          }

          const nextPend = JSON.stringify(mergedPend);
          if (currentPendRaw !== nextPend) {
            localStorage.setItem("mongo_pending_verifications", nextPend);
            changed = true;
          }
        }
        if (db.expertDocuments && typeof db.expertDocuments === "object") {
          const currentDocsRaw = localStorage.getItem("mongo_expert_documents");
          let currentDocs: Record<string, any> = {};
          try { if (currentDocsRaw) currentDocs = JSON.parse(currentDocsRaw); } catch {}

          const mergedDocs: Record<string, any> = { ...db.expertDocuments };
          for (const k of Object.keys(currentDocs)) {
            const curRec = currentDocs[k];
            if (!curRec?.docs) continue;
            if (!mergedDocs[k]) {
              mergedDocs[k] = curRec;
            } else if (mergedDocs[k]?.docs) {
              for (const slot of ["expCert", "offerLetter", "resume"] as const) {
                const curSlot = curRec.docs[slot];
                const nextSlot = mergedDocs[k].docs[slot];
                if (curSlot?.fileData && nextSlot && !nextSlot.fileData) {
                  nextSlot.fileData = curSlot.fileData;
                }
              }
            }
          }
          const nextDocs = JSON.stringify(mergedDocs);
          if (currentDocsRaw !== nextDocs) {
            localStorage.setItem("mongo_expert_documents", nextDocs);
            changed = true;
          }
        }
        if (Array.isArray(db.availabilities)) {
          const currentAvailRaw = localStorage.getItem("mongo_availabilities");
          const nextAvail = JSON.stringify(db.availabilities);
          if (currentAvailRaw !== nextAvail) {
            localStorage.setItem("mongo_availabilities", nextAvail);
            changed = true;
          }
        }
        if (Array.isArray(db.deletedExperts)) {
          localStorage.setItem("mongo_deleted_experts", JSON.stringify(db.deletedExperts));
        }
        if (db.kv && typeof db.kv === "object") {
          Object.keys(db.kv).forEach(k => {
            const val = typeof db.kv[k] === "string" ? db.kv[k] : JSON.stringify(db.kv[k]);
            if (localStorage.getItem(k) !== val) {
              localStorage.setItem(k, val);
              changed = true;
            }
          });
        }
        const cfgObj = db.platformCharge || db.projectReviewConfig;
        if (cfgObj && typeof cfgObj === "object") {
          const currentConfigRaw = localStorage.getItem("mongo_project_review_config");
          const nextConfig = JSON.stringify(cfgObj);
          if (currentConfigRaw !== nextConfig) {
            localStorage.setItem("mongo_project_review_config", nextConfig);
            localStorage.setItem("mongo_platform_charge", nextConfig);
            changed = true;
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("platform_fee_updated", { detail: cfgObj }));
            }
          }
        }
        if (Array.isArray(db.blogs)) {
          const currentBlogsRaw = localStorage.getItem("mongo_blogs");
          const nextBlogs = JSON.stringify(db.blogs);
          if (currentBlogsRaw !== nextBlogs) {
            localStorage.setItem("mongo_blogs", nextBlogs);
            changed = true;
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("blogs_updated", { detail: db.blogs }));
            }
          }
        }
        if (Array.isArray(db.blogCategories)) {
          const currentCatsRaw = localStorage.getItem("mongo_blog_categories");
          const nextCats = JSON.stringify(db.blogCategories);
          if (currentCatsRaw !== nextCats) {
            localStorage.setItem("mongo_blog_categories", nextCats);
            changed = true;
          }
        }
        if (changed) {
          this.notify(db);
        }
        return db;
      }
    } catch {}
    return null;
  }

  public async pushServerDb(payload: any): Promise<void> {
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      this.notify(payload);
    } catch {}
  }

  public async syncKv(key: string, value: any): Promise<void> {
    const valStr = typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, valStr);
    try {
      await fetch("/api/kv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value })
      });
    } catch {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mongo_kv_updated", { detail: { key, value } }));
    }
  }

  public async getKv(key: string): Promise<any> {
    try {
      const res = await fetch(`/api/kv?key=${encodeURIComponent(key)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.value !== null && data.value !== undefined) {
          const str = typeof data.value === "string" ? data.value : JSON.stringify(data.value);
          localStorage.setItem(key, str);
          return data.value;
        }
      }
    } catch {}
    const local = localStorage.getItem(key);
    try { return local ? JSON.parse(local) : null; } catch { return local; }
  }

  public getMongoUri(): string {
    return this.mongoUri;
  }

  public setMongoUri(uri: string): void {
    this.mongoUri = uri;
    localStorage.setItem("MONGO_URI", uri);
  }

  // Pending Verifications Collection (MongoDB Synced)
  public async getPendingVerifications(): Promise<PendingVerificationDoc[]> {
    const raw = localStorage.getItem("mongo_pending_verifications");
    let parsed: PendingVerificationDoc[] = raw ? JSON.parse(raw) : SEED_PENDING_VERIFICATION;
    if (Array.isArray(parsed) && parsed.length === 0) {
      localStorage.setItem("mongo_pending_verifications", JSON.stringify(SEED_PENDING_VERIFICATION));
      parsed = SEED_PENDING_VERIFICATION;
    }
    const rawUsers = localStorage.getItem("mongo_users");
    let usersList: any[] = [];
    try { if (rawUsers) usersList = JSON.parse(rawUsers); } catch {}

    const rawExp = localStorage.getItem("mongo_experts");
    let expList: any[] = [];
    try { if (rawExp) expList = JSON.parse(rawExp); } catch {}

    parsed = parsed.map(p => {
      let resolvedEmail = p.email;
      if (!resolvedEmail) {
        const u = usersList.find((u: any) => u.id === p.id || (u.name && p.name && u.name.toLowerCase().trim() === p.name.toLowerCase().trim()));
        if (u?.email) resolvedEmail = u.email;
        else {
          const e = expList.find((e: any) => e.id === p.id || (e.name && p.name && e.name.toLowerCase().trim() === p.name.toLowerCase().trim()));
          if (e?.email) resolvedEmail = e.email;
        }
      }
      return {
        ...p,
        email: resolvedEmail
      };
    });

    const docsRaw = localStorage.getItem("mongo_expert_documents");
    if (docsRaw) {
      try {
        const records: Record<string, ExpertDocumentsRecord> = JSON.parse(docsRaw);
        parsed = parsed.map(p => {
          const docRec = records[p.id] || records[p.name.toLowerCase().trim()] || (p.email ? records[p.email.toLowerCase()] : null);
          if (docRec?.docs) {
            return {
              ...p,
              documents: {
                ...p.documents,
                expCert: docRec.docs.expCert?.fileName || p.documents?.expCert || "Work_Cert.pdf",
                offerLetter: docRec.docs.offerLetter?.fileName || p.documents?.offerLetter || "Offer_Letter.pdf",
                resume: docRec.docs.resume?.fileName || p.documents?.resume || "Resume.pdf",
                items: docRec.docs as Record<string, ExpertDocumentItem>,
                updatedAt: docRec.updatedAt || p.documents?.updatedAt
              }
            };
          }
          return p;
        });
      } catch {}
    }
    return parsed;
  }

  // Dynamic single source of truth for expert verification audit status
  public async getAuditStatus(emailOrIdOrName?: string): Promise<{ 
    verified: boolean; 
    verificationStatus: "pending" | "approved" | "rejected"; 
    rejected: boolean; 
    expert?: ExpertDoc;
    applicant?: PendingVerificationDoc;
  }> {
    if (!emailOrIdOrName) {
      return { verified: false, verificationStatus: "pending", rejected: false };
    }
    const query = emailOrIdOrName.toLowerCase().trim();

    // 1. Check if rejected/deleted by Admin
    const deletedKeys = await this.getDeletedExpertKeys();
    if (deletedKeys.some(k => k.toLowerCase().trim() === query)) {
      return { verified: false, verificationStatus: "rejected", rejected: true };
    }

    // 2. Check pending verifications queue (Desk 02)
    const pendings = await this.getPendingVerifications();
    const pendMatch = pendings.find(p => 
      p.id.toLowerCase().trim() === query ||
      (p.email && p.email.toLowerCase().trim() === query) ||
      p.name.toLowerCase().trim() === query
    );
    if (pendMatch) {
      return { verified: false, verificationStatus: "pending", rejected: false, applicant: pendMatch };
    }

    // 3. Check active experts roster (Desk 03)
    const rawExperts = localStorage.getItem("mongo_experts");
    const experts: ExpertDoc[] = rawExperts ? JSON.parse(rawExperts) : SEED_EXPERTS;
    const expMatch = experts.find(e => 
      e.id.toLowerCase().trim() === query ||
      (e.email && e.email.toLowerCase().trim() === query) ||
      e.name.toLowerCase().trim() === query
    );

    if (expMatch) {
      if (expMatch.verified === true && expMatch.verificationStatus !== "rejected" && !expMatch.rejected) {
        return { verified: true, verificationStatus: "approved", rejected: false, expert: expMatch };
      }
      if (expMatch.verificationStatus === "rejected" || expMatch.rejected === true) {
        return { verified: false, verificationStatus: "rejected", rejected: true, expert: expMatch };
      }
      return { verified: false, verificationStatus: "pending", rejected: false, expert: expMatch };
    }

    // 4. Check mongo_users
    try {
      const rawUsers = localStorage.getItem("mongo_users");
      if (rawUsers) {
        const users = JSON.parse(rawUsers);
        const uMatch = users.find((u: any) => 
          u.id?.toLowerCase().trim() === query ||
          u.email?.toLowerCase().trim() === query ||
          u.name?.toLowerCase().trim() === query
        );
        if (uMatch) {
          if (uMatch.verificationStatus === "rejected" || uMatch.rejected === true) {
            return { verified: false, verificationStatus: "rejected", rejected: true };
          }
          if (uMatch.verified === true || uMatch.verificationStatus === "approved") {
            return { verified: true, verificationStatus: "approved", rejected: false };
          }
        }
      }
    } catch {}

    return { verified: false, verificationStatus: "pending", rejected: false };
  }

  // Reset/Re-seed Pending Audit Queue
  public async resetPendingQueue(): Promise<PendingVerificationDoc[]> {
    localStorage.setItem("mongo_pending_verifications", JSON.stringify(SEED_PENDING_VERIFICATION));
    return SEED_PENDING_VERIFICATION;
  }

  // Expert Documents Collection (Persistent Database Single Source of Truth)
  public getExpertDocuments(idOrEmailOrName?: string): ExpertDocumentsRecord | null {
    if (!idOrEmailOrName) return null;
    const query = idOrEmailOrName.trim().toLowerCase();
    const raw = localStorage.getItem("mongo_expert_documents");
    const records: Record<string, ExpertDocumentsRecord> = raw ? JSON.parse(raw) : {};

    const enrichRecordWithFileBinaries = (r: ExpertDocumentsRecord | null): ExpertDocumentsRecord | null => {
      if (!r || !r.docs) return r;
      const slots: Array<keyof typeof r.docs> = ["expCert", "offerLetter", "resume"];
      let sessionItems: any = null;
      try {
        const cur = localStorage.getItem("current_logged_in_expert") || localStorage.getItem("admin_logged_in_expert");
        if (cur) {
          const p = JSON.parse(cur);
          if (p?.documents?.items) sessionItems = p.documents.items;
        }
      } catch {}

      for (const slot of slots) {
        const d = r.docs[slot];
        if (d && (!d.fileData || !d.fileData.startsWith("data:"))) {
          const fn = d.fileName ? d.fileName.toLowerCase().trim() : "";
          const fromSession = sessionItems?.[slot]?.fileData && sessionItems[slot].fileData.startsWith("data:") ? sessionItems[slot].fileData : null;
          const found = fromSession ||
            (fn ? (localStorage.getItem(`doc_bin_${fn}`) || sessionStorage.getItem(`doc_bin_${fn}`)) : null) ||
            (d.id ? (localStorage.getItem(`doc_bin_${d.id}`) || sessionStorage.getItem(`doc_bin_${d.id}`)) : null) ||
            (r.expertId ? (localStorage.getItem(`doc_bin_${r.expertId}_${slot}`) || sessionStorage.getItem(`doc_bin_${r.expertId}_${slot}`)) : null) ||
            (r.expertName ? (localStorage.getItem(`doc_bin_${r.expertName.toLowerCase().trim()}_${slot}`) || sessionStorage.getItem(`doc_bin_${r.expertName.toLowerCase().trim()}_${slot}`)) : null) ||
            (r.expertEmail ? (localStorage.getItem(`doc_bin_${r.expertEmail.toLowerCase().trim()}_${slot}`) || sessionStorage.getItem(`doc_bin_${r.expertEmail.toLowerCase().trim()}_${slot}`)) : null);
          if (found && found.startsWith("data:")) {
            d.fileData = found;
          }
        }
      }
      return r;
    };

    // 1. Direct key match (by expertId, email, or name)
    if (records[idOrEmailOrName]) {
      return enrichRecordWithFileBinaries(records[idOrEmailOrName]);
    }
    if (records[query]) {
      return enrichRecordWithFileBinaries(records[query]);
    }

    // 2. Value scan (by expertId, expertEmail, or expertName)
    for (const key of Object.keys(records)) {
      const rec = records[key];
      if (
        rec.expertId?.toLowerCase() === query ||
        rec.expertEmail?.toLowerCase() === query ||
        rec.expertName?.toLowerCase().trim() === query
      ) {
        return enrichRecordWithFileBinaries(rec);
      }
    }

    // 3. Check mongo_pending_verifications: If query matches an audit case ID or applicant
    const pendRaw = localStorage.getItem("mongo_pending_verifications");
    if (pendRaw) {
      try {
        const pendings: PendingVerificationDoc[] = JSON.parse(pendRaw);
        const item = pendings.find(p => 
          p.id.toLowerCase() === query || 
          p.name.toLowerCase().trim() === query ||
          (p.email && p.email.toLowerCase() === query)
        );
        if (item) {
          // Priority A: Check if records already has a real uploaded record matching this person
          const existingRealRec = Object.values(records).find(r => 
            (r.expertName && item.name && r.expertName.toLowerCase().trim() === item.name.toLowerCase().trim()) ||
            (r.expertEmail && item.email && r.expertEmail.toLowerCase().trim() === item.email.toLowerCase().trim()) ||
            (r.expertId && item.id && r.expertId.toLowerCase() === item.id.toLowerCase())
          );
          if (existingRealRec) {
            records[item.id] = existingRealRec;
            safeSetItem("mongo_expert_documents", JSON.stringify(records));
            return enrichRecordWithFileBinaries(existingRealRec);
          }

          // Priority B: If item.documents?.items has uploaded document items
          if (item.documents && (item.documents as any).items) {
            const items = (item.documents as any).items;
            if (items.expCert || items.offerLetter || items.resume) {
              const recFromPending: ExpertDocumentsRecord = {
                expertId: item.id,
                expertName: item.name,
                expertEmail: item.email || `${item.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
                updatedAt: item.documents.updatedAt || new Date().toISOString(),
                status: "Pending Audit",
                docs: items
              };
              records[item.id] = recFromPending;
              safeSetItem("mongo_expert_documents", JSON.stringify(records));
              return enrichRecordWithFileBinaries(recFromPending);
            }
          }
        }
      } catch {}
    }

    // 4. Check mongo_experts if registered with documents
    const expertsRaw = localStorage.getItem("mongo_experts");
    if (expertsRaw) {
      try {
        const experts: ExpertDoc[] = JSON.parse(expertsRaw);
        const exp = experts.find(e => 
          e.id.toLowerCase() === query || 
          e.email.toLowerCase() === query || 
          e.name.toLowerCase().trim() === query
        );
        if (exp && exp.documents) {
          const existingExpRec = Object.values(records).find(r => 
            (r.expertId && exp.id && r.expertId.toLowerCase() === exp.id.toLowerCase()) ||
            (r.expertName && exp.name && r.expertName.toLowerCase().trim() === exp.name.toLowerCase().trim()) ||
            (r.expertEmail && exp.email && r.expertEmail.toLowerCase().trim() === exp.email.toLowerCase().trim())
          );
          if (existingExpRec) {
            return enrichRecordWithFileBinaries(existingExpRec);
          }

          if (exp.documents.items) {
            const recFromExp: ExpertDocumentsRecord = {
              expertId: exp.id,
              expertName: exp.name,
              expertEmail: exp.email,
              updatedAt: exp.documents.updatedAt || new Date().toISOString(),
              status: (exp.documents.status as any) || (exp.verified ? "Verified" : "Pending Audit"),
              docs: exp.documents.items
            };
            records[exp.id] = recFromExp;
            safeSetItem("mongo_expert_documents", JSON.stringify(records));
            return enrichRecordWithFileBinaries(recFromExp);
          }

          const safeName = exp.name.replace(/\s+/g, "_");
          const synthesized: ExpertDocumentsRecord = {
            expertId: exp.id,
            expertName: exp.name,
            expertEmail: exp.email,
            updatedAt: exp.documents.updatedAt || new Date().toISOString(),
            status: (exp.documents.status as any) || (exp.verified ? "Verified" : "Pending Audit"),
            docs: {
              expCert: {
                id: `doc-${exp.id}-1`,
                type: "expCert",
                title: "Work Experience & Tenure Certificate",
                fileName: exp.documents.expCert || `${safeName}_Work_Experience_Cert.pdf`,
                fileSize: "1.8 MB",
                uploadedAt: exp.documents.submittedDate || new Date().toISOString(),
                expertId: exp.id,
                expertName: exp.name,
                expertEmail: exp.email,
                status: (exp.documents.status as any) || (exp.verified ? "Verified" : "Pending Audit")
              },
              offerLetter: {
                id: `doc-${exp.id}-2`,
                type: "offerLetter",
                title: "Company Relieving / Promotion Letter",
                fileName: exp.documents.offerLetter || `${safeName}_Offer_Relieving_Letter.pdf`,
                fileSize: "950 KB",
                uploadedAt: exp.documents.submittedDate || new Date().toISOString(),
                expertId: exp.id,
                expertName: exp.name,
                expertEmail: exp.email,
                status: (exp.documents.status as any) || (exp.verified ? "Verified" : "Pending Audit")
              },
              resume: {
                id: `doc-${exp.id}-3`,
                type: "resume",
                title: "Executive Dossier & Bio Resume",
                fileName: exp.documents.resume || `${safeName}_Executive_CV_Dossier.pdf`,
                fileSize: "2.4 MB",
                uploadedAt: exp.documents.submittedDate || new Date().toISOString(),
                expertId: exp.id,
                expertName: exp.name,
                expertEmail: exp.email,
                status: (exp.documents.status as any) || (exp.verified ? "Verified" : "Pending Audit")
              }
            }
          };
          records[exp.id] = synthesized;
          safeSetItem("mongo_expert_documents", JSON.stringify(records));
          return enrichRecordWithFileBinaries(synthesized);
        }
      } catch {}
    }

    // 5. Fallback: Synthesize from mongo_pending_verifications if neither real record nor items exist
    if (pendRaw) {
      try {
        const pendings: PendingVerificationDoc[] = JSON.parse(pendRaw);
        const item = pendings.find(p => p.id.toLowerCase() === query || p.name.toLowerCase().trim() === query);
        if (item) {
          const safeName = item.name.replace(/\s+/g, "_");
          const synthesized: ExpertDocumentsRecord = {
            expertId: item.id,
            expertName: item.name,
            expertEmail: item.email || `${item.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
            updatedAt: item.documents?.updatedAt || new Date().toISOString(),
            status: "Pending Audit",
            docs: {
              expCert: {
                id: `doc-${item.id}-1`,
                type: "expCert",
                title: "Work Experience & Tenure Certificate",
                fileName: item.documents?.expCert || `${safeName}_Work_Cert.pdf`,
                fileSize: "1.5 MB",
                uploadedAt: new Date().toISOString(),
                expertId: item.id,
                expertName: item.name,
                expertEmail: item.email || `${item.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
                status: "Pending Audit"
              },
              offerLetter: {
                id: `doc-${item.id}-2`,
                type: "offerLetter",
                title: "Company Relieving / Promotion Letter",
                fileName: item.documents?.offerLetter || `${safeName}_Offer_Letter.pdf`,
                fileSize: "880 KB",
                uploadedAt: new Date().toISOString(),
                expertId: item.id,
                expertName: item.name,
                expertEmail: item.email || `${item.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
                status: "Pending Audit"
              },
              resume: {
                id: `doc-${item.id}-3`,
                type: "resume",
                title: "Executive Dossier & Bio Resume",
                fileName: item.documents?.resume || `${safeName}_CV.pdf`,
                fileSize: "2.1 MB",
                uploadedAt: new Date().toISOString(),
                expertId: item.id,
                expertName: item.name,
                expertEmail: item.email || `${item.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
                status: "Pending Audit"
              }
            }
          };
          records[item.id] = synthesized;
          safeSetItem("mongo_expert_documents", JSON.stringify(records));
          return enrichRecordWithFileBinaries(synthesized);
        }
      } catch {}
    }

    return null;
  }

  // Save or Update Expert Verification Documents in MongoDB
  public async saveExpertDocuments(
    expertId: string,
    expertName: string,
    expertEmail: string,
    docsData: {
      expCert?: Partial<ExpertDocumentItem>;
      offerLetter?: Partial<ExpertDocumentItem>;
      resume?: Partial<ExpertDocumentItem>;
    }
  ): Promise<ExpertDocumentsRecord> {
    const raw = localStorage.getItem("mongo_expert_documents");
    const records: Record<string, ExpertDocumentsRecord> = raw ? JSON.parse(raw) : {};

    // Look up any matching pending verification item to link records
    const pendRaw = localStorage.getItem("mongo_pending_verifications");
    let pendings: PendingVerificationDoc[] = pendRaw ? JSON.parse(pendRaw) : [];
    const pendIdx = pendings.findIndex(p => 
      p.id === expertId || 
      (expertEmail && p.email && p.email.toLowerCase() === expertEmail.toLowerCase()) ||
      (expertName && p.name && p.name.toLowerCase().trim() === expertName.toLowerCase().trim())
    );
    const matchingPendingId = pendIdx >= 0 ? pendings[pendIdx].id : null;

    // Get existing record to preserve unmodified documents when editing
    const existing = this.getExpertDocuments(expertId) || this.getExpertDocuments(expertEmail) || this.getExpertDocuments(expertName);
    const existingDocs = existing?.docs || {};

    const now = new Date().toISOString();

    const expCertId = docsData.expCert?.id || existingDocs.expCert?.id || `doc-${expertId}-1`;
    const offerLetterId = docsData.offerLetter?.id || existingDocs.offerLetter?.id || `doc-${expertId}-2`;
    const resumeId = docsData.resume?.id || existingDocs.resume?.id || `doc-${expertId}-3`;

    const expCertFileName = docsData.expCert?.fileName || existingDocs.expCert?.fileName || "Experience_Certificate.pdf";
    const offerLetterFileName = docsData.offerLetter?.fileName || existingDocs.offerLetter?.fileName || "Offer_Relieving_Letter.pdf";
    const resumeFileName = docsData.resume?.fileName || existingDocs.resume?.fileName || "Executive_Bio_CV.pdf";

    // Fallback fileData for existing docs from localStorage/sessionStorage so editing one doc never drops others
    const expCertPrevFile: string | undefined = existingDocs.expCert?.fileData || 
      (typeof window !== "undefined" ? (localStorage.getItem(`doc_bin_${expCertFileName.toLowerCase().trim()}`) || sessionStorage.getItem(`doc_bin_${expCertFileName.toLowerCase().trim()}`) || undefined) : undefined);
    const offerLetterPrevFile: string | undefined = existingDocs.offerLetter?.fileData || 
      (typeof window !== "undefined" ? (localStorage.getItem(`doc_bin_${offerLetterFileName.toLowerCase().trim()}`) || sessionStorage.getItem(`doc_bin_${offerLetterFileName.toLowerCase().trim()}`) || undefined) : undefined);
    const resumePrevFile: string | undefined = existingDocs.resume?.fileData || 
      (typeof window !== "undefined" ? (localStorage.getItem(`doc_bin_${resumeFileName.toLowerCase().trim()}`) || sessionStorage.getItem(`doc_bin_${resumeFileName.toLowerCase().trim()}`) || undefined) : undefined);

    // Persist heavy binary file data to IndexedDB, localStorage, sessionStorage, and memory cache
    if (docsData.expCert?.fileData) {
      const data = docsData.expCert.fileData;
      const meta = { fileName: expCertFileName, expertId, expertName, expertEmail, type: "expCert" };
      await storeDocFile(expCertId, data, meta);
      await storeDocFile(`doc-${expertId}-1`, data, meta);
      await storeDocFile(`doc-${expertId}-expCert`, data, meta);
      await storeDocFile(`doc-${expertName.toLowerCase().trim()}-1`, data, meta);
      await storeDocFile(`doc-${expertName.toLowerCase().trim()}-expCert`, data, meta);
      if (expertEmail) {
        await storeDocFile(`doc-${expertEmail.toLowerCase().trim()}-1`, data, meta);
        await storeDocFile(`doc-${expertEmail.toLowerCase().trim()}-expCert`, data, meta);
      }
      if (matchingPendingId) {
        await storeDocFile(`doc-${matchingPendingId}-1`, data, meta);
        await storeDocFile(`doc-${matchingPendingId}-expCert`, data, meta);
      }
      if (expCertFileName) {
        await storeDocFile(`file-${expCertFileName.toLowerCase().trim()}`, data, meta);
        await storeDocFile(expCertFileName, data, meta);
      }
    }
    if (docsData.offerLetter?.fileData) {
      const data = docsData.offerLetter.fileData;
      const meta = { fileName: offerLetterFileName, expertId, expertName, expertEmail, type: "offerLetter" };
      await storeDocFile(offerLetterId, data, meta);
      await storeDocFile(`doc-${expertId}-2`, data, meta);
      await storeDocFile(`doc-${expertId}-offerLetter`, data, meta);
      await storeDocFile(`doc-${expertName.toLowerCase().trim()}-2`, data, meta);
      await storeDocFile(`doc-${expertName.toLowerCase().trim()}-offerLetter`, data, meta);
      if (expertEmail) {
        await storeDocFile(`doc-${expertEmail.toLowerCase().trim()}-2`, data, meta);
        await storeDocFile(`doc-${expertEmail.toLowerCase().trim()}-offerLetter`, data, meta);
      }
      if (matchingPendingId) {
        await storeDocFile(`doc-${matchingPendingId}-2`, data, meta);
        await storeDocFile(`doc-${matchingPendingId}-offerLetter`, data, meta);
      }
      if (offerLetterFileName) {
        await storeDocFile(`file-${offerLetterFileName.toLowerCase().trim()}`, data, meta);
        await storeDocFile(offerLetterFileName, data, meta);
      }
    }
    if (docsData.resume?.fileData) {
      const data = docsData.resume.fileData;
      const meta = { fileName: resumeFileName, expertId, expertName, expertEmail, type: "resume" };
      await storeDocFile(resumeId, data, meta);
      await storeDocFile(`doc-${expertId}-3`, data, meta);
      await storeDocFile(`doc-${expertId}-resume`, data, meta);
      await storeDocFile(`doc-${expertName.toLowerCase().trim()}-3`, data, meta);
      await storeDocFile(`doc-${expertName.toLowerCase().trim()}-resume`, data, meta);
      if (expertEmail) {
        await storeDocFile(`doc-${expertEmail.toLowerCase().trim()}-3`, data, meta);
        await storeDocFile(`doc-${expertEmail.toLowerCase().trim()}-resume`, data, meta);
      }
      if (matchingPendingId) {
        await storeDocFile(`doc-${matchingPendingId}-3`, data, meta);
        await storeDocFile(`doc-${matchingPendingId}-resume`, data, meta);
      }
      if (resumeFileName) {
        await storeDocFile(`file-${resumeFileName.toLowerCase().trim()}`, data, meta);
        await storeDocFile(resumeFileName, data, meta);
      }
    }

    const mergedDocs: {
      expCert?: ExpertDocumentItem;
      offerLetter?: ExpertDocumentItem;
      resume?: ExpertDocumentItem;
    } = {
      expCert: docsData.expCert
        ? {
            id: expCertId,
            type: "expCert",
            title: "Work Experience & Tenure Certificate",
            fileName: expCertFileName,
            fileSize: docsData.expCert.fileSize || existingDocs.expCert?.fileSize || "1.2 MB",
            fileData: docsData.expCert.fileData || expCertPrevFile,
            uploadedAt: existingDocs.expCert?.uploadedAt || now,
            updatedAt: now,
            expertId,
            expertName,
            expertEmail,
            status: "Pending Audit"
          }
        : (existingDocs.expCert ? { ...existingDocs.expCert, fileData: expCertPrevFile } : undefined),
      offerLetter: docsData.offerLetter
        ? {
            id: offerLetterId,
            type: "offerLetter",
            title: "Company Relieving / Promotion Letter",
            fileName: offerLetterFileName,
            fileSize: docsData.offerLetter.fileSize || existingDocs.offerLetter?.fileSize || "850 KB",
            fileData: docsData.offerLetter.fileData || offerLetterPrevFile,
            uploadedAt: existingDocs.offerLetter?.uploadedAt || now,
            updatedAt: now,
            expertId,
            expertName,
            expertEmail,
            status: "Pending Audit"
          }
        : (existingDocs.offerLetter ? { ...existingDocs.offerLetter, fileData: offerLetterPrevFile } : undefined),
      resume: docsData.resume
        ? {
            id: resumeId,
            type: "resume",
            title: "Executive Dossier & Bio Resume",
            fileName: resumeFileName,
            fileSize: docsData.resume.fileSize || existingDocs.resume?.fileSize || "2.0 MB",
            fileData: docsData.resume.fileData || resumePrevFile,
            uploadedAt: existingDocs.resume?.uploadedAt || now,
            updatedAt: now,
            expertId,
            expertName,
            expertEmail,
            status: "Pending Audit"
          }
        : (existingDocs.resume ? { ...existingDocs.resume, fileData: resumePrevFile } : undefined)
    };

    // Save dedicated binary keys for each uploaded document immediately
    if (typeof window !== "undefined") {
      try {
        const slots: Array<keyof typeof mergedDocs> = ["expCert", "offerLetter", "resume"];
        for (const s of slots) {
          const itm = mergedDocs[s];
          if (itm?.fileData && itm.fileData.startsWith("data:")) {
            const fn = itm.fileName ? itm.fileName.toLowerCase().trim() : "";
            if (fn) {
              safeSetItem(`doc_bin_${fn}`, itm.fileData);
              try { sessionStorage.setItem(`doc_bin_${fn}`, itm.fileData); } catch {}
            }
            if (itm.id) {
              safeSetItem(`doc_bin_${itm.id}`, itm.fileData);
              try { sessionStorage.setItem(`doc_bin_${itm.id}`, itm.fileData); } catch {}
            }
            safeSetItem(`doc_bin_${expertId}_${s}`, itm.fileData);
            safeSetItem(`doc_bin_${expertName.toLowerCase().trim()}_${s}`, itm.fileData);
            if (expertEmail) safeSetItem(`doc_bin_${expertEmail.toLowerCase().trim()}_${s}`, itm.fileData);
            if (matchingPendingId) {
              safeSetItem(`doc_bin_${matchingPendingId}_${s}`, itm.fileData);
              if (itm.id) safeSetItem(`doc_bin_${matchingPendingId}_${itm.id}`, itm.fileData);
            }
          }
        }
      } catch {}
    }

    const record: ExpertDocumentsRecord = {
      expertId,
      expertName,
      expertEmail,
      updatedAt: now,
      status: "Pending Audit",
      docs: mergedDocs
    };

    // Store in expert documents records keyed by expertId, normalized name, email, and matching pending ID
    records[expertId] = record;
    records[expertName.toLowerCase().trim()] = record;
    if (expertEmail) records[expertEmail.toLowerCase().trim()] = record;
    if (matchingPendingId) records[matchingPendingId] = record;

    let savedOk = safeSetItem("mongo_expert_documents", JSON.stringify(records));
    if (!savedOk) {
      // If saving full records collection exceeded localStorage limit, create lightweight record for collection while dedicated binary keys preserve actual fileData
      const lightweightDocs = {
        expCert: mergedDocs.expCert ? { ...mergedDocs.expCert, fileData: undefined } : undefined,
        offerLetter: mergedDocs.offerLetter ? { ...mergedDocs.offerLetter, fileData: undefined } : undefined,
        resume: mergedDocs.resume ? { ...mergedDocs.resume, fileData: undefined } : undefined,
      };
      const lightweightRecord: ExpertDocumentsRecord = {
        ...record,
        docs: lightweightDocs
      };
      records[expertId] = lightweightRecord;
      records[expertName.toLowerCase().trim()] = lightweightRecord;
      if (expertEmail) records[expertEmail.toLowerCase().trim()] = lightweightRecord;
      if (matchingPendingId) records[matchingPendingId] = lightweightRecord;
      safeSetItem("mongo_expert_documents", JSON.stringify(records));
    }

    // Update mongo_experts with real documents
    try {
      const rawExperts = localStorage.getItem("mongo_experts");
      let experts: ExpertDoc[] = rawExperts ? JSON.parse(rawExperts) : [];
      const expIdx = experts.findIndex(e => e.id === expertId || e.email?.toLowerCase() === expertEmail.toLowerCase() || e.name?.toLowerCase().trim() === expertName.toLowerCase().trim());
      if (expIdx >= 0) {
        experts[expIdx] = {
          ...experts[expIdx],
          documents: {
            ...(experts[expIdx].documents || {}),
            expCert: mergedDocs.expCert?.fileName || "Experience_Certificate.pdf",
            offerLetter: mergedDocs.offerLetter?.fileName || "Offer_Relieving_Letter.pdf",
            resume: mergedDocs.resume?.fileName || "Executive_Bio_CV.pdf",
            items: mergedDocs as Record<string, ExpertDocumentItem>,
            submittedDate: now.split("T")[0],
            updatedAt: now,
            status: "Pending Audit"
          }
        };
        if (!safeSetItem("mongo_experts", JSON.stringify(experts))) {
          const lw: any = {
            expCert: mergedDocs.expCert ? { ...mergedDocs.expCert, fileData: undefined } : undefined,
            offerLetter: mergedDocs.offerLetter ? { ...mergedDocs.offerLetter, fileData: undefined } : undefined,
            resume: mergedDocs.resume ? { ...mergedDocs.resume, fileData: undefined } : undefined,
          };
          experts[expIdx].documents!.items = lw;
          safeSetItem("mongo_experts", JSON.stringify(experts));
        }
      }
    } catch (e) {
      console.warn("Could not update mongo_experts:", e);
    }

    // Update or insert into mongo_pending_verifications so Admin queue immediately reflects latest docs with real fileData
    try {
      const pendRaw = localStorage.getItem("mongo_pending_verifications");
      let pendings: PendingVerificationDoc[] = pendRaw ? JSON.parse(pendRaw) : [];
      const pendIdx = pendings.findIndex(p => 
        p.id === expertId || 
        p.name?.toLowerCase().trim() === expertName.toLowerCase().trim() || 
        (expertEmail && p.email && p.email.toLowerCase() === expertEmail.toLowerCase())
      );
      const pendingDocPayload = {
        expCert: mergedDocs.expCert?.fileName || "Experience_Certificate.pdf",
        offerLetter: mergedDocs.offerLetter?.fileName || "Offer_Relieving_Letter.pdf",
        resume: mergedDocs.resume?.fileName || "Executive_Bio_CV.pdf",
        items: mergedDocs as Record<string, ExpertDocumentItem>,
        updatedAt: now
      };
      if (pendIdx >= 0) {
        pendings[pendIdx] = {
          ...pendings[pendIdx],
          applied: "Just updated",
          documents: pendingDocPayload
        };
      } else {
        pendings.unshift({
          id: expertId,
          name: expertName,
          field: "Senior Advisory",
          years: 25,
          applied: "Just now",
          company: "Enterprise Corp",
          role: "Senior Advisor",
          email: expertEmail,
          documents: pendingDocPayload
        });
      }
      if (!safeSetItem("mongo_pending_verifications", JSON.stringify(pendings))) {
        const lw: any = {
          expCert: mergedDocs.expCert ? { ...mergedDocs.expCert, fileData: undefined } : undefined,
          offerLetter: mergedDocs.offerLetter ? { ...mergedDocs.offerLetter, fileData: undefined } : undefined,
          resume: mergedDocs.resume ? { ...mergedDocs.resume, fileData: undefined } : undefined,
        };
        pendings[pendIdx >= 0 ? pendIdx : 0].documents!.items = lw;
        safeSetItem("mongo_pending_verifications", JSON.stringify(pendings));
      }
    } catch (e) {
      console.warn("Could not update mongo_pending_verifications:", e);
    }

    // Upload physical files to server storage so they are immediately accessible to Admin Desk
    if (typeof window !== "undefined") {
      const slots: Array<keyof typeof mergedDocs> = ["expCert", "offerLetter", "resume"];
      for (const s of slots) {
        const docItm = mergedDocs[s];
        if (docItm?.fileData && (docItm.fileData.startsWith("data:") || docItm.fileData.length > 50)) {
          fetch("/api/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: docItm.id,
              fileName: docItm.fileName,
              fileData: docItm.fileData,
              expertId,
              expertName,
              expertEmail,
              type: s
            })
          }).catch(() => {});
        }
      }
    }

    // Persist to server db asynchronously without blocking
    try {
      this.pushServerDb({
        expertDocuments: records,
        pendingVerifications: pendings
      }).catch(() => {});
    } catch {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("expert_documents_updated", { detail: record }));
      window.dispatchEvent(new CustomEvent("mongo_db_updated", { detail: { expertDocuments: records } }));
    }

    return record;
  }

  // Collection: Users (Authentication & Registration)
  public async getUsers(): Promise<UserDoc[]> {
    const raw = localStorage.getItem("mongo_users");
    return raw ? JSON.parse(raw) : SEED_USERS;
  }

  public async registerUser(userData: {
    role: "client" | "expert" | "admin";
    email: string;
    password?: string;
    name?: string;
    phone?: string;
    company?: string;
    title?: string;
    field?: string;
    bio?: string;
    years?: number;
    baseRate?: number;
  }): Promise<{ success: boolean; message: string; user?: UserDoc; token?: string; experts?: ExpertDoc[]; pendingVerifications?: PendingVerificationDoc[] }> {
    const cleanEmail = userData.email.trim().toLowerCase();
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.error || data.message || `Account already registered in MongoDB with email "${userData.email}". Please switch to Sign In!`
        };
      }

      // Sync local users cache
      const users = await this.getUsers();
      if (!users.some(u => u.email.toLowerCase() === cleanEmail)) {
        users.push(data.user);
        try { localStorage.setItem("mongo_users", JSON.stringify(users)); } catch {}
      }

      let expertsList = await this.getExperts();
      let pendingList = await this.getPendingVerifications();

      if (userData.role === "expert" && data.user.role === "expert") {
        try {
          const subRes = await this.submitExpertVerification({
            name: data.user.name,
            email: data.user.email,
            field: userData.field || "HR & Talent",
            years: userData.years ?? 25,
            title: userData.title || `Senior ${userData.field || "Executive"} Specialist`,
            company: userData.company || "Corporate Advisory Firm",
            baseRate: Math.max(0, Math.min(1000, userData.baseRate ?? 600)),
            phone: data.user.phone,
            bio: userData.bio || "Senior executive consultant.",
            verified: false,
            verificationStatus: "pending",
            rejected: false
          });
          expertsList = subRes.experts;
          pendingList = subRes.pendingVerifications;
        } catch {}
      }

      return {
        success: true,
        message: data.message || `Registration successful in MongoDB! Account created for ${cleanEmail}. Now you can Sign In.`,
        user: data.user,
        token: data.token,
        experts: expertsList,
        pendingVerifications: pendingList
      };
    } catch {
      // Offline fallback
      const users = await this.getUsers();
      const existing = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return {
          success: false,
          message: `Account already registered in MongoDB with email "${userData.email}". Please switch to Sign In!`
        };
      }

      const newUser: UserDoc = {
        id: `usr-${Date.now()}`,
        name: userData.name || (userData.role === "client" ? "New Client User" : "New Senior Expert"),
        email: cleanEmail,
        password: userData.password || "password123",
        phone: userData.phone || "+91 98765 43210",
        role: userData.role,
        company: userData.company,
        title: userData.title,
        field: userData.field || "Finance & Taxation",
        bio: userData.bio,
        initials: (userData.name || "User").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      try { localStorage.setItem("mongo_users", JSON.stringify(users)); } catch {}

      let expertsList = await this.getExperts();
      let pendingList = await this.getPendingVerifications();

      if (userData.role === "expert") {
        try {
          const subRes = await this.submitExpertVerification({
            name: newUser.name,
            email: newUser.email,
            field: userData.field || "HR & Talent",
            years: userData.years ?? 25,
            title: userData.title || `Senior ${userData.field || "Executive"} Specialist`,
            company: userData.company || "Corporate Advisory Firm",
            baseRate: Math.max(0, Math.min(1000, userData.baseRate ?? 600)),
            phone: newUser.phone,
            bio: userData.bio || "Senior executive consultant.",
            verified: false,
            verificationStatus: "pending",
            rejected: false
          });
          expertsList = subRes.experts;
          pendingList = subRes.pendingVerifications;
        } catch {}
      }

      return {
        success: true,
        message: `Registration successful in MongoDB! Account created for ${cleanEmail}. Now you can Sign In.`,
        user: newUser,
        experts: expertsList,
        pendingVerifications: pendingList
      };
    }
  }

  public async authenticateUser(email: string, password?: string): Promise<{ success: boolean; message: string; user?: UserDoc; token?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.error || data.message || `Authentication failed for ${email}`
        };
      }
      return {
        success: true,
        message: data.message || `Welcome back! Authenticated via MongoDB Database.`,
        user: data.user,
        token: data.token
      };
    } catch {
      // Offline fallback
      const users = await this.getUsers();
      const user = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (!user) {
        return {
          success: false,
          message: `No account registered in MongoDB with email "${email}". You MUST REGISTER FIRST before signing in!`
        };
      }

      if (password && user.password && user.password !== password) {
        return {
          success: false,
          message: `Incorrect password for ${email}. Please check your credentials.`
        };
      }

      return {
        success: true,
        message: `Authentication successful for ${email}! Signed in via MongoDB.`,
        user
      };
    }
  }

  public async verifyAdminSession(token?: string): Promise<{ authenticated: boolean; user?: any }> {
    const activeToken = token || localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token");
    if (!activeToken) return { authenticated: false };
    try {
      const res = await fetch("/api/auth/verify-admin", {
        headers: {
          "Authorization": `Bearer ${activeToken}`,
          "x-admin-token": activeToken
        }
      });
      const data = await res.json();
      return {
        authenticated: !!data.authenticated,
        user: data.user
      };
    } catch {
      return { authenticated: false };
    }
  }

  public async adminLogout(token?: string): Promise<boolean> {
    const activeToken = token || localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token");
    try {
      if (activeToken) {
        await fetch("/api/auth/admin-logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${activeToken}`,
            "x-admin-token": activeToken
          }
        });
      }
    } catch {}
    try {
      localStorage.removeItem("admin_token");
      sessionStorage.removeItem("admin_token");
    } catch {}
    return true;
  }

  public async getDeletedExpertKeys(): Promise<string[]> {
    const raw = localStorage.getItem("mongo_deleted_experts");
    return raw ? JSON.parse(raw) : [];
  }

  // Collection: Experts (Filtered against persistent blacklisted deleted experts)
  public async getExperts(): Promise<ExpertDoc[]> {
    const raw = localStorage.getItem("mongo_experts");
    let experts: ExpertDoc[] = raw ? JSON.parse(raw) : SEED_EXPERTS;
    const deletedKeys = await this.getDeletedExpertKeys();
    const pendings = await this.getPendingVerifications();

    // Sanitize experts: Anyone in pendingVerifications or with pending/rejected audit status MUST have verified: false
    let hasSanitized = false;
    experts = experts.map((e) => {
      const isInPendingList = pendings.some((p) =>
        p.id === e.id || p.name.toLowerCase().trim() === e.name.toLowerCase().trim()
      );
      const isPendingStatus =
        e.verificationStatus === "pending" ||
        e.documents?.status === "Pending Audit" ||
        e.verificationStatus === "rejected" ||
        (e as any).rejected === true;

      if ((isInPendingList || isPendingStatus) && e.verified === true) {
        hasSanitized = true;
        return {
          ...e,
          verified: false,
          verificationStatus: e.verificationStatus || "pending",
          documents: {
            ...(e.documents || {}),
            status: e.documents?.status === "Verified" ? "Pending Audit" : (e.documents?.status || "Pending Audit")
          }
        };
      }
      return e;
    });

    if (hasSanitized) {
      localStorage.setItem("mongo_experts", JSON.stringify(experts));
    }
    
    if (deletedKeys.length === 0) return experts;

    const filtered = experts.filter(e => 
      !deletedKeys.includes(e.id) && 
      !deletedKeys.includes(e.name.toLowerCase().trim())
    );

    // Keep localStorage synced with filtered experts
    localStorage.setItem("mongo_experts", JSON.stringify(filtered));
    return filtered;
  }

  public async saveExpertMarkup(id: string, base: number, markup: number): Promise<ExpertDoc[]> {
    const experts = await this.getExperts();
    const updated = experts.map((e) => {
      if (e.id === id) {
        return {
          ...e,
          baseRate: base,
          adminMarkup: markup,
          rate: base + markup,
        };
      }
      return e;
    });
    localStorage.setItem("mongo_experts", JSON.stringify(updated));
    await this.pushServerDb({ experts: updated });
    return updated;
  }

  public async toggleFeaturedOnLanding(id: string, featured?: boolean): Promise<ExpertDoc[]> {
    const experts = await this.getExperts();
    const updated = experts.map((e) => {
      if (e.id === id) {
        const nextState = featured !== undefined ? featured : !(e.featuredOnLanding ?? true);
        return { ...e, featuredOnLanding: nextState };
      }
      return e;
    });
    localStorage.setItem("mongo_experts", JSON.stringify(updated));
    await this.pushServerDb({ experts: updated });
    return updated;
  }

  public async updateHeroSpotlightCard(id: string, heroSpotlight: boolean, heroPosition?: "top" | "bottom"): Promise<ExpertDoc[]> {
    const experts = await this.getExperts();
    const updated: ExpertDoc[] = experts.map((e) => {
      if (e.id === id) {
        return {
          ...e,
          heroSpotlight,
          heroPosition: heroPosition || e.heroPosition || "top"
        };
      }
      // If setting position 'top', clear position top from others
      if (heroPosition === "top" && e.heroPosition === "top") {
        return { ...e, heroPosition: "extra" as const };
      }
      // If setting position 'bottom', clear position bottom from others
      if (heroPosition === "bottom" && e.heroPosition === "bottom") {
        return { ...e, heroPosition: "extra" as const };
      }
      return e;
    });
    localStorage.setItem("mongo_experts", JSON.stringify(updated));
    await this.pushServerDb({ experts: updated });
    return updated;
  }

  public async updateExpertProfile(id: string, data: Partial<ExpertDoc>): Promise<ExpertDoc[]> {
    const experts = await this.getExperts();
    const updated = experts.map((e) => {
      if (e.id === id) {
        return { ...e, ...data };
      }
      return e;
    });
    localStorage.setItem("mongo_experts", JSON.stringify(updated));
    await this.pushServerDb({ experts: updated });
    return updated;
  }

  // Admin Rights: Permanently Delete / Remove Expert from MongoDB & Blacklist from Re-appearing
  public async deleteExpert(idOrName: string): Promise<ExpertDoc[]> {
    const raw = localStorage.getItem("mongo_experts");
    const experts: ExpertDoc[] = raw ? JSON.parse(raw) : SEED_EXPERTS;
    const target = experts.find(e => e.id === idOrName || e.name.toLowerCase() === idOrName.toLowerCase());
    
    const deletedKeys = await this.getDeletedExpertKeys();
    if (target) {
      if (!deletedKeys.includes(target.id)) deletedKeys.push(target.id);
      if (!deletedKeys.includes(target.name.toLowerCase().trim())) deletedKeys.push(target.name.toLowerCase().trim());
    }
    if (!deletedKeys.includes(idOrName)) deletedKeys.push(idOrName);
    if (!deletedKeys.includes(idOrName.toLowerCase().trim())) deletedKeys.push(idOrName.toLowerCase().trim());

    localStorage.setItem("mongo_deleted_experts", JSON.stringify(deletedKeys));

    const updated = experts.filter(e => 
      e.id !== idOrName && 
      e.name.toLowerCase() !== idOrName.toLowerCase() && 
      (!target || e.id !== target.id)
    );
    localStorage.setItem("mongo_experts", JSON.stringify(updated));

    // Also remove from pending verifications if present
    const pendings = await this.getPendingVerifications();
    const updatedPendings = pendings.filter(p => p.id !== idOrName && p.name.toLowerCase() !== idOrName.toLowerCase());
    localStorage.setItem("mongo_pending_verifications", JSON.stringify(updatedPendings));

    await this.pushServerDb({
      experts: updated,
      deletedExperts: deletedKeys,
      pendingVerifications: updatedPendings
    });

    return updated;
  }

  // Admin Reject Pending Verification
  public async rejectPendingVerification(id: string): Promise<{ experts: ExpertDoc[]; pendingVerifications: PendingVerificationDoc[] }> {
    const pendings = await this.getPendingVerifications();
    const target = pendings.find(p => 
      p.id === id || 
      p.name.toLowerCase().trim() === id.toLowerCase().trim() || 
      (p.email && p.email.toLowerCase().trim() === id.toLowerCase().trim())
    );

    const targetEmail = target?.email?.toLowerCase().trim();
    const targetName = target?.name?.toLowerCase().trim();

    let deletedKeys = await this.getDeletedExpertKeys();
    if (id && !deletedKeys.includes(id)) deletedKeys.push(id);
    if (target) {
      if (target.id && !deletedKeys.includes(target.id)) deletedKeys.push(target.id);
      if (targetName && !deletedKeys.includes(targetName)) deletedKeys.push(targetName);
      if (targetEmail && !deletedKeys.includes(targetEmail)) deletedKeys.push(targetEmail);
    }
    localStorage.setItem("mongo_deleted_experts", JSON.stringify(deletedKeys));

    const updatedPendings = pendings.filter(p => 
      p.id !== id && 
      (!target || (
        p.id !== target.id &&
        (!targetName || p.name.toLowerCase().trim() !== targetName) &&
        (!targetEmail || (p.email && p.email.toLowerCase().trim() !== targetEmail))
      ))
    );
    localStorage.setItem("mongo_pending_verifications", JSON.stringify(updatedPendings));

    const rawExp = localStorage.getItem("mongo_experts");
    let allExperts: ExpertDoc[] = rawExp ? JSON.parse(rawExp) : SEED_EXPERTS;
    const updatedExperts = allExperts.map(e => {
      const eEmail = e.email?.toLowerCase().trim();
      const eName = e.name?.toLowerCase().trim();
      const isMatch = (
        e.id === id ||
        (eEmail && (eEmail === id.toLowerCase().trim() || (targetEmail && eEmail === targetEmail))) ||
        (eName && (eName === id.toLowerCase().trim() || (targetName && eName === targetName)))
      );
      if (isMatch) {
        return {
          ...e,
          verified: false,
          verificationStatus: "rejected",
          rejected: true,
          documents: {
            ...(e.documents || {}),
            status: "Rejected"
          }
        };
      }
      return e;
    });
    localStorage.setItem("mongo_experts", JSON.stringify(updatedExperts));

    // Also update in mongo_users
    try {
      const rawUsers = localStorage.getItem("mongo_users");
      if (rawUsers) {
        const users = JSON.parse(rawUsers);
        users.forEach((u: any) => {
          const uEmail = u.email?.toLowerCase().trim();
          const uName = u.name?.toLowerCase().trim();
          if (
            u.id === id ||
            (uEmail && (uEmail === id.toLowerCase().trim() || (targetEmail && uEmail === targetEmail))) ||
            (uName && (uName === id.toLowerCase().trim() || (targetName && uName === targetName)))
          ) {
            u.verified = false;
            u.verificationStatus = "rejected";
            u.rejected = true;
          }
        });
        localStorage.setItem("mongo_users", JSON.stringify(users));
      }
    } catch {}

    await this.pushServerDb({
      experts: updatedExperts,
      pendingVerifications: updatedPendings,
      deletedExperts: deletedKeys
    });

    return { experts: updatedExperts, pendingVerifications: updatedPendings };
  }

  // Admin Rights: Grant or Revoke Verification Status
  public async toggleExpertVerification(id: string, verified?: boolean): Promise<ExpertDoc[]> {
    const rawExp = localStorage.getItem("mongo_experts");
    let allExperts: ExpertDoc[] = rawExp ? JSON.parse(rawExp) : SEED_EXPERTS;
    let targetExp: ExpertDoc | null = null;

    const updated = allExperts.map(e => {
      if (e.id === id || e.name.toLowerCase().trim() === id.toLowerCase().trim() || (e.email && e.email.toLowerCase().trim() === id.toLowerCase().trim())) {
        const nextVerified = verified !== undefined ? verified : !e.verified;
        targetExp = e;
        return { 
          ...e, 
          verified: nextVerified,
          verificationStatus: nextVerified ? "approved" : "rejected",
          rejected: !nextVerified
        };
      }
      return e;
    });
    localStorage.setItem("mongo_experts", JSON.stringify(updated));

    if (targetExp && verified === false) {
      let deletedKeys = await this.getDeletedExpertKeys();
      if ((targetExp as any).id && !deletedKeys.includes((targetExp as any).id)) deletedKeys.push((targetExp as any).id);
      if ((targetExp as any).name && !deletedKeys.includes((targetExp as any).name.toLowerCase().trim())) deletedKeys.push((targetExp as any).name.toLowerCase().trim());
      if ((targetExp as any).email && !deletedKeys.includes((targetExp as any).email.toLowerCase().trim())) deletedKeys.push((targetExp as any).email.toLowerCase().trim());
      localStorage.setItem("mongo_deleted_experts", JSON.stringify(deletedKeys));
    } else if (targetExp && verified === true) {
      let deletedKeys = await this.getDeletedExpertKeys();
      const cleanKeys = deletedKeys.filter(k => 
        k !== (targetExp as any).id && 
        k !== (targetExp as any).name.toLowerCase().trim() && 
        k !== (targetExp as any).email?.toLowerCase().trim()
      );
      localStorage.setItem("mongo_deleted_experts", JSON.stringify(cleanKeys));
    }

    await this.pushServerDb({ experts: updated });
    return updated;
  }

  // Register or Update Expert Registration & Send to Document Audit Queue
  public async submitExpertVerification(expertData: {
    id?: string;
    name: string;
    email?: string;
    field?: string;
    years?: number;
    title?: string;
    company?: string;
    baseRate?: number;
    phone?: string;
    bio?: string;
    img?: string;
    verified?: boolean;
    verificationStatus?: string;
    rejected?: boolean;
  }): Promise<{ experts: ExpertDoc[]; pendingVerifications: PendingVerificationDoc[] }> {
    const rawExp = localStorage.getItem("mongo_experts");
    const experts: ExpertDoc[] = rawExp ? JSON.parse(rawExp) : SEED_EXPERTS;

    const rawPend = localStorage.getItem("mongo_pending_verifications");
    const pendings: PendingVerificationDoc[] = rawPend ? JSON.parse(rawPend) : SEED_PENDING_VERIFICATION;

    const cleanEmail = (expertData.email || "").trim().toLowerCase();
    const existingIndex = experts.findIndex(e => 
      (cleanEmail && e.email?.toLowerCase() === cleanEmail) || 
      e.name.toLowerCase() === expertData.name.toLowerCase() || 
      (expertData.id && e.id === expertData.id)
    );

    let expertId = expertData.id || `exp-${Date.now()}`;
    const isNew = existingIndex < 0;

    if (existingIndex >= 0) {
      expertId = experts[existingIndex].id;
      const base = expertData.baseRate !== undefined ? expertData.baseRate : (experts[existingIndex].baseRate || 600);
      const markup = experts[existingIndex].adminMarkup || 150;
      
      // Preserve existing verified status unless explicitly approved by Admin
      const currentVerified = expertData.verified !== undefined ? expertData.verified : (experts[existingIndex].verified === true);
      const currentStatus = currentVerified ? "approved" : (expertData.verificationStatus || (experts[existingIndex] as any).verificationStatus || "pending");
      const isRejected = expertData.rejected !== undefined ? expertData.rejected : ((experts[existingIndex] as any).rejected === true || currentStatus === "rejected");

      experts[existingIndex] = {
        ...experts[existingIndex],
        ...expertData,
        name: expertData.name || experts[existingIndex].name,
        email: cleanEmail || experts[existingIndex].email,
        field: expertData.field || experts[existingIndex].field || "HR & Talent",
        years: expertData.years !== undefined ? expertData.years : experts[existingIndex].years,
        title: expertData.title || experts[existingIndex].title || `Senior ${expertData.field || "Executive"} Specialist`,
        company: expertData.company || experts[existingIndex].company || "Industry Firm",
        baseRate: base,
        rate: base + markup,
        phone: expertData.phone || experts[existingIndex].phone || "+91 98765 43210",
        bio: expertData.bio || experts[existingIndex].bio || "Senior executive consultant.",
        img: expertData.img || experts[existingIndex].img || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
        initials: (expertData.name || experts[existingIndex].name).split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        verified: currentVerified,
        verificationStatus: currentStatus,
        rejected: isRejected,
        documents: {
          ...(experts[existingIndex].documents || {}),
          status: currentVerified ? "Verified" : (isRejected ? "Rejected" : "Pending Audit")
        }
      };
    } else {
      // NEW EXPERT: ALWAYS STARTS UNVERIFIED & PENDING ADMIN AUDIT!
      const newExpert: ExpertDoc = {
        id: expertId,
        name: expertData.name,
        field: expertData.field || "HR & Talent",
        years: expertData.years || 25,
        baseRate: Math.max(0, Math.min(1000, expertData.baseRate || 600)),
        adminMarkup: 150,
        rate: Math.max(0, Math.min(1000, expertData.baseRate || 600)) + 150,
        rating: 4.9,
        sessions: 0,
        verified: false,
        verificationStatus: "pending",
        rejected: false,
        initials: expertData.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        title: expertData.title || `Senior ${expertData.field || "Executive"} Specialist`,
        phone: expertData.phone || "+91 98765 43210",
        email: cleanEmail || `${expertData.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
        bio: expertData.bio || "Senior executive consultant.",
        company: expertData.company || "Industry Firm",
        skills: [expertData.field || "Corporate Advisory", "Executive Leadership"],
        experience: [{ role: expertData.title || "Executive", company: expertData.company || "Leading Firm", period: "1995 – 2024" }],
        education: `Degree in ${expertData.field || "Management"}`,
        img: expertData.img || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
        featuredOnLanding: false,
        documents: {
          expCert: `${expertData.name.replace(/\s+/g, "_")}_Work_Experience.pdf`,
          offerLetter: `${expertData.name.replace(/\s+/g, "_")}_Offer_Letter.pdf`,
          resume: `${expertData.name.replace(/\s+/g, "_")}_Executive_CV.pdf`,
          submittedDate: new Date().toISOString().split("T")[0],
          status: "Pending Audit"
        }
      };
      experts.push(newExpert);
    }
    localStorage.setItem("mongo_experts", JSON.stringify(experts));

    // Sync changes into mongo_users collection
    try {
      const rawUsers = localStorage.getItem("mongo_users");
      if (rawUsers) {
        const users = JSON.parse(rawUsers);
        const userIdx = users.findIndex((u: any) => 
          (cleanEmail && u.email.toLowerCase() === cleanEmail) || 
          (expertData.name && u.name.toLowerCase() === expertData.name.toLowerCase())
        );
        if (userIdx >= 0) {
          users[userIdx] = {
            ...users[userIdx],
            name: expertData.name || users[userIdx].name,
            title: expertData.title || users[userIdx].title,
            field: expertData.field || users[userIdx].field,
            bio: expertData.bio || users[userIdx].bio,
            phone: expertData.phone || users[userIdx].phone,
            company: expertData.company || users[userIdx].company,
            initials: (expertData.name || users[userIdx].name).split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
          };
          localStorage.setItem("mongo_users", JSON.stringify(users));
        }
      }
    } catch {}

    // If expert is not verified, add or ensure in mongo_pending_verifications (Document Audit & Verification Queue)
    const targetExpert = experts.find(e => (e.id === expertId) || (cleanEmail && e.email?.toLowerCase() === cleanEmail) || (e.name.toLowerCase() === expertData.name.toLowerCase()));
    if (!targetExpert || targetExpert.verified !== true) {
      const pendIndex = pendings.findIndex(p => p.name.toLowerCase() === expertData.name.toLowerCase() || p.id === expertId || (cleanEmail && p.email?.toLowerCase() === cleanEmail));
      const pendingDoc: PendingVerificationDoc = {
        id: expertId,
        name: expertData.name,
        email: cleanEmail || targetExpert?.email,
        field: expertData.field || "HR & Talent",
        years: expertData.years || 25,
        applied: "Just Now (Submitted via Expert Portal)",
        company: expertData.company || expertData.title || "Senior Advisory Firm",
        role: expertData.title || `Senior ${expertData.field || "Executive"} Specialist`,
        documents: {
          expCert: `${expertData.name.replace(/\s+/g, "_")}_Work_Experience.pdf`,
          offerLetter: `${expertData.name.replace(/\s+/g, "_")}_Offer_Letter.pdf`,
          resume: `${expertData.name.replace(/\s+/g, "_")}_Executive_CV.pdf`
        }
      };

      if (pendIndex >= 0) {
        pendings[pendIndex] = pendingDoc;
      } else {
        pendings.unshift(pendingDoc);
      }
      localStorage.setItem("mongo_pending_verifications", JSON.stringify(pendings));
    }

    await this.pushServerDb({
      experts,
      pendingVerifications: pendings
    });

    return { experts, pendingVerifications: pendings };
  }

  // Move / Demote Expert from Active Client View into the Document Audit & Verification Queue
  public async demoteExpertToAuditQueue(idOrName: string): Promise<{ experts: ExpertDoc[]; pendingVerifications: PendingVerificationDoc[] }> {
    const rawExp = localStorage.getItem("mongo_experts");
    let experts: ExpertDoc[] = rawExp ? JSON.parse(rawExp) : SEED_EXPERTS;
    const pendings = await this.getPendingVerifications();

    const target = experts.find(e => 
      e.id === idOrName || 
      e.name.toLowerCase().trim() === idOrName.toLowerCase().trim() ||
      (e.email && e.email.toLowerCase().trim() === idOrName.toLowerCase().trim())
    );
    
    if (target) {
      // 1. Mark verified: false, verificationStatus: "pending", rejected: false in mongo_experts
      const updatedExperts = experts.map(e => {
        if (e.id === target.id || e.name.toLowerCase().trim() === target.name.toLowerCase().trim() || (target.email && e.email?.toLowerCase().trim() === target.email.toLowerCase().trim())) {
          return { ...e, verified: false, verificationStatus: "pending", rejected: false };
        }
        return e;
      });
      localStorage.setItem("mongo_experts", JSON.stringify(updatedExperts));

      // 2. Add / Move expert entry into mongo_pending_verifications queue
      const existingInPending = pendings.find(p => p.id === target.id || p.name.toLowerCase().trim() === target.name.toLowerCase().trim() || (target.email && p.email?.toLowerCase().trim() === target.email.toLowerCase().trim()));
      if (!existingInPending) {
        const newPendingItem: PendingVerificationDoc = {
          id: target.id || `ver-${Date.now()}`,
          name: target.name,
          email: target.email,
          field: target.field,
          years: target.years || 25,
          applied: "Demoted to Audit Queue by Admin",
          company: target.company || "Corporate Industry Leader",
          role: target.title || `Senior ${target.field} Specialist`,
          documents: {
            expCert: target.documents?.expCert || `${target.name.replace(/\s+/g, "_")}_Work_Cert.pdf`,
            offerLetter: target.documents?.offerLetter || `${target.name.replace(/\s+/g, "_")}_Offer_Letter.pdf`,
            resume: target.documents?.resume || `${target.name.replace(/\s+/g, "_")}_CV.pdf`
          }
        };
        pendings.push(newPendingItem);
        localStorage.setItem("mongo_pending_verifications", JSON.stringify(pendings));
      }

      // 3. Clear from deleted keys so they appear as pending audit
      const deletedKeys = await this.getDeletedExpertKeys();
      const cleanDeletedKeys = deletedKeys.filter(k => 
        k !== target.id && 
        k !== target.name.toLowerCase().trim() && 
        (!target.email || k !== target.email.toLowerCase().trim())
      );
      localStorage.setItem("mongo_deleted_experts", JSON.stringify(cleanDeletedKeys));

      await this.pushServerDb({ 
        experts: updatedExperts, 
        pendingVerifications: pendings,
        deletedExperts: cleanDeletedKeys
      });
      return { experts: updatedExperts, pendingVerifications: pendings };
    }

    return { experts, pendingVerifications: pendings };
  }

  // Admin Verification Approval: Permanently removes from pending queue and adds verified expert in MongoDB
  public async approvePendingVerification(item: any): Promise<{ experts: ExpertDoc[]; pendingVerifications: PendingVerificationDoc[] }> {
    const rawExp = localStorage.getItem("mongo_experts");
    let experts: ExpertDoc[] = rawExp ? JSON.parse(rawExp) : SEED_EXPERTS;
    const pendings = await this.getPendingVerifications();

    const itemEmail = (item.email || "").toLowerCase().trim();
    const itemName = (item.name || "").toLowerCase().trim();
    const itemId = item.id || "";

    // 1. Permanently remove from pending audit queue
    const updatedPendings = pendings.filter(p => 
      p.id !== itemId && 
      (!itemName || p.name.toLowerCase().trim() !== itemName) &&
      (!itemEmail || (p.email && p.email.toLowerCase().trim() !== itemEmail))
    );
    localStorage.setItem("mongo_pending_verifications", JSON.stringify(updatedPendings));

    // Remove from deleted keys if previously deleted
    const deletedKeys = await this.getDeletedExpertKeys();
    const cleanDeletedKeys = deletedKeys.filter(k => 
      k !== itemId && 
      (!itemName || k !== itemName) &&
      (!itemEmail || k !== itemEmail)
    );
    localStorage.setItem("mongo_deleted_experts", JSON.stringify(cleanDeletedKeys));

    // 2. Add or update expert in mongo_experts with verified status
    const existingIndex = experts.findIndex(e => 
      (itemId && e.id === itemId) || 
      (itemEmail && e.email?.toLowerCase().trim() === itemEmail) ||
      (itemName && e.name.toLowerCase().trim() === itemName)
    );
    
    if (existingIndex >= 0) {
      experts[existingIndex] = {
        ...experts[existingIndex],
        email: experts[existingIndex].email || itemEmail,
        verified: true,
        verificationStatus: "approved",
        rejected: false,
        featuredOnLanding: true,
        documents: {
          expCert: item.documents?.expCert || experts[existingIndex].documents?.expCert || "Work_Cert.pdf",
          offerLetter: item.documents?.offerLetter || experts[existingIndex].documents?.offerLetter || "Offer_Letter.pdf",
          resume: item.documents?.resume || experts[existingIndex].documents?.resume || "Resume.pdf",
          submittedDate: new Date().toISOString().split("T")[0],
          status: "Verified"
        }
      };
    } else {
      let userEmail = itemEmail;
      try {
        const rawUsers = localStorage.getItem("mongo_users");
        if (rawUsers) {
          const users = JSON.parse(rawUsers);
          const u = users.find((u: any) => u.id === itemId || (itemName && u.name && u.name.toLowerCase().trim() === itemName));
          if (u?.email) userEmail = u.email;
        }
      } catch {}

      const DEFAULT_APPROVAL_PHOTOS: Record<string, string> = {
        "Deepak Nair": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
        "Lakshmi Pillai": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
        "George Thomas": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80",
      };

      const newExpert: ExpertDoc = {
        id: itemId.startsWith("exp-") ? itemId : `exp-${Date.now()}`,
        name: item.name,
        field: item.field || "Corporate Advisory",
        years: item.years || 25,
        baseRate: 600,
        adminMarkup: 150,
        rate: 750,
        rating: 4.9,
        sessions: 12,
        verified: true,
        verificationStatus: "approved",
        rejected: false,
        initials: item.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        title: item.role || `Senior ${item.field || "Corporate"} Specialist`,
        phone: item.phone || "+91 98000 11223",
        email: userEmail || itemEmail || `${item.name.toLowerCase().replace(/\s+/g, ".")}@registry.com`,
        bio: item.bio || `Verified senior executive in ${item.field} with ${item.years} years of leadership at ${item.company || "leading firms"}.`,
        company: item.company,
        skills: [item.field, "Corporate Advisory", "Executive Leadership"],
        experience: [{ role: item.role || "Executive Director", company: item.company || "Industry Leader", period: "1995 – 2024" }],
        education: `Degree in ${item.field}`,
        img: item.img || DEFAULT_APPROVAL_PHOTOS[item.name] || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
        featuredOnLanding: true,
        documents: {
          expCert: item.documents?.expCert || "Work_Cert.pdf",
          offerLetter: item.documents?.offerLetter || "Offer_Letter.pdf",
          resume: item.documents?.resume || "Resume.pdf",
          submittedDate: new Date().toISOString().split("T")[0],
          status: "Verified"
        }
      };
      experts.push(newExpert);
    }

    localStorage.setItem("mongo_experts", JSON.stringify(experts));

    // Also sync to mongo_users
    try {
      const rawUsers = localStorage.getItem("mongo_users");
      if (rawUsers) {
        const users = JSON.parse(rawUsers);
        let userChanged = false;
        users.forEach((u: any) => {
          if (
            (itemId && u.id === itemId) ||
            (itemEmail && u.email?.toLowerCase().trim() === itemEmail) ||
            (itemName && u.name?.toLowerCase().trim() === itemName)
          ) {
            u.verified = true;
            u.verificationStatus = "approved";
            u.rejected = false;
            userChanged = true;
          }
        });
        if (userChanged) {
          localStorage.setItem("mongo_users", JSON.stringify(users));
        }
      }
    } catch {}

    await this.pushServerDb({
      experts,
      pendingVerifications: updatedPendings,
      deletedExperts: cleanDeletedKeys
    });
    return { experts, pendingVerifications: updatedPendings };
  }

  // ChatGPT AI Expert Matcher & Search (Sorted by Highest Rating DESC & Lowest Price ASC)
  public async searchAndRankExperts(query: string): Promise<ExpertDoc[]> {
    const allExperts = await this.getExperts();
    const experts = allExperts.filter(e => e.verified === true && e.verificationStatus !== "rejected" && !e.rejected);
    const q = query.toLowerCase().trim();
    if (!q) return experts.sort((a, b) => b.rating !== a.rating ? b.rating - a.rating : a.rate - b.rate);

    // Expand search keywords with domain synonyms
    const keywords: string[] = [q];
    
    if (/math|maths|teacher|pedagogy|school|tuition|geometry|algebra|calculus/i.test(q)) {
      keywords.push("school mathematics", "mathematics", "math", "pedagogy");
    }
    if (/civil|construction|building|structure|l&t|infrastructure|engineer/i.test(q)) {
      keywords.push("civil engineering", "construction", "l&t");
    }
    if (/bank|banking|credit|sbi|loan|deposit|finance/i.test(q)) {
      keywords.push("banking & credit", "banking", "sbi", "finance");
    }
    if (/tax|taxation|cfo|gst|audit|valuation|esop|accounting|tata/i.test(q)) {
      keywords.push("finance & taxation", "cfo", "tax", "gst");
    }
    if (/legal|law|advocate|court|sha|ssa|contract|ip|khaitan/i.test(q)) {
      keywords.push("legal & compliance", "legal", "advocate");
    }
    if (/hr|human|talent|posh|recruiting|appraisal|wipro|infosys/i.test(q)) {
      keywords.push("hr & talent", "hr", "posh");
    }
    if (/marketing|brand|d2c|fmcg|unilever|advertising|growth/i.test(q)) {
      keywords.push("marketing strategy", "brand", "marketing");
    }
    if (/manufacturing|plant|factory|supply|logistics|mahindra|lean/i.test(q)) {
      keywords.push("manufacturing ops", "supply chain", "plant");
    }
    if (/textile|mill|arvind|fabric|garment/i.test(q)) {
      keywords.push("textile manufacturing", "textile");
    }

    const matched = experts.filter((e) => {
      const textToSearch = [
        e.name,
        e.field,
        e.title,
        e.bio,
        e.company || "",
        e.education || "",
        ...(e.skills || [])
      ].join(" ").toLowerCase();

      return keywords.some(kw => textToSearch.includes(kw));
    });

    // Strictly return matched items (or empty array if not available in MongoDB)
    return matched.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating; // Highest rating first
      }
      return a.rate - b.rate; // Lowest client price first
    });
  }

  /* --------------------------------------------------------------------------
     EXPERT AVAILABILITY MANAGEMENT METHODS
  -------------------------------------------------------------------------- */
  public async getAvailabilities(expertId?: string, date?: string): Promise<ExpertAvailabilityDoc[]> {
    try {
      // 1. Try fetching from server endpoint
      const params = new URLSearchParams();
      if (expertId) params.append("expertId", expertId);
      if (date) params.append("date", date);
      const url = `/api/availability${params.toString() ? `?${params.toString()}` : ""}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.availabilities)) {
          // Update local cache
          const currentAll = this.getLocalAvailabilities();
          const serverList: ExpertAvailabilityDoc[] = data.availabilities;
          const mergedMap = new Map<string, ExpertAvailabilityDoc>();
          currentAll.forEach(a => mergedMap.set(a.id, a));
          serverList.forEach(a => mergedMap.set(a.id, a));
          localStorage.setItem("mongo_availabilities", JSON.stringify(Array.from(mergedMap.values())));
          return serverList;
        }
      }
    } catch {}

    // Fallback to local storage
    const all = this.getLocalAvailabilities();
    return all.filter(a => {
      if (expertId && a.expertId !== expertId) return false;
      if (date && a.availabilityDate !== date) return false;
      return true;
    });
  }

  public getLocalAvailabilities(expertId?: string): ExpertAvailabilityDoc[] {
    let list: ExpertAvailabilityDoc[] = SEED_AVAILABILITIES;
    try {
      const raw = localStorage.getItem("mongo_availabilities");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      }
    } catch {}
    if (expertId) {
      const filtered = list.filter(a => a.expertId === expertId);
      const todayStr = new Date().toISOString().split("T")[0];
      const hasUpcoming = filtered.some(a => a.availabilityDate >= todayStr && a.status !== "DISABLED");
      if (!hasUpcoming) {
        const seedUpcoming = SEED_AVAILABILITIES.filter(a => a.expertId === expertId && a.availabilityDate >= todayStr);
        if (seedUpcoming.length > 0) {
          const merged = [...list.filter(a => !seedUpcoming.some(s => s.id === a.id)), ...seedUpcoming];
          try {
            localStorage.setItem("mongo_availabilities", JSON.stringify(merged));
          } catch {}
          return [...filtered, ...seedUpcoming];
        }
      }
      return filtered;
    }
    return list;
  }

  public async saveAvailability(slot: Partial<ExpertAvailabilityDoc>): Promise<ExpertAvailabilityDoc> {
    try {
      const isNew = !slot.id;
      const res = await fetch(isNew ? "/api/availability" : `/api/availability/${slot.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slot)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.availability) {
          this.updateLocalAvailability(data.availability);
          return data.availability;
        }
      }
    } catch {}

    // Local fallback
    const all = this.getLocalAvailabilities();
    const now = new Date().toISOString();
    let savedDoc: ExpertAvailabilityDoc;

    if (slot.id) {
      const idx = all.findIndex(a => a.id === slot.id);
      if (idx !== -1) {
        savedDoc = {
          ...all[idx],
          ...slot,
          updatedAt: now
        } as ExpertAvailabilityDoc;
        all[idx] = savedDoc;
      } else {
        savedDoc = {
          id: slot.id,
          expertId: slot.expertId || "",
          availabilityDate: slot.availabilityDate || "",
          startTime: slot.startTime || "",
          endTime: slot.endTime || "",
          status: slot.status || "AVAILABLE",
          bookingId: slot.bookingId || null,
          clientId: slot.clientId || null,
          clientName: slot.clientName || null,
          createdAt: slot.createdAt || now,
          updatedAt: now
        };
        all.push(savedDoc);
      }
    } else {
      savedDoc = {
        id: `avail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        expertId: slot.expertId || "",
        availabilityDate: slot.availabilityDate || "",
        startTime: slot.startTime || "",
        endTime: slot.endTime || "",
        status: slot.status || "AVAILABLE",
        bookingId: slot.bookingId || null,
        clientId: slot.clientId || null,
        clientName: slot.clientName || null,
        createdAt: now,
        updatedAt: now
      };
      all.push(savedDoc);
    }

    localStorage.setItem("mongo_availabilities", JSON.stringify(all));
    this.pushServerDb({ availabilities: all });
    return savedDoc;
  }

  public async saveMultipleAvailabilities(
    expertId: string,
    date: string,
    slots: Array<{ startTime: string; endTime: string; status?: "AVAILABLE" | "BOOKED" | "DISABLED" }>
  ): Promise<ExpertAvailabilityDoc[]> {
    try {
      const res = await fetch("/api/availability/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId, availabilityDate: date, slots })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.availabilities)) {
          data.availabilities.forEach((a: ExpertAvailabilityDoc) => this.updateLocalAvailability(a));
          return data.availabilities;
        }
      }
    } catch {}

    // Local fallback
    const results: ExpertAvailabilityDoc[] = [];
    for (const slot of slots) {
      const saved = await this.saveAvailability({
        expertId,
        availabilityDate: date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status || "AVAILABLE"
      });
      results.push(saved);
    }
    return results;
  }

  public async deleteAvailability(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/availability/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.removeLocalAvailability(id);
          return true;
        }
      }
    } catch {}

    // Local fallback
    this.removeLocalAvailability(id);
    const all = this.getLocalAvailabilities();
    this.pushServerDb({ availabilities: all });
    return true;
  }

  public async bookAvailability(
    slotId: string,
    bookingDetails: { bookingId: string; clientId?: string; clientName?: string; expertId?: string }
  ): Promise<{ success: boolean; error?: string; availability?: ExpertAvailabilityDoc }> {
    try {
      const res = await fetch("/api/availability/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, ...bookingDetails })
      });
      const data = await res.json();
      if (res.ok && data.success && data.availability) {
        this.updateLocalAvailability(data.availability);
        return { success: true, availability: data.availability };
      } else {
        return { success: false, error: data.error || "Slot is not available" };
      }
    } catch (err: any) {
      // Local fallback atomic check
      const all = this.getLocalAvailabilities();
      const slot = all.find(a => a.id === slotId);
      if (!slot) {
        return { success: false, error: "Availability slot not found" };
      }
      if (slot.status !== "AVAILABLE") {
        return { success: false, error: `Slot is already ${slot.status.toLowerCase()}` };
      }

      slot.status = "BOOKED";
      slot.bookingId = bookingDetails.bookingId;
      slot.clientId = bookingDetails.clientId || null;
      slot.clientName = bookingDetails.clientName || null;
      slot.updatedAt = new Date().toISOString();

      localStorage.setItem("mongo_availabilities", JSON.stringify(all));
      this.pushServerDb({ availabilities: all });
      return { success: true, availability: slot };
    }
  }

  private updateLocalAvailability(slot: ExpertAvailabilityDoc) {
    const all = this.getLocalAvailabilities();
    const idx = all.findIndex(a => a.id === slot.id);
    if (idx !== -1) {
      all[idx] = slot;
    } else {
      all.push(slot);
    }
    localStorage.setItem("mongo_availabilities", JSON.stringify(all));
    this.notify({ availabilities: all });
  }

  private removeLocalAvailability(id: string) {
    const all = this.getLocalAvailabilities().filter(a => a.id !== id);
    localStorage.setItem("mongo_availabilities", JSON.stringify(all));
    this.notify({ availabilities: all });
  }

  // -------------------------------------------------------------
  // Dedicated Project Review Methods (WORKFLOW B)
  // -------------------------------------------------------------

  public async getProjectReviews(params?: {
    id?: string;
    clientId?: string;
    clientEmail?: string;
    clientName?: string;
    expertId?: string;
    expertEmail?: string;
    expertName?: string;
    status?: string;
    role?: string;
    includeArchived?: boolean;
  }): Promise<ProjectReviewRecord[]> {
    try {
      const qs = new URLSearchParams();
      if (params?.id) qs.set("id", params.id);
      if (params?.clientId) qs.set("clientId", params.clientId);
      if (params?.clientEmail) qs.set("clientEmail", params.clientEmail);
      if (params?.clientName) qs.set("clientName", params.clientName);
      if (params?.expertId) qs.set("expertId", params.expertId);
      if (params?.expertEmail) qs.set("expertEmail", params.expertEmail);
      if (params?.expertName) qs.set("expertName", params.expertName);
      if (params?.status) qs.set("status", params.status);
      if (params?.role) qs.set("role", params.role);
      if (params?.includeArchived) qs.set("includeArchived", "true");

      const res = await fetch(`/api/project-reviews?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.projectReview) return [data.projectReview];
          if (Array.isArray(data.projectReviews)) return data.projectReviews;
        }
      }
    } catch (e) {
      console.error("[MongoDBService] getProjectReviews error:", e);
    }
    return [];
  }

  public async getProjectReview(id: string): Promise<ProjectReviewRecord | null> {
    const list = await this.getProjectReviews({ id });
    return list.length > 0 ? list[0] : null;
  }

  public async requestProjectReview(data: {
    clientId: string;
    clientName: string;
    clientEmail: string;
    expertId: string;
    expertName: string;
    expertEmail: string;
    expectedScope?: string;
    reviewType?: string;
    requestNotes?: string;
    clientWalletBalance?: number;
  }): Promise<{ success: boolean; projectReview?: ProjectReviewRecord; clientWalletBalance?: number; error?: string }> {
    try {
      const res = await fetch("/api/project-reviews/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, projectReview: result.projectReview, clientWalletBalance: result.clientWalletBalance };
      }
      return { success: false, error: result.error || "Failed to create Project Review request", projectReview: result.projectReview };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async respondProjectReview(
    id: string,
    action: "accept" | "decline",
    responder?: { id?: string; role?: string; reason?: string }
  ): Promise<{ success: boolean; projectReview?: ProjectReviewRecord; clientWalletBalance?: number; error?: string }> {
    try {
      const res = await fetch(`/api/project-reviews/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...responder })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, projectReview: result.projectReview, clientWalletBalance: result.clientWalletBalance };
      }
      return { success: false, error: result.error || "Failed to update response" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async payProjectReview(
    id: string,
    paymentMethod: "wallet" | "razorpay" = "wallet",
    transactionId?: string
  ): Promise<{ success: boolean; projectReview?: ProjectReviewRecord; error?: string }> {
    try {
      const res = await fetch(`/api/project-reviews/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod, transactionId })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, projectReview: result.projectReview };
      }
      return { success: false, error: result.error || "Payment processing failed" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async submitProjectMaterials(
    id: string,
    submission: {
      description: string;
      questions?: string;
      repositoryUrl?: string;
      demoUrl?: string;
      files?: Array<{ name: string; url: string; size?: string; uploadedAt: string }>;
    }
  ): Promise<{ success: boolean; projectReview?: ProjectReviewRecord; error?: string }> {
    try {
      const res = await fetch(`/api/project-reviews/${id}/submit-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission)
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, projectReview: result.projectReview };
      }
      return { success: false, error: result.error || "Failed to submit project materials" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async sendProjectReviewChat(
    id: string,
    message: {
      senderId: string;
      senderRole: "client" | "expert" | "admin" | "system";
      senderName: string;
      content: string;
      attachmentUrl?: string;
      attachmentName?: string;
    }
  ): Promise<{ success: boolean; message?: any; projectReview?: ProjectReviewRecord; error?: string }> {
    try {
      const res = await fetch(`/api/project-reviews/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, message: result.message, projectReview: result.projectReview };
      }
      return { success: false, error: result.error || "Failed to send chat message" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async proposeProjectReviewTime(
    id: string,
    proposal: {
      proposedBy: "client" | "expert";
      date: string;
      startTime: string;
      endTime: string;
      durationMinutes?: number;
      reason?: string;
    }
  ): Promise<{ success: boolean; projectReview?: ProjectReviewRecord; error?: string }> {
    try {
      const res = await fetch(`/api/project-reviews/${id}/propose-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal)
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, projectReview: result.projectReview };
      }
      return { success: false, error: result.error || "Failed to propose meeting time" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async respondProjectReviewTime(
    id: string,
    proposedTimeId: string,
    action: "accept" | "decline",
    responderRole?: string
  ): Promise<{ success: boolean; projectReview?: ProjectReviewRecord; error?: string }> {
    try {
      const res = await fetch(`/api/project-reviews/${id}/respond-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedTimeId, action, responderRole })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, projectReview: result.projectReview };
      }
      return { success: false, error: result.error || "Failed to respond to meeting proposal" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async sendProjectReviewMeetLink(
    id: string,
    meetingId: string,
    googleMeetLink: string
  ): Promise<{ success: boolean; projectReview?: ProjectReviewRecord; meeting?: any; error?: string }> {
    try {
      const res = await fetch(`/api/project-reviews/${id}/send-meet-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, googleMeetLink })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, projectReview: result.projectReview, meeting: result.meeting };
      }
      return { success: false, error: result.error || "Failed to send Google Meet link" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async completeProjectReviewMeeting(
    id: string,
    meetingId: string
  ): Promise<{ success: boolean; projectReview?: ProjectReviewRecord; meeting?: any; error?: string }> {
    try {
      const res = await fetch(`/api/project-reviews/${id}/complete-meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, projectReview: result.projectReview, meeting: result.meeting };
      }
      return { success: false, error: result.error || "Failed to mark meeting complete" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async completeProjectReview(
    id: string,
    feedback: {
      summary?: string;
      recommendations?: string[];
      strengths?: string;
      issues?: string;
    }
  ): Promise<{ success: boolean; projectReview?: ProjectReviewRecord; error?: string }> {
    try {
      const res = await fetch(`/api/project-reviews/${id}/complete-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedback)
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, projectReview: result.projectReview };
      }
      return { success: false, error: result.error || "Failed to complete Project Review" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async archiveProjectReview(
    id: string,
    role: "client" | "expert"
  ): Promise<{ success: boolean; projectReview?: ProjectReviewRecord; error?: string }> {
    try {
      const res = await fetch(`/api/project-reviews/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        this.notifyProjectReviewUpdated(result.projectReview);
        return { success: true, projectReview: result.projectReview };
      }
      return { success: false, error: result.error || "Failed to archive Project Review" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }


  // Project Review Pricing & Platform Fee Methods
  public async getProjectReviewPricing(expertId?: string, all?: boolean, role?: string): Promise<{
    success: boolean;
    expertId?: string;
    expertName?: string;
    projectRate?: number;
    platformFee?: number;
    clientPrice?: number;
    experts?: Array<{ id: string; name: string; projectRate: number; platformFee?: number; clientPrice?: number; field?: string; rate?: number; baseRate?: number; updatedAt?: string }>;
    platformFeeConfig?: any;
    error?: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (expertId) params.append("expertId", expertId);
      if (all) params.append("all", "true");
      if (role) params.append("role", role);
      const res = await fetch(`/api/project-reviews/pricing?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const pCfg = data.platformFeeConfig || data.platformChargeConfig || data.platformCharge;
        if (pCfg && typeof window !== "undefined") {
          localStorage.setItem("mongo_project_review_config", JSON.stringify(pCfg));
          localStorage.setItem("mongo_platform_charge", JSON.stringify(pCfg));
        }
        return data;
      }
      return { success: false, error: "Failed to fetch pricing" };
    } catch (e: any) {
      let cachedFee = 200;
      let cachedFeeType: 'fixed' | 'percentage' = 'fixed';
      try {
        const c = typeof window !== 'undefined' ? (localStorage.getItem('mongo_platform_charge') || localStorage.getItem('mongo_project_review_config')) : null;
        if (c) {
          const p = JSON.parse(c);
          if (typeof p.feeValue === 'number') cachedFee = p.feeValue;
          if (p.feeType) cachedFeeType = p.feeType;
        }
      } catch {}

      const experts = await this.getExperts();
      if (expertId) {
        const exp = experts.find(e => e.id === expertId);
        const rate = typeof exp?.projectRate === "number" ? exp.projectRate : (exp ? Math.min(2000, exp.rate * 3) : 1000);
        const fee = cachedFeeType === 'fixed' ? cachedFee : Math.round(rate * (cachedFee / 100));
        return { success: true, expertId, projectRate: rate, platformFee: fee, clientPrice: rate + fee, expertName: exp?.name, platformFeeConfig: { feeType: cachedFeeType, feeValue: cachedFee } };
      }
      return {
        success: true,
        platformFeeConfig: { feeType: cachedFeeType, feeValue: cachedFee },
        experts: experts.map(e => {
          const rate = typeof e.projectRate === "number" ? e.projectRate : Math.min(2000, e.rate * 3);
          const fee = cachedFeeType === 'fixed' ? cachedFee : Math.round(rate * (cachedFee / 100));
          return {
            id: e.id,
            name: e.name,
            projectRate: rate,
            platformFee: fee,
            clientPrice: rate + fee
          };
        })
      };
    }
  }

  public async updateProjectReviewPrice(
    expertId: string,
    price: number,
    role: "expert" | "admin" = "expert",
    userId?: string,
    userEmail?: string
  ): Promise<{ success: boolean; projectRate?: number; platformFee?: number; clientPrice?: number; message?: string; error?: string }> {
    if (price < 0 || price > 2000 || typeof price !== "number" || isNaN(price)) {
      return { success: false, error: "Project Review price must be between ₹0 and ₹2,000." };
    }
    try {
      const res = await fetch("/api/project-reviews/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId, projectRate: price, role, userId, userEmail })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const experts = await this.getExperts();
        const updated = experts.map(e => e.id === expertId ? { ...e, projectRate: data.projectRate } : e);
        localStorage.setItem("mongo_experts", JSON.stringify(updated));
        this.notifyProjectReviewUpdated();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("mongo_db_updated"));
        }
        return data;
      }
      return { success: false, error: data.error || "Failed to update Project Review price" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async getPlatformSettings(): Promise<{ success: boolean; config?: any; platformCharge?: any; error?: string }> {
    try {
      const res = await fetch("/api/platform-settings");
      if (res.ok) {
        const data = await res.json();
        const cfg = data.platformCharge || data.config;
        if (cfg && typeof window !== "undefined") {
          localStorage.setItem("mongo_platform_charge", JSON.stringify(cfg));
          localStorage.setItem("mongo_project_review_config", JSON.stringify(cfg));
        }
        return data;
      }
      return this.getProjectReviewPlatformFee();
    } catch {
      return this.getProjectReviewPlatformFee();
    }
  }

  public async getProjectReviewPlatformFee(): Promise<{ success: boolean; config?: any; platformCharge?: any; error?: string }> {
    try {
      const res = await fetch("/api/project-reviews/platform-fee?role=admin");
      if (res.ok) {
        const data = await res.json();
        const cfg = data.config || data.platformCharge;
        if (cfg && typeof window !== "undefined") {
          localStorage.setItem("mongo_project_review_config", JSON.stringify(cfg));
          localStorage.setItem("mongo_platform_charge", JSON.stringify(cfg));
        }
        return data;
      }
      const cached = typeof window !== "undefined"
        ? (localStorage.getItem("mongo_platform_charge") || localStorage.getItem("mongo_project_review_config"))
        : null;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return { success: true, config: parsed, platformCharge: parsed };
        } catch {}
      }
      return { success: false, error: "Failed to fetch platform fee" };
    } catch (e: any) {
      const cached = typeof window !== "undefined"
        ? (localStorage.getItem("mongo_platform_charge") || localStorage.getItem("mongo_project_review_config"))
        : null;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return { success: true, config: parsed, platformCharge: parsed };
        } catch {}
      }
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async updatePlatformSettings(
    feeType: "percentage" | "fixed",
    feeValue: number,
    userId: string = "admin-governance"
  ): Promise<{ success: boolean; config?: any; platformCharge?: any; message?: string; error?: string }> {
    return this.updateProjectReviewPlatformFee(feeType, feeValue, userId);
  }

  public async updateProjectReviewPlatformFee(
    feeType: "percentage" | "fixed",
    feeValue: number,
    userId: string = "admin-governance"
  ): Promise<{ success: boolean; config?: any; platformCharge?: any; message?: string; error?: string }> {
    try {
      const res = await fetch("/api/project-reviews/platform-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeType, feeValue, role: "admin", userId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const cfg = data.config || data.platformCharge;
        if (cfg && typeof window !== "undefined") {
          localStorage.setItem("mongo_project_review_config", JSON.stringify(cfg));
          localStorage.setItem("mongo_platform_charge", JSON.stringify(cfg));
          window.dispatchEvent(new CustomEvent("platform_fee_updated", { detail: cfg }));
        }
        this.notifyProjectReviewUpdated();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("mongo_db_updated"));
        }
        return data;
      }
      return { success: false, error: data.error || "Failed to update platform fee" };
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  private notifyProjectReviewUpdated(review?: ProjectReviewRecord) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("project_review_updated", { detail: { review } }));
      window.dispatchEvent(new Event("storage"));
    }
  }

  // ==============================================================
  // BLOGS & ARTICLES CMS CLIENT METHODS
  // ==============================================================

  public async getPublicBlogs(params?: { category?: string; search?: string; type?: string; limit?: number }): Promise<{ success: boolean; articles: BlogArticleRecord[]; total: number; categories: BlogCategoryRecord[] }> {
    try {
      const q = new URLSearchParams();
      if (params?.category) q.set("category", params.category);
      if (params?.search) q.set("search", params.search);
      if (params?.type) q.set("type", params.type);
      if (params?.limit) q.set("limit", params.limit.toString());
      const res = await fetch(`/api/blogs?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {}
    // Fallback to local cache if offline
    try {
      const raw = localStorage.getItem("mongo_blogs");
      if (raw) {
        let list: BlogArticleRecord[] = JSON.parse(raw);
        list = list.filter(b => b.status === "published");
        if (params?.category && params.category !== "All") {
          list = list.filter(b => b.category.toLowerCase() === params.category!.toLowerCase());
        }
        if (params?.search) {
          const s = params.search.toLowerCase();
          list = list.filter(b => b.title.toLowerCase().includes(s) || (b.summary || b.excerpt || "").toLowerCase().includes(s));
        }
        return { success: true, articles: list, total: list.length, categories: [] };
      }
    } catch {}
    return { success: false, articles: [], total: 0, categories: [] };
  }

  public async getPublicBlogBySlug(slug: string, isPreview?: boolean, role?: string): Promise<{ success: boolean; article?: BlogArticleRecord; relatedArticles?: BlogArticleRecord[]; error?: string }> {
    try {
      const url = `/api/blogs/${encodeURIComponent(slug)}${isPreview ? "?preview=true" : ""}`;
      const headers: Record<string, string> = {};
      if (role === "admin" || isPreview) headers["x-admin-role"] = "admin";
      const res = await fetch(url, { headers });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async getAdminBlogs(role: string = "admin", filters?: { status?: string; category?: string; type?: string; featured?: string; search?: string }): Promise<{ success: boolean; articles: BlogArticleRecord[]; stats: BlogCMSStats; categories: BlogCategoryRecord[]; error?: string }> {
    try {
      const q = new URLSearchParams();
      q.set("role", role);
      if (filters?.status) q.set("status", filters.status);
      if (filters?.category) q.set("category", filters.category);
      if (filters?.type) q.set("type", filters.type);
      if (filters?.featured) q.set("featured", filters.featured);
      if (filters?.search) q.set("search", filters.search);
      const res = await fetch(`/api/admin/blogs?${q.toString()}`, {
        headers: { "x-admin-role": role }
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, articles: [], stats: { total: 0, published: 0, drafts: 0, featured: 0, categories: 0 }, categories: [], error: e.message || "Network error" };
    }
  }

  public async createAdminBlog(article: Partial<BlogArticleRecord>, role: string = "admin"): Promise<{ success: boolean; article?: BlogArticleRecord; message?: string; error?: string }> {
    try {
      const res = await fetch("/api/admin/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-role": role },
        body: JSON.stringify({ ...article, role })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.notifyBlogsUpdated();
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async updateAdminBlog(id: string, updates: Partial<BlogArticleRecord>, role: string = "admin"): Promise<{ success: boolean; article?: BlogArticleRecord; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-role": role },
        body: JSON.stringify({ ...updates, role })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.notifyBlogsUpdated();
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async deleteAdminBlog(id: string, role: string = "admin"): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(id)}?role=${role}`, {
        method: "DELETE",
        headers: { "x-admin-role": role }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.notifyBlogsUpdated();
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async publishAdminBlog(id: string, role: string = "admin"): Promise<{ success: boolean; article?: BlogArticleRecord; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(id)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-role": role },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.notifyBlogsUpdated();
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async unpublishAdminBlog(id: string, role: string = "admin"): Promise<{ success: boolean; article?: BlogArticleRecord; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(id)}/unpublish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-role": role },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.notifyBlogsUpdated();
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async toggleFeatureAdminBlog(id: string, featured?: boolean, role: string = "admin"): Promise<{ success: boolean; article?: BlogArticleRecord; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(id)}/feature`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-role": role },
        body: JSON.stringify({ featured, role })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.notifyBlogsUpdated();
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async reorderAdminBlogs(order: Array<{ id: string; displayOrder: number }>, role: string = "admin"): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch("/api/admin/blogs/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-role": role },
        body: JSON.stringify({ order, role })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.notifyBlogsUpdated();
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async getBlogCategories(role?: string): Promise<{ success: boolean; categories: BlogCategoryRecord[]; error?: string }> {
    try {
      const url = role === "admin" ? "/api/admin/blogs/categories?role=admin" : "/api/blogs/categories";
      const headers: Record<string, string> = {};
      if (role === "admin") headers["x-admin-role"] = "admin";
      const res = await fetch(url, { headers });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, categories: [], error: e.message || "Network error" };
    }
  }

  public async createBlogCategory(category: { name: string; description?: string; slug?: string }, role: string = "admin"): Promise<{ success: boolean; category?: BlogCategoryRecord; message?: string; error?: string }> {
    try {
      const res = await fetch("/api/admin/blogs/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-role": role },
        body: JSON.stringify({ ...category, role })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.notifyBlogsUpdated();
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  public async deleteBlogCategory(idOrSlug: string, force: boolean = false, role: string = "admin"): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/admin/blogs/categories/${encodeURIComponent(idOrSlug)}${force ? "?force=true" : ""}`, {
        method: "DELETE",
        headers: { "x-admin-role": role }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.notifyBlogsUpdated();
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || "Network error" };
    }
  }

  private notifyBlogsUpdated() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("blogs_updated"));
      window.dispatchEvent(new Event("storage"));
      this.pullServerDb();
    }
  }
}


export const mongoDB = new MongoDBService();

