import fs from 'fs';
import path from 'path';

function searchButtonsInForms(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') searchButtonsInForms(p);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      const c = fs.readFileSync(p, 'utf8');
      const lines = c.split('\n');
      let inForm = false;
      let formStart = 0;

      lines.forEach((l, i) => {
        if (/<form/i.test(l)) {
          inForm = true;
          formStart = i + 1;
        }
        if (inForm) {
          if (/<button/i.test(l)) {
            const hasType = /type\s*=\s*["'](button|submit|reset)["']/i.test(l);
            const isSubmit = /type\s*=\s*["']submit["']/i.test(l);
            const hasOnClick = /onClick/i.test(l);
            console.log(`${p}:${i+1} (inside form at ${formStart}): ${l.trim()} | hasType: ${hasType} | isSubmit: ${isSubmit} | hasOnClick: ${hasOnClick}`);
          }
          if (/<\/form>/i.test(l)) {
            inForm = false;
          }
        }
      });
    }
  }
}

searchButtonsInForms('A:/Ashwani/src');
