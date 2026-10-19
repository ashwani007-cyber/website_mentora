import fs from 'fs';
import path from 'path';

function searchHistoryAndHash(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') searchHistoryAndHash(p);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.js') || f.endsWith('.html')) {
      const c = fs.readFileSync(p, 'utf8');
      c.split('\n').forEach((l, i) => {
        if (/hash/i.test(l) || /history/i.test(l) || /popstate/i.test(l) || /pushState/i.test(l) || /replaceState/i.test(l)) {
          console.log(`${p}:${i+1}: ${l.trim()}`);
        }
      });
    }
  }
}

searchHistoryAndHash('A:/Ashwani/src');
