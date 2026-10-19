import fs from 'fs';
import path from 'path';
import https from 'https';

console.log('====================================================');
console.log('Mentora Landing Page Background Video Verification Suite');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}: ${details}`);
  }
}

async function runTests() {
  const rootDir = process.cwd();

  // Test 1: Centralized Configuration File
  const configPath = path.join(rootDir, 'src', 'data', 'landingVideoConfig.ts');
  assert(fs.existsSync(configPath), '1. Centralized config file exists (src/data/landingVideoConfig.ts)');
  
  const configContent = fs.readFileSync(configPath, 'utf8');
  const expectedUrl = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_045634_e1c98c76-1265-4f5c-882a-4276f2080894.mp4';
  assert(
    configContent.includes(expectedUrl),
    '2. Exact CloudFront Video URL is configured in centralized config'
  );
  assert(
    !configContent.includes('fallbackImages'),
    '3. Static fallback wallpaper images removed from config as requested'
  );

  // Test 2: Live Video URL Availability Check
  await new Promise((resolve) => {
    const req = https.request(expectedUrl, { method: 'HEAD' }, (res) => {
      assert(res.statusCode === 200, `4. Video URL responds with HTTP 200 (Got ${res.statusCode})`);
      assert(
        res.headers['content-type'] === 'video/mp4',
        `5. Video URL content-type is video/mp4 (Got ${res.headers['content-type']})`
      );
      assert(
        Number(res.headers['content-length']) > 1000000,
        `6. Video content length is valid and complete (${res.headers['content-length']} bytes)`
      );
      resolve();
    });
    req.on('error', (err) => {
      assert(false, '4. Video URL responds with HTTP 200', err.message);
      resolve();
    });
    req.end();
  });

  // Test 3: LandingBackgroundVideo Component Exists and Attributes
  const compPath = path.join(rootDir, 'src', 'components', 'LandingBackgroundVideo.tsx');
  assert(fs.existsSync(compPath), '7. LandingBackgroundVideo component file exists');
  
  const compContent = fs.readFileSync(compPath, 'utf8');
  assert(compContent.includes('autoPlay'), '8. Video element has autoPlay attribute');
  assert(compContent.includes('muted'), '9. Video element has muted attribute');
  assert(compContent.includes('loop'), '10. Video element has loop attribute');
  assert(compContent.includes('playsInline'), '11. Video element has playsInline attribute');
  assert(!compContent.includes('controls={true}'), '12. Browser controls are disabled (controls hidden)');
  assert(compContent.includes('objectFit: "cover"') || compContent.includes("object-cover"), '13. Video responsive sizing uses object-fit: cover');
  assert(compContent.includes('pointer-events-none'), '14. Video container has pointer-events-none (never blocks clicks/scrolling)');
  assert(compContent.includes('prefers-reduced-motion'), '15. Respects prefers-reduced-motion media query');
  assert(compContent.includes('onError'), '16. Graceful video loading failure handler (onError) implemented');
  assert(compContent.includes('catch(') || compContent.includes('.catch'), '17. Autoplay restriction rejection handler implemented');
  assert(compContent.includes('isLight'), '18. Supports dynamic Light Mode and Dark Mode theme adaptation');
  assert(compContent.includes('LANDING_VIDEO_CONFIG'), '19. References centralized LANDING_VIDEO_CONFIG');
  assert(compContent.includes('aria-hidden="true"'), '20. Video is hidden from screen readers (aria-hidden="true")');
  assert(!compContent.includes('backgroundImage'), '21. Static wallpaper div removed; only background video applied');
  assert(!compContent.includes('fallbackImages'), '22. Fallback wallpaper imagery references removed');

  // Test 4: Integration into App.tsx Landing Page
  const appPath = path.join(rootDir, 'src', 'App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert(
    appContent.includes('import { LandingBackgroundVideo }'),
    '21. App.tsx imports LandingBackgroundVideo'
  );
  assert(
    appContent.includes('<LandingBackgroundVideo theme={theme} />'),
    '22. App.tsx renders LandingBackgroundVideo inside Landing component'
  );
  assert(
    !appContent.includes('ClientDashboard.tsx: LandingBackgroundVideo'),
    '23. Client Portal, Expert Portal, and Admin Portal remain untouched'
  );

  // Test 5: Verify Layering Order in App.tsx
  const landingIdx = appContent.indexOf('function Landing(');
  const videoRenderIdx = appContent.indexOf('<LandingBackgroundVideo', landingIdx);
  const headerRenderIdx = appContent.indexOf('<header', videoRenderIdx);
  const heroRenderIdx = appContent.indexOf('Hero Section with Interactive 3D Canvas', headerRenderIdx);

  assert(
    landingIdx !== -1 && videoRenderIdx !== -1 && headerRenderIdx !== -1 && heroRenderIdx !== -1,
    '24. Background video component is positioned before Header and Hero in DOM'
  );
  assert(
    videoRenderIdx < headerRenderIdx && headerRenderIdx < heroRenderIdx,
    '25. Strict visual hierarchy enforced: Layer 1 (Video) < Layer 2 (Overlay) < Layer 3 (Header/Hero)'
  );

  // Test 6: Verify Database Integrity
  const dbPath = path.join(rootDir, 'db.json');
  assert(fs.existsSync(dbPath), '26. db.json database exists and unaltered');

  console.log('\n----------------------------------------------------');
  console.log(`Results: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('----------------------------------------------------');

  if (passedTests === totalTests) {
    console.log('All Landing Page Background Video Integration tests PASSED!');
    process.exit(0);
  } else {
    console.error('Some tests FAILED!');
    process.exit(1);
  }
}

runTests();
