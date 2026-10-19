const fs = require('fs');

const formFiles = [
  'A:/Ashwani/src/App.tsx',
  'A:/Ashwani/src/components/AdminGovernancePortal.tsx',
  'A:/Ashwani/src/components/AuthPage.tsx',
  'A:/Ashwani/src/components/ClientDashboard.tsx',
  'A:/Ashwani/src/components/GoogleMeetModal.tsx',
  'A:/Ashwani/src/components/NotificationManagementDesk.tsx',
  'A:/Ashwani/src/components/ProjectReviewRequestModal.tsx',
  'A:/Ashwani/src/components/ProjectReviewWorkspace.tsx',
  'A:/Ashwani/src/components/SubscriptionView.tsx',
  'A:/Ashwani/src/components/TeleconsultSimulatorModal.tsx',
  'A:/Ashwani/src/components/WalletView.tsx',
];

formFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (/<form/i.test(l)) {
      // Find the onSubmit handler name
      console.log(`\n--- Form in ${file}:${idx + 1} ---`);
      console.log(l.trim());
      // Check next 30 lines to see the form and submit button
      for (let j = Math.max(0, idx - 40); j <= Math.min(lines.length - 1, idx + 40); j++) {
        if (/const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/i.test(lines[j]) || /function\s+\w+\s*\(/i.test(lines[j])) {
          // console.log(`   Nearby handler: ${lines[j].trim()}`);
        }
      }
    }
  });
});
