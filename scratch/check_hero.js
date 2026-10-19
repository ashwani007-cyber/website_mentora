const fs = require('fs');

function searchDir(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + '/' + f.name;
    if (f.isDirectory() && f.name !== 'node_modules' && f.name !== '.git') {
      searchDir(full);
    } else if (f.isFile() && (f.name.endsWith('.tsx') || f.name.endsWith('.ts'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('/Hero') || content.includes('Hero.tsx') || content.includes('<Hero') || content.includes('components/Hero')) {
        console.log('Match in:', full);
      }
    }
  }
}

searchDir('src');
