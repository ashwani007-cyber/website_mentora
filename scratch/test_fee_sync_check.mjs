// Check current platform fee sync behavior across endpoints
import fs from 'fs';

async function check() {
  const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
  console.log('Current DB platformCharge:', db.platformCharge);
  console.log('Current DB projectReviewConfig:', db.projectReviewConfig);
  
  // Test GET /api/platform-settings
  try {
    const res = await fetch('http://localhost:5173/api/platform-settings');
    const data = await res.json();
    console.log('GET /api/platform-settings result:', data);
  } catch (e) {
    console.log('Server fetch error:', e.message);
  }

  // Test GET /api/project-reviews/pricing for expert JK
  try {
    const res = await fetch('http://localhost:5173/api/project-reviews/pricing?expertId=usr-1788974684441&role=client');
    const data = await res.json();
    console.log('GET /api/project-reviews/pricing?expertId=usr-1788974684441 result:', data);
  } catch (e) {
    console.log('Server fetch error:', e.message);
  }
}

check();
