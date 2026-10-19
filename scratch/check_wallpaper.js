const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  const l = line.toLowerCase();
  if (l.includes('wallpaper') || (l.includes('backgroundimage') && l.includes('http'))) {
    console.log('App.tsx line', i + 1, ':', line.trim());
  }
});

const videoComp = fs.readFileSync('src/components/LandingBackgroundVideo.tsx', 'utf8');
const vLines = videoComp.split('\n');
vLines.forEach((line, i) => {
  const l = line.toLowerCase();
  if (l.includes('wallpaper') || (l.includes('backgroundimage') && l.includes('fallback'))) {
    console.log('LandingBackgroundVideo.tsx line', i + 1, ':', line.trim());
  }
});
