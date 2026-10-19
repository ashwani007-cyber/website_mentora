import fs from 'fs';

const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

lines.forEach((l, i) => {
  if (l.includes('Ready to Schedule') || l.includes('Accepted by Expert')) {
    console.log((i+1) + ': ' + l.slice(0, 120));
  }
});
