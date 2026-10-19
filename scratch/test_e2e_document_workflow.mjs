// scratch/test_e2e_document_workflow.mjs
// End-to-end validation for Expert Document Upload -> Admin Audit -> Document View
// Covers PNG documents and existing PDF documents.

import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function testPngWorkflow() {
  console.log('\n======================================================');
  console.log('TEST 1: PNG Document Upload -> Storage -> Admin Audit Retrieval');
  console.log('======================================================');

  // 1. Expert uploads PNG document
  const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjAwMDAwAFAkBA+3r1XQAAAAASUVORK5CYII=';
  const pngDataUrl = `data:image/png;base64,${samplePngBase64}`;
  const pngFileName = `Sunita_Rao_Work_Experience_${Date.now()}.png`;
  const pngDocId = `doc-exp-png-${Date.now()}-1`;

  console.log(`[Expert Portal] Uploading PNG: ${pngFileName} (id: ${pngDocId})`);
  const uploadRes = await fetch(`${BASE_URL}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: pngDocId,
      fileName: pngFileName,
      fileData: pngDataUrl,
      expertId: 'exp-test-sunita',
      expertName: 'Sunita Rao',
      expertEmail: 'sunita.rao@registry.com',
      type: 'expCert'
    })
  });

  assert(uploadRes.ok, 'PNG upload HTTP response is 200 OK');
  const uploadJson = await uploadRes.json();
  assert(uploadJson.success === true, 'Upload response indicates success: true');
  assert(uploadJson.fileName === pngFileName, `Upload response preserves exact PNG fileName: ${pngFileName}`);
  assert(uploadJson.url.includes('.png'), `Upload response returns PNG relative URL: ${uploadJson.url}`);

  // 2. Storage validation on disk
  const uploadDir = path.resolve('public', 'uploaded_docs');
  const serverDir = path.resolve('server_docs');

  assert(fs.existsSync(path.join(uploadDir, pngFileName)), `PNG file physically exists in public/uploaded_docs/${pngFileName}`);
  assert(fs.existsSync(path.join(serverDir, pngFileName)), `PNG file physically exists in server_docs/${pngFileName}`);

  const aliasFile = path.join(uploadDir, `${pngDocId}.png`);
  assert(fs.existsSync(aliasFile), `ID alias physically exists with preserved .png extension: ${path.basename(aliasFile)}`);

  // Verify file is NOT saved as .pdf
  const corruptPdfAlias = path.join(uploadDir, `${pngDocId}.pdf`);
  assert(!fs.existsSync(corruptPdfAlias), 'ID alias is NOT saved with corrupted .pdf extension');

  // 3. Retrieval by fileName (Admin Audit View by fileName)
  console.log('\n[Admin Portal] Retrieving document by fileName for audit review...');
  const getByNameRes = await fetch(`${BASE_URL}/api/documents?key=${encodeURIComponent(pngFileName)}`);
  assert(getByNameRes.ok, 'GET /api/documents by fileName is 200 OK');
  const getByNameJson = await getByNameRes.json();
  assert(getByNameJson.success === true, 'GET by fileName returns success: true');
  assert(getByNameJson.mimeType === 'image/png', `GET by fileName returns correct mimeType: ${getByNameJson.mimeType}`);
  assert(getByNameJson.fileData.startsWith('data:image/png;base64,'), 'GET by fileName returns data:image/png;base64 data URL (NOT application/pdf)');

  // 4. Retrieval by id (Admin Audit View by doc ID)
  console.log('\n[Admin Portal] Retrieving document by doc ID for audit review...');
  const getByIdRes = await fetch(`${BASE_URL}/api/documents?key=${encodeURIComponent(pngDocId)}`);
  assert(getByIdRes.ok, 'GET /api/documents by ID is 200 OK');
  const getByIdJson = await getByIdRes.json();
  assert(getByIdJson.success === true, 'GET by ID returns success: true');
  assert(getByIdJson.mimeType === 'image/png', `GET by ID returns correct mimeType: ${getByIdJson.mimeType}`);
  assert(getByIdJson.fileData.startsWith('data:image/png;base64,'), 'GET by ID returns data:image/png;base64 data URL');

  // 5. Raw streaming validation (GET with raw=true)
  console.log('\n[Admin Portal] Verifying raw streaming headers for PNG...');
  const rawRes = await fetch(`${BASE_URL}/api/documents?key=${encodeURIComponent(pngFileName)}&raw=true`);
  assert(rawRes.ok, 'Raw stream returns 200 OK');
  assert(rawRes.headers.get('content-type') === 'image/png', `Raw stream Content-Type header is image/png (was: ${rawRes.headers.get('content-type')})`);

  // 6. Direct static URL serving validation
  console.log('\n[Admin Portal] Verifying direct static serving of uploaded PNG...');
  const staticRes = await fetch(`${BASE_URL}${uploadJson.url}`);
  assert(staticRes.ok, 'Static file URL returns 200 OK');
  assert(staticRes.headers.get('content-type') === 'image/png', `Static file Content-Type header is image/png (was: ${staticRes.headers.get('content-type')})`);
}

async function testPdfWorkflow() {
  console.log('\n======================================================');
  console.log('TEST 2: PDF Document Workflow Regression Check');
  console.log('======================================================');

  // Minimal valid PDF binary
  const samplePdfBase64 = 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9Db3VudCAxCj4+CmVuZG9iagoxIDAgb2JqCjw8Ci9TaXplIDM+Pgp0cmFpbGVyCjw8Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo5OQolJUVPRg==';
  const pdfDataUrl = `data:application/pdf;base64,${samplePdfBase64}`;
  const pdfFileName = `Krishnan_Iyer_Experience_${Date.now()}.pdf`;
  const pdfDocId = `doc-exp-pdf-${Date.now()}-1`;

  console.log(`[Expert Portal] Uploading PDF: ${pdfFileName}`);
  const uploadRes = await fetch(`${BASE_URL}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: pdfDocId,
      fileName: pdfFileName,
      fileData: pdfDataUrl,
      expertId: 'exp-test-krishnan',
      expertName: 'Krishnan Iyer',
      expertEmail: 'krishnan.iyer@registry.com',
      type: 'expCert'
    })
  });

  assert(uploadRes.ok, 'PDF upload HTTP response is 200 OK');
  const uploadJson = await uploadRes.json();
  assert(uploadJson.success === true, 'PDF upload response indicates success: true');

  // Verify retrieval
  const getByNameRes = await fetch(`${BASE_URL}/api/documents?key=${encodeURIComponent(pdfFileName)}`);
  assert(getByNameRes.ok, 'GET PDF by fileName is 200 OK');
  const getByNameJson = await getByNameRes.json();
  assert(getByNameJson.mimeType === 'application/pdf', `PDF mimeType is application/pdf`);
  assert(getByNameJson.fileData.startsWith('data:application/pdf;base64,'), 'PDF returns data:application/pdf;base64 data URL');

  // Verify raw stream
  const rawRes = await fetch(`${BASE_URL}/api/documents?key=${encodeURIComponent(pdfFileName)}&raw=true`);
  assert(rawRes.ok, 'PDF raw stream returns 200 OK');
  assert(rawRes.headers.get('content-type') === 'application/pdf', `PDF raw stream Content-Type header is application/pdf`);
}

async function main() {
  try {
    await testPngWorkflow();
    await testPdfWorkflow();
    console.log('\n🎉 ALL DOCUMENT WORKFLOW TESTS PASSED CLEANLY!\n');
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

main();
