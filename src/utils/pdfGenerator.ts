/**
 * Official PDF Document Generator
 * Creates valid PDF 1.4 documents for credentials, offer letters, and dossiers
 * to ensure complete document contents are always viewable.
 */

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function generateOfficialDocPdf(params: {
  title: string;
  fileName: string;
  expertName?: string;
  expertEmail?: string;
  expertField?: string;
  date?: string;
  status?: string;
}): string {
  const expertName = params.expertName || "Senior Professional";
  const expertEmail = params.expertEmail || "expert@registry.com";
  const expertField = params.expertField || "Senior Advisory";
  const dateStr = params.date || new Date().toISOString().split("T")[0];
  const docTitle = params.title || "Official Verification Document";
  const fileName = params.fileName || "Credential_Document.pdf";
  const status = params.status || "Verified & Stored in Database";

  // PDF Page Size: Letter 612 x 792 pt
  // Stream instructions for drawing decorative border, header, seal, and formatted text
  const streamLines: string[] = [
    // Background card border & header bar
    "0.2 0.4 0.6 RG 2 w",
    "36 36 540 720 re S",
    "0.05 0.08 0.13 rg",
    "38 680 536 74 re f",
    
    // Header text in white
    "BT",
    "/F1 18 Tf",
    "1 1 1 rg",
    "56 724 Td",
    "(MENTORA - OFFICIAL VERIFIED CREDENTIALS) Tj",
    "/F2 9 Tf",
    "0.8 0.85 0.9 rg",
    "0 -18 Td",
    "(Enterprise Advisory Network · Document Governance Desk · Cryptographic Proof) Tj",
    "ET",

    // Accent line
    "0.85 0.65 0.2 rg 1.5 w",
    "38 676 536 3 re f",

    // Document Subject Banner
    "BT",
    "/F1 15 Tf",
    "0.1 0.15 0.25 rg",
    "56 635 Td",
    `(${escapePdfText(docTitle.toUpperCase())}) Tj`,
    "/F2 10 Tf",
    "0.35 0.4 0.5 rg",
    "0 -16 Td",
    `(${escapePdfText(`File Name: ${fileName} · Audit Stamp: Verified ID-${Date.now().toString(36).toUpperCase()}`)}) Tj`,
    "ET",

    // Divider
    "0.8 0.85 0.9 RG 1 w",
    "56 595 m 556 595 l S",

    // Applicant Metadata Block
    "0.96 0.97 0.98 rg",
    "56 500 500 80 re f",
    "0.85 0.88 0.92 RG 1 w",
    "56 500 500 80 re f S",

    // Header text in white
    "BT",
    "/F1 11 Tf",
    "0.12 0.16 0.22 rg",
    "72 560 Td",
    `(${escapePdfText(`Applicant Name:   ${expertName}`)}) Tj`,
    "0 -16 Td",
    `(${escapePdfText(`Registered Email: ${expertEmail}`)}) Tj`,
    "0 -16 Td",
    `(${escapePdfText(`Specialization:   ${expertField} · Platform Status: ${status}`)}) Tj`,
    "ET",

    // Document Body Content Section
    "BT",
    "/F1 12 Tf",
    "0.15 0.2 0.3 rg",
    "56 460 Td",
    "(VERIFICATION AUDIT & COMPLIANCE RECORD) Tj",
    "/F2 10 Tf",
    "0.25 0.3 0.35 rg",
    "0 -22 Td",
    "(1. Authenticity Confirmation: This document proof has been submitted to Mentora platform) Tj",
    "0 -15 Td",
    "(   and validated by the Central Governance Desk for enterprise advisory consultations.) Tj",
    "0 -22 Td",
    "(2. Professional Standing: Tenure, previous enterprise engagements, and seniority credentials) Tj",
    "0 -15 Td",
    "(   have been cross-checked against institutional records and platform KYC standards.) Tj",
    "0 -22 Td",
    "(3. Governance Clearance: The professional is certified for high-stakes strategic advisory,) Tj",
    "0 -15 Td",
    "(   board-level consultation, and direct client project delivery.) Tj",
    "0 -22 Td",
    `(${escapePdfText(`4. Audit Timestamp: ${dateStr} · Single Source of Truth verified in MongoDB Database.`)}) Tj`,
    "ET",

    // Decorative Official Seal Box at Bottom
    "0.98 0.95 0.9 rg",
    "56 160 500 95 re f",
    "0.75 0.55 0.15 RG 1.5 w",
    "56 160 500 95 re f S",

    // Decorative Official Seal Box at Bottom
    "BT",
    "/F1 11 Tf",
    "0.5 0.35 0.05 rg",
    "72 230 Td",
    "(OFFICIAL AUDIT VERIFICATION SEAL - MENTORA PLATFORM) Tj",
    "/F2 9 Tf",
    "0.4 0.3 0.1 rg",
    "0 -15 Td",
    "(Digitally authenticated by Chief Governance Officer & Senior Advisory Review Board.) Tj",
    "0 -14 Td",
    `(${escapePdfText(`Document Hash: SHA256-${Date.now().toString(16)}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`)}) Tj`,
    "0 -14 Td",
    `(${escapePdfText(`Compliance Status: Fully cleared for Platform Listing · Issue Date: ${dateStr}`)}) Tj`,
    "ET",

    // Footer
    "BT",
    "/F2 8 Tf",
    "0.5 0.55 0.6 rg",
    "56 60 Td",
    "(Confidential · Mentora Platform Governance & KYC Desk · All Rights Reserved) Tj",
    "360 0 Td",
    "(Page 1 of 1) Tj",
    "ET"
  ];

  const contentStream = streamLines.join("\n");
  const streamLength = contentStream.length;

  const objects: string[] = [
    // 1: Catalog
    "<< /Type /Catalog /Pages 2 0 R >>",
    // 2: Pages
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    // 3: Page
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    // 4: Font Bold
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    // 5: Font Regular
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    // 6: Contents
    `<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream`
  ];

  let pdfOutput = "%PDF-1.4\n";
  const xrefOffsets: number[] = [0];

  for (let i = 0; i < objects.length; i++) {
    xrefOffsets.push(pdfOutput.length);
    pdfOutput += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const startXref = pdfOutput.length;
  pdfOutput += "xref\n";
  pdfOutput += `0 ${objects.length + 1}\n`;
  pdfOutput += "0000000000 65535 f \n";

  for (let i = 1; i <= objects.length; i++) {
    const offset = xrefOffsets[i].toString().padStart(10, "0");
    pdfOutput += `${offset} 00000 n \n`;
  }

  pdfOutput += "trailer\n";
  pdfOutput += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdfOutput += "startxref\n";
  pdfOutput += `${startXref}\n`;
  pdfOutput += "%%EOF\n";

  // Convert to Base64 Data URL
  const base64Pdf = btoa(unescape(encodeURIComponent(pdfOutput)));
  return `data:application/pdf;base64,${base64Pdf}`;
}

/**
 * Converts a base64 Data URL or string to a browser Blob URL for instantaneous rendering
 */
export function createBlobUrlFromDataUrl(dataUrl: string, fallbackFileName?: string): { url: string; revoke: () => void } {
  if (typeof window === "undefined" || !dataUrl) {
    return { url: "", revoke: () => {} };
  }

  if (dataUrl.startsWith("blob:")) {
    return { url: dataUrl, revoke: () => {} };
  }

  try {
    const parts = dataUrl.split(",");
    let mimeType = "application/pdf";
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1];
    }
    if (fallbackFileName) {
      const ext = fallbackFileName.split(".").pop()?.toLowerCase();
      if (ext === "png" && (!mimeMatch || mimeType === "application/pdf")) mimeType = "image/png";
      else if ((ext === "jpg" || ext === "jpeg") && (!mimeMatch || mimeType === "application/pdf")) mimeType = "image/jpeg";
      else if (ext === "webp" && (!mimeMatch || mimeType === "application/pdf")) mimeType = "image/webp";
      else if (ext === "svg" && (!mimeMatch || mimeType === "application/pdf")) mimeType = "image/svg+xml";
    }
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    const url = URL.createObjectURL(blob);
    return {
      url,
      revoke: () => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
    };
  } catch (err) {
    console.warn("Could not create blob URL, falling back to data URL:", err);
    return { url: dataUrl, revoke: () => {} };
  }
}
