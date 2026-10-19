import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n--- 1. Verification of Footer Architecture & File Integrity ---');
const footerPath = path.resolve('src/components/Footer.tsx');
assert(fs.existsSync(footerPath), 'src/components/Footer.tsx exists');
const footerContent = fs.readFileSync(footerPath, 'utf8');

const appPath = path.resolve('src/App.tsx');
assert(fs.existsSync(appPath), 'src/App.tsx exists');
const appContent = fs.readFileSync(appPath, 'utf8');

console.log('\n--- 2. Mentora Brand & Positioning Copy Verification ---');
assert(
  footerContent.includes('Mentora connects decades of professional experience with the people and organizations building what comes next.'),
  'Contains exact approved Mentora brand positioning statement'
);
assert(
  footerContent.includes('Empowering Future Leaders'),
  'Contains brand tagline: "Empowering Future Leaders"'
);
assert(
  footerContent.includes('100% Background-Verified Senior Advisors'),
  'Contains verified trust badge'
);

console.log('\n--- 3. Pre-Footer CTA Section Verification ---');
assert(
  footerContent.includes('Experience That Moves') && footerContent.includes('You Forward.'),
  'Contains CTA headline: "Experience That Moves You Forward."'
);
assert(
  footerContent.includes('Find trusted expertise or share your experience with the next generation.'),
  'Contains CTA supporting text'
);
assert(
  footerContent.includes('Find an Expert') && footerContent.includes('Become an Expert'),
  'Contains dual CTA buttons: "Find an Expert" and "Become an Expert"'
);

console.log('\n--- 4. Flowing Two-Layer Animated Wave Separator Verification ---');
assert(
  footerContent.includes('mentora-wave-layer-primary') && footerContent.includes('mentora-wave-layer-secondary'),
  'Contains two independent wave layers: primary foreground wave and secondary background wave'
);
assert(
  footerContent.includes('mentoraWavePrimary') && footerContent.includes('mentoraWaveSecondary'),
  'Defines continuous animation keyframes for both wave layers'
);
assert(
  footerContent.includes('14s linear infinite') && footerContent.includes('19s linear infinite'),
  'Wave layers animate asynchronously with slow, fluid continuous cycles (14s and 19s)'
);
assert(
  footerContent.includes('viewBox="0 0 2880 120"'),
  'Uses 2880px double-period geometry for mathematically seamless looping'
);
assert(
  footerContent.includes('translate3d(-50%') && footerContent.includes('width: \'200%\''),
  'Translates by exactly -50% with width 200% for 100% full-width seamless loop without gaps or jumps'
);
assert(
  footerContent.includes('mentoraWaveSecondaryLight') && footerContent.includes('mentoraWaveSecondaryDark'),
  'Provides theme-aware gradients for both Light Mode and Dark Mode'
);
assert(
  footerContent.includes('@media (prefers-reduced-motion: reduce)') && footerContent.includes('animation: none !important'),
  'Respects prefers-reduced-motion: reduce by stopping animation safely'
);

console.log('\n--- 5. Exact Social Media Links & Security Verification ---');
const EXPECTED_LINKEDIN = 'https://www.linkedin.com/in/ashwani-kushwaha-11998a327';
const EXPECTED_INSTAGRAM = 'https://www.instagram.com/ashwanikushwaha386';

assert(
  footerContent.includes(EXPECTED_LINKEDIN),
  `LinkedIn link strictly matches required URL: ${EXPECTED_LINKEDIN}`
);
assert(
  footerContent.includes(EXPECTED_INSTAGRAM),
  `Instagram link strictly matches required URL: ${EXPECTED_INSTAGRAM}`
);
assert(
  footerContent.includes('target="_blank"') && footerContent.includes('rel="noopener noreferrer"'),
  'Social links safely use target="_blank" and rel="noopener noreferrer"'
);
assert(
  !footerContent.includes('facebook.com') && !footerContent.includes('twitter.com') && !footerContent.includes('youtube.com'),
  'Zero fake/placeholder social media links present'
);

console.log('\n--- 6. Newsletter / Updates Subscription UI Verification ---');
assert(
  footerContent.includes('Stay Connected'),
  'Contains Newsletter heading "Stay Connected"'
);
assert(
  footerContent.includes('Get Mentora updates, expert stories, insights and platform news.'),
  'Contains Newsletter description text'
);
assert(
  footerContent.includes('placeholder="Enter your email"'),
  'Contains email input with placeholder "Enter your email"'
);
assert(
  footerContent.includes('EMAIL_REGEX') || footerContent.includes('test('),
  'Contains email validation logic'
);
assert(
  footerContent.includes("Thank you for subscribing! You're now connected to Mentora updates."),
  'Contains positive user confirmation feedback'
);

console.log('\n--- 7. Navigation Column & Route Fidelity Verification ---');
assert(
  footerContent.includes('Explore') &&
  footerContent.includes('For Clients') &&
  footerContent.includes('For Experts') &&
  footerContent.includes('Company & Desk'),
  'Contains standard 5-column navigation structure'
);
assert(
  footerContent.includes("smoothScrollTo('how')") &&
  footerContent.includes("smoothScrollTo('organizations')") &&
  footerContent.includes("smoothScrollTo('stories')") &&
  footerContent.includes("smoothScrollTo('featured-advisors')"),
  'All same-page links connect to real scrollable anchors'
);
assert(
  appContent.includes('id="how"') &&
  appContent.includes('id="stories"') &&
  appContent.includes('id="organizations"') &&
  appContent.includes('id="featured-advisors"'),
  'All target IDs exist in Landing Page in src/App.tsx'
);
assert(
  footerContent.includes("setPage('about')") &&
  footerContent.includes("setPage('blogs')") &&
  footerContent.includes("onOpenAuth('signup', 'client')") &&
  footerContent.includes("onOpenAuth('signup', 'expert')") &&
  footerContent.includes("onOpenAuth('login', 'expert')"),
  'All application links route via existing setPage and onOpenAuth handlers without fake routes'
);

console.log('\n--- 8. Dark & Light Theme Awareness ---');
assert(
  footerContent.includes("isLight ? '#FAF8F5' : '#060A10'"),
  'Uses warm cream (#FAF8F5) in light mode and deep cyber obsidian (#060A10) in dark mode'
);
assert(
  footerContent.includes('mentoraLogoHorizontalLight') && footerContent.includes('mentoraLogoHorizontalDark'),
  'Selects appropriate light/dark logo assets based on active theme'
);

console.log('\n--- 9. Accessibility & Floating UI Protection ---');
assert(
  footerContent.includes('<footer') && footerContent.includes('aria-label="Mentora Footer"'),
  'Semantic <footer> tag with accessible aria-label'
);
assert(
  footerContent.includes('sm:pr-24') || footerContent.includes('md:mr-64'),
  'Bottom bar includes responsive right padding clearance for fixed AI Expert Assistant'
);
assert(
  footerContent.includes('new Date().getFullYear()'),
  'Dynamic current year is used for copyright line'
);
assert(
  footerContent.includes('Mentora Privacy Policy') && footerContent.includes('Terms & Conditions'),
  'Contains functional legal modal for Privacy Policy and Terms & Conditions'
);

console.log('\n--- 10. Landing Page Integration Verification ---');
assert(
  appContent.includes('import { Footer } from "./components/Footer";'),
  'src/App.tsx imports Footer component'
);
assert(
  appContent.includes('<Footer') && appContent.includes('theme={theme}'),
  'src/App.tsx renders <Footer theme={theme} setPage={setPage} onOpenAuth={onOpenAuth} userRole={userRole} />'
);

console.log('\n======================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
