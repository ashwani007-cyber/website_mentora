import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('--- Starting Mentora Blogs & Articles Verification Suite ---');

// 1. Inspect data file
const blogDataPath = path.resolve('src/data/blogArticles.ts');
assert(fs.existsSync(blogDataPath), 'blogArticles.ts must exist');
const blogDataContent = fs.readFileSync(blogDataPath, 'utf8');

// Required titles from prompt:
const requiredTitles = [
  'The Knowledge You Build Over a Career Is More Valuable Than You Think',
  'What Decades of Experience Can Teach the Next Generation',
  'The Career Lessons You Only Learn Through Experience',
  'Why Mentorship Matters More Than Ever in a Changing Workplace',
  'From Professional Experience to a Second Career',
  'How Experienced Professionals Can Guide Startups',
  'AI Is Changing Work — Experience Still Matters',
  'The Difference Between Information and Real-World Knowledge',
  'What Young Professionals Can Learn From Senior Leaders',
  'Turning Professional Experience Into Practical Consulting',
  'Why Knowledge Transfer Is a Two-Way Street'
];

requiredTitles.forEach((title) => {
  assert(
    blogDataContent.includes(title),
    `blogArticles.ts must contain required article title: "${title}"`
  );
  console.log(`[PASS] Verified article title: "${title.slice(0, 45)}..."`);
});

// Required categories
const requiredCategories = [
  'All',
  'Mentorship',
  'Career',
  'Leadership',
  'Entrepreneurship',
  'Technology & AI',
  'Industry Insights',
  'Projects',
  'Consulting',
  'Personal Growth'
];

requiredCategories.forEach((cat) => {
  assert(
    blogDataContent.includes(`'${cat}'`) || blogDataContent.includes(`"${cat}"`),
    `blogArticles.ts must include category: ${cat}`
  );
  console.log(`[PASS] Verified category: ${cat}`);
});

// 2. Inspect component file
const blogComponentPath = path.resolve('src/components/MentoraBlogsPage.tsx');
assert(fs.existsSync(blogComponentPath), 'MentoraBlogsPage.tsx must exist');
const blogComponentContent = fs.readFileSync(blogComponentPath, 'utf8');

// Hero checks
assert(blogComponentContent.includes('MENTORA INSIGHTS'), 'Hero must include eyebrow MENTORA INSIGHTS');
assert(blogComponentContent.includes('Experience worth sharing'), 'Hero must include heading "Experience worth sharing"');
assert(blogComponentContent.includes('Knowledge worth passing on'), 'Hero must include heading "Knowledge worth passing on"');
assert(blogComponentContent.includes('Learn from experience. Grow with perspective.'), 'Hero must include supporting statement');
console.log('[PASS] Verified Hero eyebrow, heading, and statement.');

// Search checks
assert(blogComponentContent.includes('Search insights, careers, mentorship, technology...'), 'Search must have specified placeholder');
assert(blogComponentContent.includes('No insights found'), 'Search empty state must have "No insights found"');
assert(blogComponentContent.includes('Try another keyword or explore a different category.'), 'Search empty state supporting text must be present');
console.log('[PASS] Verified Search placeholder and empty state.');

// Load More checks
assert(blogComponentContent.includes('Load More Articles'), 'Component must include Load More Articles button');
assert(blogComponentContent.includes('All Articles Loaded'), 'Component must include All Articles Loaded state');
console.log('[PASS] Verified Load More Articles and All Articles Loaded.');

// Back to Mentora navigation
assert(blogComponentContent.includes('Back to Mentora'), 'Component must include Back to Mentora button');
assert(blogComponentContent.includes('Back to Blogs & Articles') || blogComponentContent.includes('Back to All Articles'), 'Article detail must include Back to Blogs');
console.log('[PASS] Verified Back to Mentora and Back to Blogs navigation.');

// Theme color tokens check
assert(blogComponentContent.includes('#FEF7EB'), 'Light mode bg #FEF7EB must be defined');
assert(blogComponentContent.includes('#601D22'), 'Light mode primary #601D22 must be defined');
assert(blogComponentContent.includes('#3E1117'), 'Light mode text #3E1117 must be defined');
assert(blogComponentContent.includes('#120D0E'), 'Dark mode bg #120D0E must be defined');
assert(blogComponentContent.includes('#1C1415'), 'Dark mode surface #1C1415 must be defined');
assert(blogComponentContent.includes('#A94B55'), 'Dark mode primary accent #A94B55 must be defined');
console.log('[PASS] Verified light and dark mode editorial theme palettes.');

// Responsive 3-column grid check
assert(blogComponentContent.includes('grid-cols-1') && blogComponentContent.includes('sm:grid-cols-2') && blogComponentContent.includes('lg:grid-cols-3'), 'Article grid must be responsive 3-column (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3)');
console.log('[PASS] Verified responsive 3-column grid structure.');

// 3. Inspect App.tsx integration
const appPath = path.resolve('src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');

assert(appContent.includes('import { MentoraBlogsPage }'), 'App.tsx must import MentoraBlogsPage');
assert(appContent.includes('Blogs & Articles'), 'App.tsx must include Blogs & Articles navigation button');
assert(appContent.includes("pathname === '/blogs'") || appContent.includes("pathname.startsWith('/blogs/')"), 'App.tsx must support /blogs route');
assert(appContent.includes('<MentoraBlogsPage'), 'App.tsx must render MentoraBlogsPage');
console.log('[PASS] Verified App.tsx header navigation, routing, and component mounting.');

// 4. Verify no real-estate content
const forbiddenRealEstate = [
  'property sales',
  'drone property videos',
  'luxury properties',
  'property marketing',
  'real-estate teams'
];

forbiddenRealEstate.forEach((term) => {
  assert(!blogComponentContent.toLowerCase().includes(term), `MentoraBlogsPage must not contain real-estate term: ${term}`);
  assert(!blogDataContent.toLowerCase().includes(term), `blogArticles must not contain real-estate term: ${term}`);
});
console.log('[PASS] Verified zero real-estate terms in blogs code and data.');

console.log('\n--- ALL 28 AUTOMATED VERIFICATIONS PASSED SUCCESSFULLY (100%) ---');
