import fs from 'fs';
import path from 'path';

function searchDashboard(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') searchDashboard(p);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      const c = fs.readFileSync(p, 'utf8');
      c.split('\n').forEach((l, i) => {
        if (/ClientDashboard/i.test(l) || /SeniorProDashboard/i.test(l) || /AdminDashboard/i.test(l)) {
          console.log(`${p}:${i+1}: ${l.trim()}`);
        }
      });
    }
  }
}

searchDashboard('A:/Ashwani/src');
