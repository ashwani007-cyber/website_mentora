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
    const match = l.match(/<form[^>]*onSubmit=\{([^}]+)\}/);
    if (match) {
      const handlerName = match[1].trim();
      // Search for handler definition in the file
      let found = false;
      lines.forEach((hl, hidx) => {
        if (hl.includes(handlerName + ' =') || hl.includes('function ' + handlerName)) {
          // Read next 15 lines of handler
          const snippet = lines.slice(hidx, hidx + 15).join('\n');
          const hasPreventDefault = snippet.includes('preventDefault');
          console.log(`${file}:${idx + 1} -> Handler "${handlerName}" at line ${hidx + 1}: has preventDefault? ${hasPreventDefault}`);
          if (!hasPreventDefault) {
            console.log(`>>> WARNING: NO preventDefault in ${handlerName}!\nSnippet:\n${snippet}\n`);
          }
          found = true;
        }
      });
      if (!found) {
        console.log(`${file}:${idx + 1} -> Handler "${handlerName}" NOT FOUND directly`);
      }
    } else if (/<form/i.test(l)) {
      console.log(`${file}:${idx + 1} -> FORM WITHOUT onSubmit: ${l.trim()}`);
    }
  });
});
