import fs from 'fs';

const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

lines.forEach((l, i) => {
  if (l.includes('handleBookingClick') || l.includes('handleProjectReviewClick') || l.includes('BookingModal') || l.includes('avail-')) {
    console.log((i+1) + ': ' + l.slice(0, 120));
  }
});
