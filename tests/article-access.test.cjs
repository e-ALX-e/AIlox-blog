/* Run with: node --test tests/article-access.test.cjs (requires project TypeScript).
 * Exercise real route/service/crypto/URL code with isolated framework and DB adapters.
 * These are regression tests, not a replacement for a real PostgreSQL/browser deployment test.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const secret = 'test-only-server-secret-'.repeat(3)
const now = Date.UTC(2026, 8, 29, 12)
const env = { SITE_URL: 'https://blog.example', BETTER_AUTH_SECRET: secret }
function load(file, mocks = {}) {
  const filename = path.join(root, file)
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename, reportDiagnostics: true,
  })
  assert.equal((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
  const instance = new Module(filename, module)
  instance.filename = filename
  instance.paths = Module._nodeModulePaths(path.dirname(filename))
  instance.require = name => {
    if (name === 'server-only') return {}
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name === '@/config/env/server-env') return { serverEnv: env }
    if (name === '@/lib/core/blog-access/share-link') return load('lib/core/blog-access/share-link.ts')
    if (name === '@/ui/(main)/blog/article-access-link-cleanup') return { ArticleAccessLinkCleanup: 'Cleanup' }
    return require(name)
  }
  instance._compile(result.outputText, filename)
  return instance.exports
}
const crypto = load('lib/core/blog-access/crypto.ts')
const links = load('lib/core/blog-access/share-link.ts')
const articleCode = '明月照山河2026'

class MockResponse extends Response {
  static json(value, options = {}) {
    const r = new MockResponse(JSON.stringify(value), options)
    r.setCookies = []
    r.cookies = { set(...args) { r.setCookies.push(args) } }
    return r
  }
}
const eq = (a, b) => ({ eq: [a, b] })
const and = (...conditions) => ({ and: conditions })
const tables = {
  blogs: { id: 'blog.id', slug: 'blog.slug', title: 'blog.title', isPublished: 'blog.published' },
  blogTranslations: { blogId: 'tr.blogId', language: 'tr.language', title: 'tr.title', content: 'tr.content', sourceUpdatedAt: 'tr.time' },
}
const source = {
  id: 3, title: '公开标题', slug: 'test-article', isPublished: true,
  content: 'SECRET_BODY_SENTINEL', updatedAt: new Date(now), createdAt: new Date(now),
  tagLinks: [{ tag: { tagName: '学习' } }],
}
const chain = data => ({ from() { return this }, where() { return this }, limit() { return Promise.resolve(data) } })
function http(canRead = async () => false) {
  return load('lib/core/blog-access/http.ts', {
    'next/server': { NextResponse: MockResponse }, './service': { canReadArticle: canRead },
  })
}
const jsonRequest = (body, origin = env.SITE_URL) => new Request(`${env.SITE_URL}/api/test`, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

test('code hashing and article-bound grants', async t => {
  const stored = await crypto.hashArticleCode(articleCode)
  await t.test('only valid non-empty code phrases are accepted', () => {
    for (const value of [null, '', '   ', 'abc', 'x'.repeat(129), 1234]) assert.equal(crypto.validArticleCode(value), false)
    assert.equal(crypto.validArticleCode(articleCode), true)
  })
  await t.test('randomized salt and hash never disclose the phrase', async () => {
    assert.match(stored, /^s1:[a-f0-9]{32}:[a-f0-9]{64}$/)
    assert.equal(stored.includes(articleCode), false)
    assert.notEqual(await crypto.hashArticleCode(articleCode), stored)
  })
  await t.test('correct, incorrect, whitespace and malformed hashes are distinguished', async () => {
    assert.equal(await crypto.verifyArticleCode(articleCode, stored), true)
    assert.equal(await crypto.verifyArticleCode('incorrect', stored), false)
    assert.equal(await crypto.verifyArticleCode(`${articleCode} `, stored), false)
    assert.equal(await crypto.verifyArticleCode(articleCode, 's1:bad:bad'), false)
  })
  const grant = crypto.signArticleGrant(3, stored, secret, now)
  await t.test('grant is article and server-key bound without exposing secrets', () => {
    assert.equal(crypto.verifyArticleGrant(grant, 3, stored, secret, now), true)
    assert.equal(crypto.verifyArticleGrant(grant, 4, stored, secret, now), false)
    assert.equal(crypto.verifyArticleGrant(grant, 3, stored, 'other-test-secret-'.repeat(3), now), false)
    assert.equal(grant.includes(stored), false)
    assert.equal(grant.includes(articleCode), false)
  })
  await t.test('expired, future and tampered grants fail', () => {
    assert.equal(crypto.verifyArticleGrant(grant, 3, stored, secret, now + 12 * 3600 * 1000), false)
    assert.equal(crypto.verifyArticleGrant(grant, 3, stored, secret, now - 10000), false)
    const bad = `${grant.slice(0, -1)}${grant.endsWith('0') ? '1' : '0'}`
    for (const token of [bad, '', undefined, 'v1.NaN.bad', grant + '.extra']) assert.equal(crypto.verifyArticleGrant(token, 3, stored, secret, now), false)
  })
  await t.test('rotation and re-enabling the same phrase invalidate old grants', async () => {
    assert.equal(crypto.verifyArticleGrant(grant, 3, await crypto.hashArticleCode(articleCode), secret, now), false)
  })
})

test('HTTP validation and private responses', async t => {
  const tools = http()
  await t.test('only same-origin JSON is accepted', () => {
    assert.equal(tools.trustedCodeRequest(jsonRequest({})), true)
    assert.equal(tools.trustedCodeRequest(jsonRequest({}, 'https://evil.example')), false)
    assert.equal(tools.trustedCodeRequest(new Request(env.SITE_URL)), false)
  })
  await t.test('JSON object and actual streamed byte limit are enforced', async () => {
    assert.deepEqual(await tools.readCodeJson(jsonRequest({ code: 'safe-code' })), { code: 'safe-code' })
    assert.equal(await tools.readCodeJson(jsonRequest(['bad'])), null)
    assert.equal(await tools.readCodeJson(jsonRequest({ code: 'x'.repeat(5000) })), null)
    const request = jsonRequest({ code: 'x'.repeat(5000) })
    assert.equal(await Promise.race([tools.readCodeJson(request.clone()), new Promise(resolve => setTimeout(() => resolve('timeout'), 500))]), null)
    void request.body.cancel()
  })
  await t.test('private/no-store and Cookie variance are preserved', () => {
    const r = tools.privateJson({ title: 'public' }, 403)
    assert.equal(r.status, 403)
    assert.match(r.headers.get('cache-control'), /private, no-store/)
    assert.equal(r.headers.get('vary'), 'Cookie')
  })
})

test('article access checks require an explicit admin exemption', async t => {
  const hash = await crypto.hashArticleCode('alpha-code')
  async function check({ protectedArticle = true, admin = false, adminBypass, token, dbError = false } = {}) {
    const cookieRequests = []
    let adminChecks = 0
    const service = load('lib/core/blog-access/service.ts', {
      'drizzle-orm': { eq, sql: () => 'sql' },
      'next/headers': { cookies: async () => ({ get: name => { cookieRequests.push(name); return token ? { value: token } : undefined } }) },
      '@/db/instance': { db: { select() { if (dbError) throw Error('DB unavailable'); return chain(protectedArticle ? [{ blogId: 3, codeHash: hash, adminBypass }] : []) } } },
      '@/db/schema/blog-access': { blogAccess: { blogId: 'access.id' }, blogUnlockBudget: {} },
      '@/lib/core/auth/guard': { noPermission: async () => { adminChecks++; return !admin } }, './crypto': crypto,
    })
    return { allowed: await service.canReadArticle(3), cookieRequests, adminChecks }
  }
  await t.test('ordinary articles need no cookie', async () => assert.equal((await check({ protectedArticle: false })).allowed, true))
  await t.test('missing flag does not give admins implicit access', async () => assert.equal((await check({ admin: true })).allowed, false))
  await t.test('off requires a real grant even for an admin', async () => {
    const result = await check({ admin: true, adminBypass: false })
    assert.equal(result.allowed, false); assert.equal(result.adminChecks, 0)
  })
  await t.test('only true enables admin bypass', async () => {
    assert.equal((await check({ admin: true, adminBypass: true })).allowed, true)
    for (const value of ['true', 1, null]) assert.equal((await check({ admin: true, adminBypass: value })).allowed, false)
  })
  await t.test('bypass on never grants anonymous/non-admin access', async () => assert.equal((await check({ adminBypass: true })).allowed, false))
  await t.test('valid 12h grants still work with bypass off', async () => {
    const result = await check({ admin: true, adminBypass: false, token: crypto.signArticleGrant(3, hash, secret) })
    assert.equal(result.allowed, true); assert.deepEqual(result.cookieRequests, ['ailoxi-article-3'])
  })
  await t.test('a different article token is never accepted', async () => assert.equal((await check({ token: crypto.signArticleGrant(4, hash, secret) })).allowed, false))
  await t.test('database failures never become public access', async () => await assert.rejects(check({ dbError: true })))
})

test('public article JSON route gates before processing the body', async t => {
  for (const allowed of [false, true]) await t.test(allowed ? 'authorized' : 'locked; query code is not authorization', async () => {
    let renders = 0
    const route = load('app/api/(public)/blog/[slug]/route.ts', {
      'drizzle-orm': { and, eq }, '@/db/instance': { db: { query: { blogs: { findFirst: async () => source } } } },
      '@/db/schema': tables, '@/lib/core/blog-access/service': { canReadArticle: async () => allowed },
      '@/lib/core/blog-access/http': http(),
      '@/lib/core/markdown/processor': { processor: { process: async body => { renders++; return body } } },
    })
    const r = await route.GET(new Request(`${env.SITE_URL}/api/blog/test?code=alpha-code`), { params: Promise.resolve({ slug: source.slug }) })
    const data = await r.json()
    assert.equal(data.title, source.title); assert.equal(r.status, allowed ? 200 : 403)
    assert.equal(JSON.stringify(data).includes(source.content), allowed); assert.equal(renders, allowed ? 1 : 0)
  })
})

test('all six language pages keep titles public but withhold locked content', async t => {
  for (const language of ['zh', 'en', 'zh-tw', 'ja', 'ru', 'de']) await t.test(language, async () => {
    let renders = 0
    const page = load('ui/(main)/blog/[slug]/index.tsx', {
      'drizzle-orm': { and, eq }, 'next/navigation': { notFound() { throw Error('404') } },
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      '@/db/instance': { db: { query: { blogs: { findFirst: async () => source } }, select: () => chain([{ title: 'Public localized title', sourceUpdatedAt: new Date(now) }]) } },
      '@/db/schema': tables, '@/lib/core/blog-access/service': { canReadArticle: async () => false },
      '@/lib/core/markdown/processor': { processor: { process: async body => { renders++; return body } } },
      '@/ui/(main)/blog/article-code-gate': { ArticleCodeGate: 'ArticleCodeGate' },
      '@/ui/(main)/blog/article-display-page': { default: 'ArticleDisplayPage' },
      '@/ui/(main)/blog/comment-card/deferred-comment-card': { default: 'Comments' },
      '@/ui/components/shared/horizontal-dividing-line': { default: 'Divider' }, '@/ui/components/shared/main-scroll-blur': { MainScrollBlur: 'Blur' },
    })
    const result = await page.BlogDetail({ slug: source.slug, language })
    assert.equal(result.type, 'ArticleCodeGate'); assert.equal(result.props.title, language === 'zh' ? source.title : 'Public localized title')
    assert.equal(renders, 0); assert.equal(JSON.stringify(result).includes(source.content), false)
    assert.deepEqual(Object.keys(result.props).sort(), ['language', 'slug', 'title'])
  })
})

test('comment reads and writes share the same article gate', async t => {
  const ids = []; let called = 0
  const handler = http(async id => { ids.push(id); return id !== 3 }).withArticleCommentAccess(async () => { called++; return MockResponse.json({ content: 'comment-body' }) })
  await t.test('duplicate query targets cannot bypass GET', async () => {
    const req = new Request(`${env.SITE_URL}/api/comment?targetType=BLOG&targetId=3&targetType=OTHER&targetId=4`); req.nextUrl = new URL(req.url)
    assert.equal((await handler(req)).status, 403); assert.equal(ids.at(-1), 3); assert.equal(called, 0)
  })
  await t.test('POST remains protected', async () => { assert.equal((await handler(jsonRequest({ targetType: 'BLOG', targetId: 3, content: 'secret' }))).status, 403); assert.equal(called, 0) })
  await t.test('authorized responses remain private', async () => {
    const req = new Request(`${env.SITE_URL}/api/comment?targetType=BLOG&targetId=4`); req.nextUrl = new URL(req.url)
    const response = await handler(req); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/)
  })
})

test('unlock still validates the phrase, budget, rotation and cookie flags', async t => {
  const stored = await crypto.hashArticleCode(articleCode)
  async function run({ correct = true, budget = true, rotate = false, origin = env.SITE_URL } = {}) {
    let reads = 0
    const route = load('app/api/(public)/blog/[slug]/unlock/route.ts', {
      'drizzle-orm': { eq, and }, '@/db/instance': { db: { select: () => chain([{ id: 3, title: 'public' }]) } }, '@/db/schema': tables,
      '@/lib/core/blog-access/crypto': crypto, '@/lib/core/blog-access/http': http(),
      '@/lib/core/blog-access/service': { articleCookieName: id => `ailoxi-article-${id}`,
        readArticleAccess: async () => ({ codeHash: rotate && ++reads > 1 ? 'rotated' : stored }), takeUnlockAttempt: async () => budget },
    })
    return route.POST(jsonRequest({ code: correct ? articleCode : 'incorrect' }, origin), { params: Promise.resolve({ slug: 'test' }) })
  }
  await t.test('wrong code gives no cookie', async () => { const r = await run({ correct: false }); assert.equal(r.status, 403); assert.equal(r.setCookies.length, 0) })
  await t.test('foreign origin is rejected', async () => assert.equal((await run({ origin: 'https://evil.example' })).status, 403))
  await t.test('budget rejection supplies Retry-After', async () => { const r = await run({ budget: false }); assert.equal(r.status, 429); assert.equal(r.headers.get('Retry-After'), '600') })
  await t.test('rotation in flight is rejected', async () => assert.equal((await run({ rotate: true })).status, 409))
  await t.test('success yields an expiring article-bound HttpOnly cookie, not body/hash', async () => {
    const r = await run(); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { unlocked: true })
    const [name, token, options] = r.setCookies[0]
    assert.equal(name, 'ailoxi-article-3'); assert.equal(options.httpOnly, true); assert.equal(options.secure, true)
    assert.equal(options.sameSite, 'lax'); assert.equal(options.path, '/'); assert.equal(options.maxAge, crypto.GRANT_TTL_SECONDS)
    assert.equal(crypto.verifyArticleGrant(token, 3, stored, secret), true)
  })
})

function adminHarness({ admin = true, published = true, exists = true } = {}) {
  let current = null; let budgetClears = 0; const invalidated = []
  const accessTable = { blogId: 'access.id' }; const budgetTable = { blogId: 'budget.id' }
  const tx = {
    select: () => ({ table: null, from(table) { this.table = table; return this }, where() { return this }, for() { return this },
      limit() { return Promise.resolve(this.table === tables.blogs ? exists ? [{ id: 3, slug: 'sample', isPublished: published }] : [] : current ? [current] : []) } }),
    insert: () => ({ values(value) { this.value = value; return this }, async onConflictDoUpdate() { current = { ...this.value } } }),
    update: () => ({ set(value) { this.value = value; return this }, async where() { current = { ...current, ...this.value } } }),
    delete: table => ({ async where() { if (table === accessTable) current = null; else budgetClears++ } }),
  }
  const route = load('app/api/admin/blog-access/route.ts', {
    'drizzle-orm': { eq }, 'next/cache': { revalidatePath(p) { invalidated.push(p) } },
    '@/db/instance': { db: { transaction: fn => fn(tx), select: tx.select } }, '@/db/schema': tables,
    '@/db/schema/blog-access': { blogAccess: accessTable, blogUnlockBudget: budgetTable },
    '@/lib/core/auth/guard': { noPermission: async () => !admin }, '@/lib/core/blog-access/crypto': crypto,
    '@/lib/core/blog-access/http': http(), '@/lib/core/blog-access/service': { readArticleAccess: async () => current },
    '@/lib/i18n/config': { languages: ['zh', 'en', 'zh-tw', 'ja', 'ru', 'de'] },
  })
  return { route, patch: body => route.PATCH(jsonRequest({ blogId: 3, ...body })),
    get current() { return current }, get budgetClears() { return budgetClears }, invalidated }
}

test('administrator controls persist independently without exposing code hashes', async t => {
  const h = adminHarness()
  await t.test('all three methods require an authenticated admin', async () => {
    const { route } = adminHarness({ admin: false })
    assert.equal((await route.GET(new Request(`${env.SITE_URL}/api/admin/blog-access?blogId=3`))).status, 403)
    assert.equal((await route.PATCH(jsonRequest({ blogId: 3, enabled: false }))).status, 403)
    assert.equal((await route.POST(jsonRequest({ blogId: 3, code: 'alpha-code' }))).status, 403)
  })
  await t.test('new protection needs a phrase and bypass is off by default', async () => {
    assert.equal((await h.patch({ enabled: true })).status, 400)
    assert.equal((await h.patch({ enabled: true, code: 'abc' })).status, 400)
    const r = await h.patch({ enabled: true, code: 'alpha-code' }); assert.equal(r.status, 200)
    assert.equal(h.current.adminBypass, false); assert.equal(await crypto.verifyArticleCode('alpha-code', h.current.codeHash), true)
    assert.equal(JSON.stringify(await r.json()).includes(h.current.codeHash), false)
  })
  await t.test('toggle-only changes keep the current phrase and grants', async () => {
    const original = h.current.codeHash
    assert.equal((await h.patch({ enabled: true, adminBypass: true })).status, 200)
    assert.equal(h.current.adminBypass, true); assert.equal(h.current.codeHash, original)
    const r = await h.route.GET(new Request(`${env.SITE_URL}/api/admin/blog-access?blogId=3`))
    assert.deepEqual(await r.json(), { enabled: true, adminBypass: true })
    assert.equal((await h.patch({ enabled: true, code: '' })).status, 200); assert.equal(h.current.adminBypass, true)
    assert.equal((await h.patch({ enabled: true, adminBypass: false })).status, 200); assert.equal(h.current.adminBypass, false)
    assert.equal(h.current.codeHash, original)
  })
  await t.test('non-boolean and cross-origin updates are rejected', async () => {
    for (const flag of ['true', null, 1]) assert.equal((await h.patch({ enabled: true, adminBypass: flag })).status, 400)
    assert.equal((await h.route.PATCH(jsonRequest({ blogId: 3, enabled: false }, 'https://evil.example'))).status, 403)
    assert.equal(h.current.adminBypass, false)
  })
  await t.test('code rotation preserves an omitted exemption setting', async () => {
    await h.patch({ enabled: true, adminBypass: true })
    const first = h.current.codeHash
    assert.equal((await h.patch({ enabled: true, code: 'beta-code' })).status, 200)
    assert.notEqual(h.current.codeHash, first); assert.equal(h.current.adminBypass, true)
    assert.equal(await crypto.verifyArticleCode('beta-code', h.current.codeHash), true)
  })
  await t.test('share links require a verified phrase even when admin bypass is on', async () => {
    const wrong = await h.route.POST(jsonRequest({ blogId: 3, code: 'wrong-code' }))
    assert.equal(wrong.status, 403); assert.equal((await wrong.json()).url, undefined)
    const r = await h.route.POST(jsonRequest({ blogId: 3, code: 'beta-code' }))
    assert.equal(r.status, 200); const data = await r.json()
    assert.equal(data.url, `${env.SITE_URL}/zh/blog/sample#code=beta-code`)
    assert.equal(r.setCookies.length, 0, 'creating a share link must not unlock the browser')
    assert.match(r.headers.get('cache-control'), /private, no-store/)
    assert.equal(JSON.stringify(data).includes(h.current.codeHash), false)
  })
  await t.test('share endpoint rejects cross-origin, malformed and unpublished requests', async () => {
    assert.equal((await h.route.POST(jsonRequest({ blogId: 3, code: 'beta-code' }, 'https://evil.example'))).status, 403)
    assert.equal((await h.route.POST(jsonRequest({ blogId: 3, code: 'abc' }))).status, 400)
    assert.equal((await adminHarness({ published: false }).route.POST(jsonRequest({ blogId: 3, code: 'valid-code' }))).status, 400)
    assert.equal((await adminHarness({ exists: false }).route.POST(jsonRequest({ blogId: 3, code: 'valid-code' }))).status, 404)
  })
  await t.test('disabling removes protection and clears the budget', async () => {
    assert.equal((await h.patch({ enabled: false })).status, 200); assert.equal(h.current, null)
    assert.equal(h.budgetClears, 3)
    assert.equal((await h.route.POST(jsonRequest({ blogId: 3, code: 'beta-code' }))).status, 400)
    assert.ok(h.invalidated.includes('/de/blog/sample')); assert.ok(h.invalidated.includes('/zh/blog/sample'))
  })
})

test('URL codes are decoded exactly once and scrubbed without affecting normal anchors', async t => {
  for (const phrase of ['alpha-code', '含空格 + & # ? % / 中文', '%2520literal', ' emoji😀中文 ', ' a + b ']) await t.test(`round trip ${JSON.stringify(phrase)}`, () => {
    const url = links.buildArticleCodeLink(env.SITE_URL, 'sample', phrase)
    assert.equal(new URL(url).search, '')
    assert.deepEqual(links.readArticleCodeLink(url), { code: phrase, cleanUrl: '/zh/blog/sample' })
  })
  await t.test('normal article URLs and anchors are untouched', () => {
    for (const suffix of ['', '#section-1', '?tag=x#section-1', '#my-code']) assert.equal(links.readArticleCodeLink(`${env.SITE_URL}/zh/blog/sample${suffix}`), null)
  })
  await t.test('query compatibility clears only code and retains other routing state', () => {
    assert.deepEqual(links.readArticleCodeLink(`${env.SITE_URL}/en/blog/sample?code=hello%2Bworld&tag=dev#chapter-2`), {
      code: 'hello+world', cleanUrl: '/en/blog/sample?tag=dev#chapter-2',
    })
  })
  await t.test('ambiguous duplicates and overlong codes are scrubbed and rejected', () => {
    for (const suffix of ['#code=one&code=two', '?code=one#code=two', '#code=' + 'x'.repeat(129)]) {
      const result = links.readArticleCodeLink(`${env.SITE_URL}/zh/blog/sample${suffix}`)
      assert.equal(result.code, null); assert.equal(result.cleanUrl, '/zh/blog/sample')
    }
  })
})

test('cache and metadata boundaries remain intact', () => {
  const schema = fs.readFileSync(path.join(root, 'db/schema/blog-access.ts'), 'utf8')
  assert.match(schema, /adminBypass.*default\(false\)/)
  const page = fs.readFileSync(path.join(root, 'app/(main)/[language]/blog/[slug]/page.tsx'), 'utf8')
  assert.match(page, /dynamic = 'force-dynamic'/); assert.match(page, /referrer: 'no-referrer'/)
  assert.match(page, /columns: \{ id: true, title: true, updatedAt: true \}/); assert.doesNotMatch(page, /columns:.*content: true/)
  const comments = fs.readFileSync(path.join(root, 'app/api/(public)/comment/route.ts'), 'utf8')
  assert.match(comments, /GET = withArticleCommentAccess/); assert.match(comments, /POST = withArticleCommentAccess/)
})

test('automatic URL unlocking submits once, cleans first, and never trusts the link itself', async t => {
  async function scenario({ suffix = '#code=correct-code', status = 200, repeatEffects = false, cleanupOnly = false } = {}) {
    const previousWindow = globalThis.window
    const previousFetch = globalThis.fetch
    let location = new URL(`${env.SITE_URL}/zh/blog/test-article${suffix}`)
    const events = []; const effects = []; const states = []; const listeners = new Map()
    let resolveFetch
    const response = new Promise(resolve => { resolveFetch = resolve })
    globalThis.window = {
      get location() { return location },
      history: { replaceState(_state, _unused, url) { events.push(['replace', url]); location = new URL(url, location) } },
      addEventListener(name, fn) { listeners.set(name, fn) },
      removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name) },
    }
    globalThis.fetch = (url, options) => { events.push(['fetch', url, options, location.href]); return response }
    const mocks = {
      react: { useRef: value => ({ current: value }), useCallback: fn => fn,
        useState: value => [value, value => states.push(value)], useEffect: fn => effects.push(fn) },
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      'next/navigation': { useRouter: () => ({ refresh: () => events.push(['refresh']) }),
        usePathname: () => location.pathname, useSearchParams: () => location.searchParams },
    }
    const cleanups = []
    try {
      if (cleanupOnly) load('ui/(main)/blog/article-access-link-cleanup.tsx', mocks).ArticleAccessLinkCleanup()
      else load('ui/(main)/blog/article-code-gate.tsx', mocks).ArticleCodeGate({ slug: 'test-article', title: '公开标题', language: 'zh' })
      for (const effect of effects) cleanups.push(effect())
      if (repeatEffects) {
        for (const fn of cleanups) fn?.()
        for (const effect of effects) effect()
      }
      resolveFetch({ ok: status === 200, status })
      await new Promise(resolve => setImmediate(resolve))
      return { events, states, url: location.href }
    } finally {
      for (const fn of cleanups) fn?.()
      globalThis.window = previousWindow
      globalThis.fetch = previousFetch
    }
  }
  await t.test('fragment code is scrubbed before a POST and only then refreshed', async () => {
    const result = await scenario()
    assert.equal(result.events[0][0], 'replace')
    const requests = result.events.filter(e => e[0] === 'fetch')
    assert.equal(requests.length, 1)
    assert.equal(requests[0][1], '/api/blog/test-article/unlock')
    assert.equal(requests[0][2].method, 'POST')
    assert.deepEqual(JSON.parse(requests[0][2].body), { code: 'correct-code' })
    assert.equal(requests[0][3], `${env.SITE_URL}/zh/blog/test-article`)
    assert.equal(result.events.at(-1)[0], 'refresh')
  })
  await t.test('React repeated effect setup does not duplicate an unlock attempt', async () => {
    const result = await scenario({ repeatEffects: true })
    assert.equal(result.events.filter(e => e[0] === 'fetch').length, 1)
    assert.equal(result.events.filter(e => e[0] === 'refresh').length, 1)
  })
  await t.test('wrong code and rate-limit replies do not refresh or expose a body', async () => {
    for (const status of [403, 429, 503]) {
      const result = await scenario({ status })
      assert.equal(result.events.some(e => e[0] === 'refresh'), false)
      assert.ok(result.states.some(value => typeof value === 'string' && value.length > 0))
      assert.equal(new URL(result.url).hash, '')
    }
  })
  await t.test('ambiguous code links are scrubbed without a request', async () => {
    const result = await scenario({ suffix: '?code=alpha#code=beta' })
    assert.equal(result.events.some(e => e[0] === 'fetch'), false)
    assert.equal(result.url, `${env.SITE_URL}/zh/blog/test-article`)
  })
  await t.test('already-authorized pages remove codes without creating another grant', async () => {
    const result = await scenario({ cleanupOnly: true })
    assert.equal(result.events.some(e => e[0] === 'fetch'), false)
    assert.equal(result.url, `${env.SITE_URL}/zh/blog/test-article`)
  })
  await t.test('normal chapter anchors do not trigger authentication or URL changes', async () => {
    const result = await scenario({ suffix: '#chapter-2' })
    assert.equal(result.events.length, 0)
    assert.equal(new URL(result.url).hash, '#chapter-2')
  })
})
