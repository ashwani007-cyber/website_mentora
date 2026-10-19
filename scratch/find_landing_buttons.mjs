import fs from 'fs';

const content = fs.readFileSync('A:/Ashwani/src/App.tsx', 'utf8');
const lines = content.split('\n');

// Landing is from line 2749 to 3987
const landingLines = lines.slice(2748, 3988);
landingLines.forEach((l, i) => {
  if (/<button/i.test(l) || /onClick/i.test(l)) {
    console.log(`Line ${2749 + i}: ${l.trim()}`);
  }
});
