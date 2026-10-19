// test_blogs_cms_e2e.mjs
// Comprehensive End-to-End Test Suite for Mentora Blogs & Articles Management System

const BASE_URL = 'http://localhost:5173';

const results = [];

async function test(name, fn) {
  try {
    process.stdout.write(`Testing: ${name}... `);
    await fn();
    console.log('✅ PASS');
    results.push({ name, passed: true });
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}`);
    results.push({ name, passed: false, error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function run() {
  console.log('=== STARTING MENTORA BLOGS CMS E2E VERIFICATION ===\n');

  let createdArticleId = null;
  const testSlug = `e2e-test-article-${Date.now()}`;
  const testTitle = `Test Article Title ${Date.now()}`;

  // Test 9: Unauthorized access (Non-admin blocked with 403)
  await test('9. Unauthorized Access Prevention (Non-admin blocked with 403 Forbidden)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/blogs`);
    assert(res.status === 403, `Expected status 403 for unauthorized call, got ${res.status}`);
    const data = await res.json();
    assert(data.success === false, 'Expected success: false');
    assert(data.error && data.error.includes('Admin access required'), 'Expected Admin access required error message');
  });

  // Test 1: Create new article as Draft
  await test('1. Create New Article as Draft (Saved in MongoDB)', async () => {
    const payload = {
      title: testTitle,
      slug: testSlug,
      type: 'article',
      category: 'Leadership',
      excerpt: 'This is an end-to-end test excerpt created during verification.',
      readTime: '4 min read',
      coverImage: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
      status: 'draft',
      featured: false,
      author: {
        name: 'Dr. Jane E2E Tester',
        role: 'Senior Governance Fellow',
        avatar: ''
      },
      sections: [
        { id: 'sec-1', type: 'paragraph', content: 'Opening paragraph of the automated test article.' },
        { id: 'sec-2', type: 'quote', content: 'Integrity is doing the right thing when no one is watching.', author: 'C.S. Lewis' },
        { id: 'sec-3', type: 'callout', content: 'Key takeaway from the governance review.' }
      ],
      keyTakeaways: ['First automated takeaway', 'Second automated takeaway']
    };

    const res = await fetch(`${BASE_URL}/api/admin/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': 'admin'
      },
      body: JSON.stringify(payload)
    });

    assert(res.status === 201, `Expected status 201, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success === true');
    assert(data.article && data.article.id, 'Expected returned article with ID');
    assert(data.article.status === 'draft', 'Expected article status to be draft');
    createdArticleId = data.article.id;

    // Verify it is NOT on public GET /api/blogs
    const pubRes = await fetch(`${BASE_URL}/api/blogs`);
    const pubData = await pubRes.json();
    const foundOnPublic = pubData.articles.some(a => a.id === createdArticleId || a.slug === testSlug);
    assert(!foundOnPublic, 'Draft article must NOT appear on public endpoint');
  });

  // Test 2: Publish article (Draft -> Published)
  await test('2. Publish Article (Draft -> Published and instantly visible on public endpoint)', async () => {
    assert(createdArticleId, 'Article ID required');
    const res = await fetch(`${BASE_URL}/api/admin/blogs/${createdArticleId}/publish`, {
      method: 'POST',
      headers: { 'x-admin-role': 'admin' }
    });
    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success === true');
    assert(data.article.status === 'published', 'Article status must now be published');

    // Verify it IS now on public GET /api/blogs
    const pubRes = await fetch(`${BASE_URL}/api/blogs`);
    const pubData = await pubRes.json();
    const foundOnPublic = pubData.articles.find(a => a.id === createdArticleId);
    assert(foundOnPublic, 'Published article MUST now appear on public endpoint');
    assert(foundOnPublic.title === testTitle, 'Title on public endpoint must match');
  });

  // Test 3: Edit article title
  const updatedTitle = `Updated E2E Title ${Date.now()}`;
  await test('3. Edit Article Title (MongoDB update synchronized with public page)', async () => {
    assert(createdArticleId, 'Article ID required');
    const res = await fetch(`${BASE_URL}/api/admin/blogs/${createdArticleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': 'admin'
      },
      body: JSON.stringify({
        title: updatedTitle
      })
    });
    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success === true');
    assert(data.article.title === updatedTitle, 'Updated title must match in response');

    // Verify change is reflected in public single slug endpoint
    const slugRes = await fetch(`${BASE_URL}/api/blogs/${testSlug}`);
    assert(slugRes.status === 200, `Expected slug lookup status 200, got ${slugRes.status}`);
    const slugData = await slugRes.json();
    assert(slugData.article.title === updatedTitle, 'Public slug page must reflect new title');
  });

  // Test 4: Featured image update
  const newCoverImage = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80';
  await test('4. Featured Image Update (Immediate image synchronization)', async () => {
    assert(createdArticleId, 'Article ID required');
    const res = await fetch(`${BASE_URL}/api/admin/blogs/${createdArticleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': 'admin'
      },
      body: JSON.stringify({
        coverImage: newCoverImage
      })
    });
    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    const data = await res.json();
    assert(data.article.coverImage === newCoverImage, 'Cover image must match updated value');

    // Check public slug endpoint
    const slugRes = await fetch(`${BASE_URL}/api/blogs/${testSlug}`);
    const slugData = await slugRes.json();
    assert(slugData.article.coverImage === newCoverImage || slugData.article.image === newCoverImage, 'Public endpoint must reflect new image');
  });

  // Test 5: Set article as featured (Strict single primary featured article rule)
  await test('5. Set Article as Featured (Strict single primary featured article rule enforced)', async () => {
    assert(createdArticleId, 'Article ID required');
    const res = await fetch(`${BASE_URL}/api/admin/blogs/${createdArticleId}/feature`, {
      method: 'POST',
      headers: { 'x-admin-role': 'admin' }
    });
    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success === true');
    assert(data.article.featured === true, 'Article must now have featured === true');

    // Verify across all admin blogs that ONLY 1 article has featured === true
    const allRes = await fetch(`${BASE_URL}/api/admin/blogs`, {
      headers: { 'x-admin-role': 'admin' }
    });
    const allData = await allRes.json();
    const featuredArticles = allData.articles.filter(a => a.featured === true);
    assert(featuredArticles.length === 1, `Expected exactly 1 featured article, found ${featuredArticles.length}`);
    assert(featuredArticles[0].id === createdArticleId, 'The single featured article must be the one we just toggled');
  });

  // Test 6: Unpublish article (Draft not visible on public page)
  await test('6. Unpublish Article (Draft/Unpublished status removes from public view)', async () => {
    assert(createdArticleId, 'Article ID required');
    const res = await fetch(`${BASE_URL}/api/admin/blogs/${createdArticleId}/unpublish`, {
      method: 'POST',
      headers: { 'x-admin-role': 'admin' }
    });
    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success === true');
    assert(data.article.status === 'draft', 'Article status must now be draft');

    // Check public list - must NOT be present
    const pubRes = await fetch(`${BASE_URL}/api/blogs`);
    const pubData = await pubRes.json();
    const foundOnPublic = pubData.articles.some(a => a.id === createdArticleId);
    assert(!foundOnPublic, 'Unpublished article must NOT appear on public list');

    // Check public slug endpoint - regular request must return 404
    const slugRes = await fetch(`${BASE_URL}/api/blogs/${testSlug}`);
    assert(slugRes.status === 404, `Public slug endpoint must return 404 for draft, got ${slugRes.status}`);

    // However, with preview=true query and admin credentials, it should return the article for Admin preview
    const previewRes = await fetch(`${BASE_URL}/api/blogs/${testSlug}?preview=true`, {
      headers: { 'x-admin-role': 'admin' }
    });
    assert(previewRes.status === 200, `Preview endpoint must allow previewing draft, got ${previewRes.status}`);
  });

  // Test 7: Delete article (Permanently removed from MongoDB)
  await test('7. Delete Article (Permanently deleted from database)', async () => {
    assert(createdArticleId, 'Article ID required');
    const res = await fetch(`${BASE_URL}/api/admin/blogs/${createdArticleId}`, {
      method: 'DELETE',
      headers: { 'x-admin-role': 'admin' }
    });
    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success === true');

    // Verify it is gone from admin list
    const adminRes = await fetch(`${BASE_URL}/api/admin/blogs`, {
      headers: { 'x-admin-role': 'admin' }
    });
    const adminData = await adminRes.json();
    const foundInAdmin = adminData.articles.some(a => a.id === createdArticleId);
    assert(!foundInAdmin, 'Deleted article must NOT exist in admin database');
  });

  // Test 8: Category filtering and dynamic categories
  await test('8. Category Filtering & Management (Dynamic MongoDB categories)', async () => {
    // Fetch public categories
    const catRes = await fetch(`${BASE_URL}/api/blogs/categories`);
    assert(catRes.status === 200, `Expected status 200, got ${catRes.status}`);
    const catData = await catRes.json();
    assert(catData.success === true, 'Expected success === true');
    assert(Array.isArray(catData.categories) && catData.categories.length > 0, 'Categories must be an array');

    // Add a new dynamic category via Admin API
    const newCategoryName = `E2E Tech ${Date.now().toString().slice(-4)}`;
    const addCatRes = await fetch(`${BASE_URL}/api/admin/blogs/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': 'admin'
      },
      body: JSON.stringify({ name: newCategoryName })
    });
    assert(addCatRes.status === 201, `Expected status 201 for adding category, got ${addCatRes.status}`);
    const addCatData = await addCatRes.json();
    assert(addCatData.category && addCatData.category.name === newCategoryName, 'Added category name must match');

    // Verify it appears in public categories list
    const verifyCatRes = await fetch(`${BASE_URL}/api/blogs/categories`);
    const verifyCatData = await verifyCatRes.json();
    const hasNewCat = verifyCatData.categories.some(c => c.name === newCategoryName);
    assert(hasNewCat, 'New category must be dynamically listed in public categories');

    // Clean up created category
    await fetch(`${BASE_URL}/api/admin/blogs/categories/${addCatData.category.id}`, {
      method: 'DELETE',
      headers: { 'x-admin-role': 'admin' }
    });
  });

  console.log('\n=== ALL 9 VERIFICATION TESTS COMPLETED ===');
  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
