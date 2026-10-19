import fs from 'fs';

async function checkClient() {
  const res = await fetch('http://localhost:5173/client');
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Length:', text.length);
  console.log('Has root div:', text.includes('id="root"'));
  console.log('Has main.tsx:', text.includes('src/main.tsx'));
}

checkClient().catch(console.error);
