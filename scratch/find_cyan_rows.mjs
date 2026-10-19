import fs from 'fs';
import { PNG } from 'pngjs';

const data = fs.readFileSync('A:/Ashwani/scratch/footer_interactive_wave_dark.png');
const png = PNG.sync.read(data);

console.log(`Width: ${png.width}, Height: ${png.height}`);

const cyanRows = new Map();
for (let y = 0; y < png.height; y++) {
  let cyanCount = 0;
  for (let x = 0; x < png.width; x++) {
    const idx = (png.width * y + x) << 2;
    const r = png.data[idx];
    const g = png.data[idx + 1];
    const b = png.data[idx + 2];
    if (b > 180 && g > 160 && r < 120) {
      cyanCount++;
    }
  }
  if (cyanCount > 50) {
    cyanRows.set(y, cyanCount);
  }
}

console.log('Cyan rows found (y => count of cyan pixels):');
for (const [y, count] of cyanRows) {
  console.log(`y=${y}: ${count} pixels`);
}
