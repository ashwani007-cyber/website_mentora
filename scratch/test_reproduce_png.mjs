// scratch/test_reproduce_png.mjs
// Live test script to investigate Expert Document Upload -> Admin Audit -> Document View workflow for PNG files.

import fs from 'fs';
import path from 'path';

async function run() {
  console.log('--- 1. Testing Backend /api/documents Upload of a valid PNG file ---');
  // Minimal valid 1x1 PNG base64
  const png1x1Base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const pngDataUrl = `data:image/png;base64,${png1x1Base64}`;
  const testFileName = `test_audit_cert_${Date.now()}.png`;
  const testDocId = `doc-testexp-${Date.now()}-1`;

  const uploadPayload = {
    id: testDocId,
    fileName: testFileName,
    fileData: pngDataUrl,
    expertId: 'exp-test-123',
    expertName: 'Test Expert',
    expertEmail: 'testexpert@registry.com',
    type: 'expCert'
  };

  const uploadRes = await fetch('http://localhost:5173/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(uploadPayload)
  });

  const uploadJson = await uploadRes.json();
  console.log('Upload Response:', uploadJson);

  console.log('\n--- 2. Checking how the files were stored on disk ---');
  const uploadDir = path.resolve('public', 'uploaded_docs');
  const serverDir = path.resolve('server_docs');

  const filesInUpload = fs.readdirSync(uploadDir).filter(f => f.includes(testFileName) || f.includes(testDocId));
  console.log('Files matching test in public/uploaded_docs:', filesInUpload);

  console.log('\n--- 3. Testing GET /api/documents by fileName ---');
  const getByNameRes = await fetch(`http://localhost:5173/api/documents?key=${encodeURIComponent(testFileName)}`);
  const getByNameJson = await getByNameRes.json();
  console.log('GET by fileName response:');
  console.log('  success:', getByNameJson.success);
  console.log('  fileName:', getByNameJson.fileName);
  console.log('  url:', getByNameJson.url);
  console.log('  fileData MIME prefix:', getByNameJson.fileData?.slice(0, 30));

  console.log('\n--- 4. Testing GET /api/documents by id ---');
  const getByIdRes = await fetch(`http://localhost:5173/api/documents?key=${encodeURIComponent(testDocId)}`);
  const getByIdJson = await getByIdRes.json();
  console.log('GET by id response:');
  console.log('  success:', getByIdJson.success);
  console.log('  fileName:', getByIdJson.fileName);
  console.log('  url:', getByIdJson.url);
  console.log('  fileData MIME prefix:', getByIdJson.fileData?.slice(0, 30));

  console.log('\n--- 5. Checking static URL content-type ---');
  const staticRes = await fetch(`http://localhost:5173${getByNameJson.url}`);
  console.log('Static fetch HTTP status:', staticRes.status);
  console.log('Static fetch Content-Type:', staticRes.headers.get('content-type'));

  if (getByIdJson.url) {
    const aliasRes = await fetch(`http://localhost:5173${getByIdJson.url}`);
    console.log('Alias fetch HTTP status:', aliasRes.status);
    console.log('Alias fetch Content-Type:', aliasRes.headers.get('content-type'));
  }
}

run().catch(console.error);
