/* Run with: node --test tests/article-access.test.cjs (requires project TypeScript). */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

function load(file, mocks = {}) {
  const filename = path.join(root, file)
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
    reportDiagnostics: true,
  })
  assert.equal((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
  const instance = new Module(filename, module)
  instance.filename = filename
  instance.paths = Module._nodeModulePaths(path.dirname(filename))
  instance.require = name => {
    if (name === 'server-only') return {}
    if (Object.hasOwn(mocks, name)) return mocks[name]
    return require(name)
  }
  instance._compile(result.outputText, filename)
  return instance.exports
}

const crypto = load('lib/core/blog-access/crypto.ts')
const secret = 'test-only-server-secret-'.repeat(3)
const differentSecret = 'test-only-other-server-secret-'.repeat(3)
const articleCode = '明月照山河2026'
const now = Date.UTC(2026, 8, 29, 12)
let stored

test('code hashing and article-bound grants', async t => {
  stored = await crypto.hashArticleCode(articleCode)
  await t.test('only valid non-empty code phrases are accepted', () => {
    for (const value of [null, '', '   ', 'abc', 'x'.repeat(129), 1234]) {
      assert.equal(crypto.validArticleCode(value), false)
    }
    assert.equal(crypto.validArticleCode(articleCode), true)
  })
  await t.test('scrypt hash never contains the original code; salts are randomized', async () => {
    assert.match(stored, /^s1:[a-f0-9]{32}:[a-f0-9]{64}$/)
    assert.equal(stored.includes(articleCode), false)
    assert.notEqual(await crypto.hashArticleCode(articleCode), stored)
  })
  await t.test('correct and wrong code are distinguished without normalization', async () => {
    assert.equal(await crypto.verifyArticleCode(articleCode, stored), true)
    assert.equal(await crypto.verifyArticleCode('incorrect', stored), false)
    assert.equal(await crypto.verifyArticleCode(`${articleCode} `, stored), false)
    assert.equal(await crypto.verifyArticleCode('incorrect', 's1:bad:bad'), false)
  })
  const grant = crypto.signArticleGrant(3, stored, secret, now)
  await t.test('a correct grant authorizes only its article and server key', () => {
    assert.equal(crypto.verifyArticleGrant(grant, 3, stored, secret, now), true)
    assert.equal(crypto.verifyArticleGrant(grant, 4, stored, secret, now), false)
    assert.equal(crypto.verifyArticleGrant(grant, 3, stored, differentSecret, now), false)
    assert.equal(grant.includes(stored), false)
    assert.equal(grant.includes(articleCode), false)
  })
  await t.test('expired/future/tampered tokens fail', () => {
    assert.equal(crypto.verifyArticleGrant(grant, 3, stored, secret, now + 12 * 3600 * 1000), false)
    assert.equal(crypto.verifyArticleGrant(grant, 3, stored, secret, now - 10000), false)
    const bad = `${grant.slice(0, -1)}${grant.endsWith('0') ? '1' : '0'}`
    for (const token of [bad, '', undefined, 'v1.NaN.bad', grant + '.extra']) {
      assert.equal(crypto.verifyArticleGrant(token, 3, stored, secret, now), false)
    }
  })
  await t.test('rotating a code or re-enabling the same code invalidates the old grant', async () => {
    const newHash = await crypto.hashArticleCode(articleCode)
    assert.equal(crypto.verifyArticleGrant(grant, 3, newHash, secret, now), false)
  })
})

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
const chain = data => ({ from() { return this }, where() { return this },
  limit() { return Promise.resolve(data) } })

function http(canRead = async () => false) {
  return load('lib/core/blog-access/http.ts', {
    'next/server': { NextResponse: MockResponse },
    '@/config/env/server-env': { serverEnv: { SITE_URL: 'https://blog.example' } },
    './service': { canReadArticle: canRead },
  })
}
const jsonRequest = (body, origin = 'https://blog.example') => new Request('https://blog.example/api/test', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

test('HTTP validation and private responses', async t => {
  const tools = http()
  await t.test('enforces same-origin JSON', () => {
    assert.equal(tools.trustedCodeRequest(jsonRequest({})), true)
    assert.equal(tools.trustedCodeRequest(jsonRequest({}, 'https://evil.example')), false)
    assert.equal(tools.trustedCodeRequest(new Request('https://blog.example')), false)
  })
  await t.test('accepts JSON objects only and limits actual bytes', async () => {
    assert.deepEqual(await tools.readCodeJson(jsonRequest({ code: 'safe-code' })), { code: 'safe-code' })
    assert.equal(await tools.readCodeJson(jsonRequest(['bad'])), null)
    assert.equal(await tools.readCodeJson(jsonRequest({ code: 'x'.repeat(5000) })), null)
    const request = jsonRequest({ code: 'x'.repeat(5000) })
    const result = await Promise.race([
      tools.readCodeJson(request.clone()), new Promise(resolve => setTimeout(() => resolve('timeout'), 500)),
    ])
    assert.equal(result, null, 'oversized cloned requests must not hang on stream cancellation')
    void request.body.cancel()
  })
  await t.test('responses cannot be publicly cached', () => {
    const r = tools.privateJson({ title: 'public' }, 403)
    assert.equal(r.status, 403)
    assert.match(r.headers.get('cache-control'), /private, no-store/)
    assert.equal(r.headers.get('vary'), 'Cookie')
  })
})

test('public JSON article route never discloses locked bodies', async t => {
  for (const allowed of [false, true]) {
    await t.test(allowed ? 'unlocked body works' : 'locked title is public but body is absent', async () => {
      let renders = 0
      const route = load('app/api/(public)/blog/[slug]/route.ts', {
        'drizzle-orm': { and, eq }, '@/db/instance': { db: { query: { blogs: { findFirst: async () => source } } } },
        '@/db/schema': tables, '@/lib/core/blog-access/service': { canReadArticle: async () => allowed },
        '@/lib/core/blog-access/http': http(),
        '@/lib/core/markdown/processor': { processor: { process: async body => { renders++; return body } } },
      })
      const r = await route.GET(new Request('https://blog.example'), { params: Promise.resolve({ slug: source.slug }) })
      const data = await r.json()
      assert.equal(data.title, source.title)
      assert.equal(r.status, allowed ? 200 : 403)
      assert.equal(JSON.stringify(data).includes('SECRET_BODY_SENTINEL'), allowed)
      assert.equal(renders, allowed ? 1 : 0)
    })
  }
})

test('all language article pages gate before Markdown rendering', async t => {
  for (const language of ['zh', 'en', 'zh-tw', 'ja', 'ru', 'de']) {
    await t.test(language, async () => {
      let renders = 0
      const page = load('ui/(main)/blog/[slug]/index.tsx', {
        'drizzle-orm': { and, eq }, 'next/navigation': { notFound() { throw new Error('404') } },
        'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
        '@/db/instance': { db: { query: { blogs: { findFirst: async () => source } },
          select: () => chain([{ title: 'Public localized title', sourceUpdatedAt: new Date(now) }]) } },
        '@/db/schema': tables,
        '@/lib/core/blog-access/service': { canReadArticle: async () => false },
        '@/lib/core/markdown/processor': { processor: { process: async body => { renders++; return body } } },
        '@/ui/(main)/blog/article-code-gate': { ArticleCodeGate: 'ArticleCodeGate' },
        '@/ui/(main)/blog/article-display-page': { default: 'ArticleDisplayPage' },
        '@/ui/(main)/blog/comment-card/deferred-comment-card': { default: 'Comments' },
        '@/ui/components/shared/horizontal-dividing-line': { default: 'Divider' },
        '@/ui/components/shared/main-scroll-blur': { MainScrollBlur: 'Blur' },
      })
      const result = await page.BlogDetail({ slug: source.slug, language })
      assert.equal(result.type, 'ArticleCodeGate')
      assert.equal(result.props.title, language === 'zh' ? source.title : 'Public localized title')
      assert.equal(renders, 0)
      assert.equal(JSON.stringify(result).includes(source.content), false)
      assert.deepEqual(Object.keys(result.props).sort(), ['language', 'slug', 'title'])
    })
  }
})

test('comment gate matches the original parser including duplicate query parameters', async t => {
  const ids = []
  let called = 0
  const gate = http(async id => { ids.push(id); return id !== 3 })
  const handler = gate.withArticleCommentAccess(async () => { called++; return MockResponse.json({ content: 'comment-body' }) })
  await t.test('GET duplicates cannot bypass the first targetId or targetType', async () => {
    const request = new Request('https://blog.example/api/comment?targetType=BLOG&targetId=3&targetType=OTHER&targetId=4')
    request.nextUrl = new URL(request.url)
    assert.equal((await handler(request)).status, 403)
    assert.equal(ids.at(-1), 3)
    assert.equal(called, 0)
  })
  await t.test('POST is also gated', async () => {
    assert.equal((await handler(jsonRequest({ targetType: 'BLOG', targetId: 3, content: 'secret' }))).status, 403)
    assert.equal(called, 0)
  })
  await t.test('authorized comments use private no-store', async () => {
    const request = new Request('https://blog.example/api/comment?targetType=BLOG&targetId=4')
    request.nextUrl = new URL(request.url)
    const response = await handler(request)
    assert.equal(response.status, 200)
    assert.equal(called, 1)
    assert.match(response.headers.get('cache-control'), /no-store/)
  })
})

test('unlock endpoint validates code, budget, current version and cookie flags', async t => {
  const storedHash = await crypto.hashArticleCode(articleCode)
  async function run({ correct = true, budget = true, rotate = false, origin = 'https://blog.example' } = {}) {
    let reads = 0
    const route = load('app/api/(public)/blog/[slug]/unlock/route.ts', {
      'drizzle-orm': { eq, and }, '@/config/env/server-env': { serverEnv: { SITE_URL: 'https://blog.example', BETTER_AUTH_SECRET: secret } },
      '@/db/instance': { db: { select: () => chain([{ id: 3, title: 'public' }]) } }, '@/db/schema': tables,
      '@/lib/core/blog-access/crypto': crypto, '@/lib/core/blog-access/http': http(),
      '@/lib/core/blog-access/service': {
        articleCookieName: id => `ailoxi-article-${id}`,
        readArticleAccess: async () => { reads++; return { codeHash: rotate && reads > 1 ? 'rotated-hash' : storedHash } },
        takeUnlockAttempt: async () => budget,
      },
    })
    return route.POST(jsonRequest({ code: correct ? articleCode : 'incorrect' }, origin), { params: Promise.resolve({ slug: 'test' }) })
  }
  await t.test('wrong code grants no cookie', async () => {
    const r = await run({ correct: false }); assert.equal(r.status, 403); assert.equal(r.setCookies.length, 0)
  })
  await t.test('cross-origin requests grant nothing', async () => {
    assert.equal((await run({ origin: 'https://evil.example' })).status, 403)
  })
  await t.test('rate limit wins before expensive verification', async () => {
    const r = await run({ budget: false }); assert.equal(r.status, 429); assert.equal(r.headers.get('Retry-After'), '600')
  })
  await t.test('rotation during verification is rejected', async () => {
    assert.equal((await run({ rotate: true })).status, 409)
  })
  await t.test('successful grants do not return secret or body; secure cookie is article bound', async () => {
    const r = await run()
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), { unlocked: true })
    const [name, token, options] = r.setCookies[0]
    assert.equal(name, 'ailoxi-article-3')
    assert.equal(options.httpOnly, true); assert.equal(options.secure, true)
    assert.equal(options.sameSite, 'lax'); assert.equal(options.path, '/')
    assert.equal(options.maxAge, crypto.GRANT_TTL_SECONDS)
    assert.equal(crypto.verifyArticleGrant(token, 3, storedHash, secret), true)
  })
})

test('admin route is deny-by-default without a signed-in administrator', async () => {
  const route = load('app/api/admin/blog-access/route.ts', {
    'drizzle-orm': { eq }, 'next/cache': { revalidatePath() {} },
    '@/db/instance': { db: {} }, '@/db/schema': tables, '@/db/schema/blog-access': {},
    '@/lib/core/auth/guard': { noPermission: async () => true },
    '@/lib/core/blog-access/crypto': crypto, '@/lib/core/blog-access/http': http(),
    '@/lib/core/blog-access/service': {}, '@/lib/i18n/config': { languages: ['zh', 'en', 'zh-tw', 'ja', 'ru', 'de'] },
  })
  assert.equal((await route.GET(new Request('https://blog.example/api/admin/blog-access?blogId=3'))).status, 403)
  assert.equal((await route.PATCH(jsonRequest({ blogId: 3, enabled: false }))).status, 403)
})

test('access table is separate from public Blog DTOs and pages disable shared output caching', () => {
  const schema = fs.readFileSync(path.join(root, 'db/schema/blog-access.ts'), 'utf8')
  assert.match(schema, /BlogAccess/)
  const page = fs.readFileSync(path.join(root, 'app/(main)/[language]/blog/[slug]/page.tsx'), 'utf8')
  assert.match(page, /dynamic = 'force-dynamic'/)
  assert.match(page, /columns: \{ id: true, title: true, updatedAt: true \}/)
  assert.doesNotMatch(page, /columns:.*content: true/)
  const comments = fs.readFileSync(path.join(root, 'app/api/(public)/comment/route.ts'), 'utf8')
  assert.match(comments, /GET = withArticleCommentAccess/)
  assert.match(comments, /POST = withArticleCommentAccess/)
})

test('service checks protection, administrator and article-specific cookie on each read', async t => {
  const hash = await crypto.hashArticleCode('alpha-code')
  async function check({ protectedArticle = true, admin = false, token } = {}) {
    const cookieRequests = []
    const service = load('lib/core/blog-access/service.ts', {
      'drizzle-orm': { eq, sql: () => 'sql' },
      'next/headers': { cookies: async () => ({ get: name => { cookieRequests.push(name); return token ? { value: token } : undefined } }) },
      '@/config/env/server-env': { serverEnv: { BETTER_AUTH_SECRET: secret } },
      '@/db/instance': { db: { select: () => chain(protectedArticle ? [{ blogId: 3, codeHash: hash }] : []) } },
      '@/db/schema/blog-access': { blogAccess: { blogId: 'access.id' }, blogUnlockBudget: {} },
      '@/lib/core/auth/guard': { noPermission: async () => !admin }, './crypto': crypto,
    })
    return { allowed: await service.canReadArticle(3), cookieRequests }
  }
  await t.test('unprotected article does not require a grant', async () => {
    assert.equal((await check({ protectedArticle: false })).allowed, true)
  })
  await t.test('a signed-in administrator may review the article', async () => {
    assert.equal((await check({ admin: true })).allowed, true)
  })
  await t.test('anonymous/unlocked/other-article tokens are isolated', async () => {
    assert.equal((await check()).allowed, false)
    const valid = await check({ token: crypto.signArticleGrant(3, hash, secret) })
    assert.equal(valid.allowed, true)
    assert.deepEqual(valid.cookieRequests, ['ailoxi-article-3'])
    assert.equal((await check({ token: crypto.signArticleGrant(4, hash, secret) })).allowed, false)
  })
})

test('admin can enable, retain, rotate and disable without disclosing the code hash', async () => {
  let current = null
  let budgetClears = 0
  const blogTable = { ...tables.blogs }
  const accessTable = { blogId: 'access.id' }
  const budgetTable = { blogId: 'budget.id' }
  const tx = {
    select: () => ({ table: null, from(table) { this.table = table; return this }, where() { return this },
      for() { return this }, limit() { return Promise.resolve(this.table === blogTable ? [{ id: 3, slug: 'sample' }] : current ? [current] : []) } }),
    insert: () => ({ values(value) { this.value = value; return this },
      async onConflictDoUpdate() { current = { ...this.value } } }),
    delete: table => ({ async where() { if (table === accessTable) current = null; else budgetClears++ } }),
  }
  const route = load('app/api/admin/blog-access/route.ts', {
    'drizzle-orm': { eq }, 'next/cache': { revalidatePath() {} },
    '@/db/instance': { db: { transaction: fn => fn(tx), select: tx.select } },
    '@/db/schema': { blogs: blogTable }, '@/db/schema/blog-access': { blogAccess: accessTable, blogUnlockBudget: budgetTable },
    '@/lib/core/auth/guard': { noPermission: async () => false },
    '@/lib/core/blog-access/crypto': crypto, '@/lib/core/blog-access/http': http(),
    '@/lib/core/blog-access/service': { readArticleAccess: async () => current },
    '@/lib/i18n/config': { languages: ['zh', 'en', 'zh-tw', 'ja', 'ru', 'de'] },
  })
  const patch = body => route.PATCH(jsonRequest({ blogId: 3, ...body }))
  assert.equal((await patch({ enabled: true })).status, 400)
  assert.equal((await patch({ enabled: true, code: 'abc' })).status, 400)
  let response = await patch({ enabled: true, code: 'alpha-code' })
  assert.equal(response.status, 200)
  const firstHash = current.codeHash
  assert.equal(await crypto.verifyArticleCode('alpha-code', firstHash), true)
  assert.equal(JSON.stringify(await response.json()).includes(firstHash), false)
  assert.equal((await patch({ enabled: true, code: '' })).status, 200)
  assert.equal(current.codeHash, firstHash)
  assert.equal((await patch({ enabled: true, code: 'beta-code' })).status, 200)
  assert.notEqual(current.codeHash, firstHash)
  assert.equal(await crypto.verifyArticleCode('beta-code', current.codeHash), true)
  response = await route.GET(new Request('https://blog.example/api/admin/blog-access?blogId=3'))
  assert.deepEqual(await response.json(), { enabled: true })
  assert.equal((await patch({ enabled: false })).status, 200)
  assert.equal(current, null)
  assert.equal(budgetClears, 3)
})
