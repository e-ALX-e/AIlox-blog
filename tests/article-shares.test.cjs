/* node --test tests/article-shares.test.cjs
 * Real crypto/routes/link handling with isolated framework + in-memory DB adapters.
 * Does not replace a full Next.js build, PostgreSQL transaction test or browser E2E.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const secret = 'test-only-share-signing-secret-'.repeat(3)
const env = { SITE_URL: 'https://blog.example', BETTER_AUTH_SECRET: secret }
function load(file, mocks = {}) {
  const filename = path.join(root, file)
  const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  assert.deepEqual((diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error), [])
  const instance = new Module(filename, module)
  instance.filename = filename
  instance.paths = Module._nodeModulePaths(path.dirname(filename))
  instance.require = name => {
    if (name === 'server-only') return {}
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name === '@/config/env/server-env') return { serverEnv: env }
    return require(name)
  }
  instance._compile(outputText, filename)
  return instance.exports
}
const crypto = load('lib/core/blog-access/share-crypto.ts')
const codeCrypto = load('lib/core/blog-access/crypto.ts')
const links = load('lib/core/blog-access/share-link.ts')
const now = Date.now()
const codeHash = 's1:' + 'a'.repeat(32) + ':' + 'b'.repeat(64)
function fixture(overrides = {}) {
  const value = crypto.createShareToken()
  return { ...value, blogId: 3, note: 'for reviewer', createdBy: 'admin-id',
    createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000), revokedAt: null,
    accessVersion: crypto.shareAccessVersion(codeHash), ...overrides }
}

test('share token generation and comparison', async t => {
  const item = fixture()
  await t.test('256-bit random secret, unique id, hash-only storage', () => {
    assert.equal(item.token.length, 84)
    assert.equal(crypto.parseShareToken(item.token).id, item.id)
    assert.equal(Buffer.from(item.token.split('.')[2], 'base64url').length, 32)
    assert.match(item.tokenHash, /^[a-f0-9]{64}$/)
    const next = fixture()
    assert.notEqual(item.id, next.id); assert.notEqual(item.token, next.token)
    assert.equal(item.token.includes(codeHash), false)
  })
  await t.test('correct token matches; tampering, wrong id, hash-as-token fail', () => {
    assert.equal(crypto.verifyShareToken(item.token, item.tokenHash), true)
    const wrong = item.token.slice(0, -1) + (item.token.endsWith('a') ? 'b' : 'a')
    for (const value of [wrong, item.token.replace(item.id, fixture().id), item.tokenHash, null, '', item.id]) {
      assert.equal(crypto.verifyShareToken(value, item.tokenHash), false)
    }
    assert.equal(crypto.verifyShareToken(item.token, 'bad-hash'), false)
    assert.equal(crypto.parseShareToken(item.token.replaceAll('.', 'x')), null)
  })
  await t.test('salting still validates the existing human-entered phrase', async () => {
    const hash = await codeCrypto.hashArticleCode('测试暗号2026')
    assert.equal(await codeCrypto.verifyArticleCode('测试暗号2026', hash), true)
    assert.equal(await codeCrypto.verifyArticleCode('错误暗号2026', hash), false)
    assert.equal(hash.includes('测试暗号2026'), false)
  })
})

test('share session signatures and expiry are scope-bound', async t => {
  const item = fixture()
  const grant = crypto.signShareGrant(item, codeHash, secret, now)
  await t.test('correct article and code version only', () => {
    assert.equal(crypto.readShareGrant(grant.token, 3, codeHash, secret, now).id, item.id)
    assert.equal(crypto.readShareGrant(grant.token, 4, codeHash, secret, now), null)
    assert.equal(crypto.readShareGrant(grant.token, 3, codeHash + 'changed', secret, now), null)
    assert.equal(crypto.readShareGrant(grant.token, 3, codeHash, 'other'.repeat(10), now), null)
    assert.equal(grant.token.includes(item.token.split('.')[2]), false)
    assert.equal(codeCrypto.verifyArticleGrant(grant.token, 3, codeHash, secret, now), false)
  })
  await t.test('lifetime cannot exceed 12h or the share deadline', () => {
    assert.equal(grant.maxAge, 12 * 3600)
    assert.equal(crypto.readShareGrant(grant.token, 3, codeHash, secret, now + 12 * 3600000), null)
    const short = crypto.signShareGrant({ ...item, expiresAt: new Date(now + 60000) }, codeHash, secret, now)
    assert.equal(short.maxAge, 60)
    assert.equal(crypto.readShareGrant(short.token, 3, codeHash, secret, now + 60000), null)
    assert.throws(() => crypto.signShareGrant({ ...item, expiresAt: new Date(now - 1000) }, codeHash, secret, now))
  })
  await t.test('tampered cookies and invalid records cannot issue grants', () => {
    assert.equal(crypto.readShareGrant(grant.token + '.extra', 3, codeHash, secret, now), null)
    assert.equal(crypto.readShareGrant(grant.token.replace(item.id, fixture().id), 3, codeHash, secret, now), null)
    for (const value of ['', undefined, item.token, grant.token.slice(0, -2)]) assert.equal(crypto.readShareGrant(value, 3, codeHash, secret, now), null)
    assert.throws(() => crypto.signShareGrant({ ...item, revokedAt: new Date() }, codeHash, secret, now))
    assert.throws(() => crypto.signShareGrant(item, codeHash + 'rotated', secret, now))
  })
})

const tables = {
  blogs: { table: 'blogs', id: 'id', slug: 'slug', isPublished: 'isPublished' },
  blogAccess: { table: 'access', blogId: 'blogId', codeHash: 'codeHash' },
  blogShares: { table: 'shares', id: 'id', blogId: 'blogId', revokedAt: 'revokedAt', expiresAt: 'expiresAt', accessVersion: 'accessVersion', createdAt: 'createdAt' },
}
const orm = {
  eq: (a, b) => row => row[a] === b,
  gt: (a, b) => row => row[a] > b,
  isNull: a => row => row[a] == null,
  and: (...conditions) => row => conditions.every(test => !test || test(row)),
  desc: key => key,
  sql: () => ({ count: true }),
}
function database(shares = []) {
  const store = { blogs: [{ id: 3, slug: 'sample', isPublished: true }],
    access: [{ blogId: 3, codeHash, adminBypass: false }],
    shares: shares.map(({ token, ...row }) => row) }
  const operations = []
  const db = {
    select(projection) {
      return { table: '', predicate: () => true, take: Infinity,
        from(table) { this.table = table.table; return this },
        where(predicate) { this.predicate = predicate; return this },
        for(kind) { operations.push(`lock:${kind}`); return this },
        limit(n) { this.take = n; return this },
        orderBy() { return this },
        then(resolve, reject) {
          try {
            operations.push(`select:${this.table}`)
            const values = store[this.table].filter(this.predicate).slice(0, this.take)
            const result = projection?.value?.count ? [{ value: values.length }] : values.map(row => projection
              ? Object.fromEntries(Object.entries(projection).map(([name, col]) => [name, row[col]])) : { ...row })
            return Promise.resolve(result).then(resolve, reject)
          } catch (error) { return Promise.reject(error).then(resolve, reject) }
        },
      }
    },
    insert(table) { return { values(row) { return { returning: async () => {
      operations.push(`insert:${table.table}`)
      const record = { createdAt: new Date(), revokedAt: null, ...row }
      store[table.table].push(record)
      return [{ ...record }]
    } } } } },
    update(table) { return { set(patch) { return { where(predicate) { return { returning: async projection => {
      operations.push(`update:${table.table}`)
      const rows = store[table.table].filter(predicate)
      rows.forEach(row => Object.assign(row, patch))
      return rows.map(row => projection ? Object.fromEntries(Object.entries(projection).map(([key, field]) => [key, row[field]])) : row)
    } } } } } } },
    transaction: async fn => fn(db),
  }
  return { db, store, operations }
}
class MockResponse extends Response {
  static json(value, options = {}) {
    const result = new MockResponse(JSON.stringify(value), options)
    result.issued = []
    result.cookies = { set: (...args) => result.issued.push(args) }
    return result
  }
}
function http(canRead = async () => false) {
  return load('lib/core/blog-access/http.ts', {
    'next/server': { NextResponse: MockResponse }, './service': { canReadArticle: canRead },
  })
}
const request = (body, method = 'POST', origin = env.SITE_URL) => new Request(`${env.SITE_URL}/api/test`, {
  method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
function shareService(db) {
  return load('lib/core/blog-access/share-service.ts', { 'drizzle-orm': orm,
    '@/db/instance': { db }, '@/db/schema/blog-share': tables, './share-crypto': crypto })
}
function adminRoute(db, isAdmin = true) {
  return load('app/api/admin/blog-shares/route.ts', {
    'drizzle-orm': orm, '@/db/instance': { db }, '@/db/schema': tables,
    '@/db/schema/blog-share': tables, '@/db/schema/blog-access': tables,
    '@/lib/core/auth/guard': { noPermission: async () => !isAdmin, requireSignedInUser: async () => ({ id: 'admin-id' }) },
    '@/lib/core/blog-access/http': http(), '@/lib/core/blog-access/share-crypto': crypto,
    '@/lib/core/blog-access/share-link': links, '@/lib/i18n/config': { languages: ['zh', 'en', 'zh-tw', 'ja', 'ru', 'de'] },
  })
}

test('admin API guards creation, listing and revocation on the server', async t => {
  await t.test('a logged-out/non-admin reader cannot create, list or revoke even with a share token', async () => {
    const state = database([fixture()]); const route = adminRoute(state.db, false)
    assert.equal((await route.GET(new Request(`${env.SITE_URL}/api/admin/blog-shares?blogId=3`))).status, 403)
    assert.equal((await route.POST(request({ blogId: 3, token: fixture().token }))).status, 403)
    assert.equal((await route.DELETE(request({ blogId: 3, id: state.store.shares[0].id }, 'DELETE'))).status, 403)
    assert.equal(state.operations.length, 0)
  })
  await t.test('cross-origin POST/DELETE rejected before DB writes', async () => {
    const state = database(); const route = adminRoute(state.db)
    assert.equal((await route.POST(request({ blogId: 3 }, 'POST', 'https://evil.example'))).status, 403)
    assert.equal((await route.DELETE(request({ blogId: 3, id: fixture().id }, 'DELETE', 'https://evil.example'))).status, 403)
    assert.equal(state.operations.length, 0)
  })
  await t.test('admin creates without knowing the phrase; default lifetime 7 days, hash only persisted', async () => {
    const state = database(); const route = adminRoute(state.db)
    const response = await route.POST(request({ blogId: 3, note: '招聘方', language: 'de' }))
    assert.equal(response.status, 201)
    const data = await response.json()
    const supplied = links.readArticleAccessLink(data.url)
    assert.equal(supplied.kind, 'share')
    assert.match(data.url, /\/de\/blog\/sample#share=/)
    assert.equal(crypto.verifyShareToken(supplied.value, state.store.shares[0].tokenHash), true)
    assert.equal(state.store.shares[0].createdBy, 'admin-id')
    assert.equal(JSON.stringify(state.store).includes(supplied.value), false)
    assert.equal(JSON.stringify(data.share).includes('tokenHash'), false)
    assert.equal(response.issued.length, 0)
    assert.ok(state.operations.indexOf('lock:update') < state.operations.indexOf('insert:shares'))
    assert.ok(Math.abs(new Date(data.share.expiresAt).getTime() - Date.now() - 7 * 86400000) < 5000)
    assert.match(response.headers.get('cache-control'), /private, no-store/)
  })
  await t.test('bad id, lifetime, language, note and oversized payload cannot write', async () => {
    const state = database(); const route = adminRoute(state.db)
    for (const body of [{ blogId: '3' }, { blogId: -1 }, { blogId: 3, expiresInHours: 0 },
      { blogId: 3, expiresInHours: 100000 }, { blogId: 3, language: '../../evil' },
      { blogId: 3, note: 'x'.repeat(81) }, { blogId: 3, note: 'x'.repeat(5000) }]) {
      assert.equal((await route.POST(request(body))).status, 400)
    }
    assert.equal(state.store.shares.length, 0)
  })
  await t.test('unpublished, unprotected and absent articles cannot receive a share', async () => {
    for (const kind of ['unpublished', 'unprotected', 'absent']) {
      const state = database()
      if (kind === 'unpublished') state.store.blogs[0].isPublished = false
      if (kind === 'unprotected') state.store.access = []
      if (kind === 'absent') state.store.blogs = []
      const r = await adminRoute(state.db).POST(request({ blogId: 3 }))
      assert.equal(r.status, kind === 'absent' ? 404 : 400); assert.equal(state.store.shares.length, 0)
    }
  })
  await t.test('active-link cap prevents unbounded duplicate creation; expired/revoked do not count', async () => {
    const state = database(Array.from({ length: 50 }, () => fixture()))
    const route = adminRoute(state.db)
    assert.equal((await route.POST(request({ blogId: 3 }))).status, 409)
    state.store.shares[0].revokedAt = new Date()
    assert.equal((await route.POST(request({ blogId: 3 }))).status, 201)
  })
  await t.test('listing exposes only metadata, not reusable credentials or code material', async () => {
    const item = fixture(); const state = database([item])
    const response = await adminRoute(state.db).GET(new Request(`${env.SITE_URL}/api/admin/blog-shares?blogId=3`))
    const text = await response.text()
    assert.equal(response.status, 200)
    for (const value of [item.token, item.tokenHash, item.accessVersion, codeHash]) assert.equal(text.includes(value), false)
    assert.match(text, /for reviewer/)
  })
  await t.test('revocation is article-bound and idempotent', async () => {
    const item = fixture(); const state = database([item]); const route = adminRoute(state.db)
    assert.equal((await route.DELETE(request({ blogId: 4, id: item.id }, 'DELETE'))).status, 404)
    assert.equal(state.store.shares[0].revokedAt, null)
    for (let i = 0; i < 2; i++) assert.equal((await route.DELETE(request({ blogId: 3, id: item.id }, 'DELETE'))).status, 200)
    assert.ok(state.store.shares[0].revokedAt instanceof Date)
  })
})

test('public redemption verifies a registered token and never returns article content', async t => {
  function setup(options = {}) {
    const item = fixture(); const state = database([item])
    Object.assign(state.store.shares[0], options.patch ?? {})
    if (options.published === false) state.store.blogs[0].isPublished = false
    const service = shareService(state.db); let reads = 0
    const route = load('app/api/(public)/blog/[slug]/share/route.ts', {
      'drizzle-orm': orm, '@/db/instance': { db: state.db }, '@/db/schema': tables,
      '@/lib/core/blog-access/http': http(), '@/lib/core/blog-access/share-crypto': crypto,
      '@/lib/core/blog-access/share-service': service,
      '@/lib/core/blog-access/service': { readArticleAccess: async () => options.unprotected ? null : ({
        codeHash: options.rotate && reads++ > 0 ? 'rotated' : codeHash,
      }) },
    })
    const redeem = (token = item.token, origin = env.SITE_URL) => route.POST(request({ token }, 'POST', origin), { params: Promise.resolve({ slug: 'sample' }) })
    return { ...state, item, service, route, redeem }
  }
  await t.test('valid token signs a separate HttpOnly cookie, capped by share expiry', async () => {
    const state = setup({ patch: { expiresAt: new Date(Date.now() + 60000) } })
    const response = await state.redeem()
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { unlocked: true })
    const [name, token, flags] = response.issued[0]
    assert.equal(name, 'ailoxi-share-3'); assert.equal(flags.httpOnly, true); assert.equal(flags.secure, true)
    assert.equal(flags.sameSite, 'lax'); assert.equal(flags.path, '/'); assert.ok(flags.maxAge <= 60)
    assert.equal(await state.service.canReadSharedArticle(token, 3, codeHash), true)
    assert.match(response.headers.get('cache-control'), /no-store/)
  })
  await t.test('wrong, unregistered, malformed and other-article tokens grant nothing', async () => {
    const state = setup()
    const wrong = state.item.token.slice(0, -1) + (state.item.token.endsWith('a') ? 'b' : 'a')
    for (const value of [wrong, fixture().token, state.item.id, '', null, 'x'.repeat(5000)]) {
      const response = await state.redeem(value); assert.equal(response.status, 403); assert.equal(response.issued.length, 0)
    }
    state.store.shares[0].blogId = 4
    assert.equal((await state.redeem()).status, 403)
  })
  await t.test('expired/revoked/rotated/unpublished/disabled links fail closed', async () => {
    for (const options of [{ patch: { expiresAt: new Date(0) } }, { patch: { revokedAt: new Date() } },
      { patch: { accessVersion: 'other-code-version' } }, { published: false }, { unprotected: true }, { rotate: true }]) {
      const response = await setup(options).redeem()
      assert.equal(response.status, 403); assert.equal(response.issued.length, 0)
    }
  })
  await t.test('cross-origin redemption cannot set cookies', async () => {
    const state = setup()
    const response = await state.redeem(state.item.token, 'https://evil.example')
    assert.equal(response.status, 403); assert.equal(response.issued.length, 0)
  })
  await t.test('a previously redeemed share is checked again after revocation', async () => {
    const state = setup()
    const response = await state.redeem(); const [, token] = response.issued[0]
    assert.equal(await state.service.canReadSharedArticle(token, 3, codeHash), true)
    await adminRoute(state.db).DELETE(request({ blogId: 3, id: state.item.id }, 'DELETE'))
    assert.equal(await state.service.canReadSharedArticle(token, 3, codeHash), false)
    assert.equal((await state.redeem()).status, 403)
  })
  await t.test('other-article, rotated-code, expired and deleted session records fail', async () => {
    const state = setup(); const response = await state.redeem(); const [, token] = response.issued[0]
    assert.equal(await state.service.canReadSharedArticle(token, 4, codeHash), false)
    assert.equal(await state.service.canReadSharedArticle(token, 3, codeHash + 'rotated'), false)
    state.store.shares[0].expiresAt = new Date(0)
    assert.equal(await state.service.canReadSharedArticle(token, 3, codeHash), false)
    state.store.shares = []
    assert.equal(await state.service.canReadSharedArticle(token, 3, codeHash), false)
  })
  await t.test('database exceptions never turn into successful grants', async () => {
    const state = setup()
    state.db.select = () => { throw Error('DB unavailable') }
    assert.equal((await state.redeem()).status, 503)
  })
})

test('common article/comment gate accepts valid shares without adding admin privileges', async () => {
  const item = fixture(); const state = database([item]); const shares = shareService(state.db)
  let cookie = crypto.signShareGrant(item, codeHash, secret).token
  let admin = false
  const service = load('lib/core/blog-access/service.ts', {
    'drizzle-orm': orm, '@/db/instance': { db: state.db }, '@/db/schema/blog-access': { ...tables, blogUnlockBudget: {} },
    'next/headers': { cookies: async () => ({ get: name => name === 'ailoxi-share-3' && cookie ? { value: cookie } : undefined }) },
    '@/lib/core/auth/guard': { noPermission: async () => !admin }, './crypto': codeCrypto, './share-service': shares,
  })
  assert.equal(await service.canReadArticle(3), true)
  state.store.shares[0].revokedAt = new Date()
  assert.equal(await service.canReadArticle(3), false)
  admin = true
  assert.equal(await service.canReadArticle(3), false, 'admin exemption remains opt-in')
  state.store.access[0].adminBypass = true
  assert.equal(await service.canReadArticle(3), true)
  state.store.access[0].adminBypass = false
  const comments = http(service.canReadArticle).withArticleCommentAccess(async () => MockResponse.json({ body: 'comment' }))
  const req = new Request(`${env.SITE_URL}/api/comment?targetType=BLOG&targetId=3`)
  req.nextUrl = new URL(req.url)
  assert.equal((await comments(req)).status, 403)
  cookie = undefined
  assert.equal(await service.canReadArticle(3), false)
})

test('URL parser and legacy code links', async t => {
  const item = fixture()
  await t.test('all six languages use fragments, not HTTP query secrets', () => {
    for (const language of ['zh', 'en', 'zh-tw', 'ja', 'ru', 'de']) {
      const url = links.buildArticleShareLink(env.SITE_URL, 'some article', item.token, language)
      const parsed = links.readArticleAccessLink(url)
      assert.equal(new URL(url).search, '')
      assert.equal(parsed.kind, 'share'); assert.equal(parsed.value, item.token)
      assert.equal(parsed.cleanUrl, `/${language}/blog/some%20article`)
    }
  })
  await t.test('duplicate or mixed credentials are removed and never selected', () => {
    for (const extra of [`#share=${item.token}&share=${item.token}`, `?share=${item.token}#share=${item.token}`,
      `?code=phrase#share=${item.token}`, `#code=phrase&share=${item.token}`]) {
      const parsed = links.readArticleAccessLink(`${env.SITE_URL}/zh/blog/sample${extra}`)
      assert.equal(parsed.value, null); assert.equal(parsed.cleanUrl, '/zh/blog/sample')
    }
  })
  await t.test('query compatibility strips credentials but preserves ordinary anchors and unrelated parameters', () => {
    const parsed = links.readArticleAccessLink(`${env.SITE_URL}/zh/blog/sample?view=1&share=${item.token}#chapter-two`)
    assert.equal(parsed.value, item.token); assert.equal(parsed.cleanUrl, '/zh/blog/sample?view=1#chapter-two')
    assert.equal(links.readArticleAccessLink(`${env.SITE_URL}/zh/blog/sample#chapter-two`), null)
  })
  await t.test('legacy phrase links still route through code verification', () => {
    const url = links.buildArticleCodeLink(env.SITE_URL, 'sample', '中 + & # code')
    const parsed = links.readArticleAccessLink(url)
    assert.equal(parsed.kind, 'code'); assert.equal(parsed.value, '中 + & # code')
    assert.equal(links.readArticleCodeLink(url).code, parsed.value)
  })
})

test('client auto-redeems shares only after removing the token from the URL', async t => {
  async function clientCase(status, supplied) {
    const effects = []; const calls = []; const old = { window: global.window, fetch: global.fetch }
    const tree = (type, props) => ({ type, props })
    const react = { useRef: value => ({ current: value }), useCallback: fn => fn,
      useEffect: fn => effects.push(fn), useState: value => [value, next => calls.push(['state', next])] }
    global.window = { location: { href: supplied, pathname: '/zh/blog/sample' },
      history: { state: { next: true }, replaceState: (state, unused, url) => { calls.push(['scrub', url, state]); global.window.location.href = env.SITE_URL + url } },
      addEventListener() {}, removeEventListener() {} }
    global.fetch = async (url, options) => { calls.push(['fetch', url, JSON.parse(options.body)]); return { ok: status === 200, status } }
    try {
      const gate = load('ui/(main)/blog/article-code-gate.tsx', {
        react, 'react/jsx-runtime': { jsx: tree, jsxs: tree },
        'next/navigation': { useRouter: () => ({ refresh: () => calls.push(['refresh']) }), useSearchParams: () => ({}) },
        '@/lib/core/blog-access/share-link': links,
      })
      gate.ArticleCodeGate({ slug: 'sample', title: '公开标题', language: 'zh' })
      for (const effect of effects) effect()
      await new Promise(resolve => setImmediate(resolve))
      return calls
    } finally { global.window = old.window; global.fetch = old.fetch }
  }
  await t.test('valid share uses only public redemption endpoint and refreshes after success', async () => {
    const item = fixture()
    const calls = await clientCase(200, links.buildArticleShareLink(env.SITE_URL, 'sample', item.token))
    const scrub = calls.findIndex(call => call[0] === 'scrub'); const request = calls.findIndex(call => call[0] === 'fetch')
    assert.ok(scrub >= 0 && scrub < request)
    assert.equal(calls[request][1], '/api/blog/sample/share')
    assert.deepEqual(calls[request][2], { token: item.token })
    assert.ok(calls.some(call => call[0] === 'refresh'))
  })
  await t.test('server rejection or an ambiguous link never refreshes into protected content', async () => {
    const token = fixture().token
    const calls = await clientCase(403, links.buildArticleShareLink(env.SITE_URL, 'sample', token))
    assert.ok(!calls.some(call => call[0] === 'refresh'))
    const mixed = await clientCase(200, `${env.SITE_URL}/zh/blog/sample#share=${token}&code=wrong`)
    assert.ok(!mixed.some(call => call[0] === 'fetch'))
    assert.ok(!mixed.some(call => call[0] === 'refresh'))
  })
})

test('share table is separate and protection removal cascades; UI actions cannot submit the article form', () => {
  const schema = fs.readFileSync(path.join(root, 'db/schema/blog-share.ts'), 'utf8')
  assert.match(schema, /references\(\(\) => blogAccess.blogId, \{ onDelete: 'cascade' \}\)/)
  assert.match(schema, /tokenHash/); assert.doesNotMatch(schema, /token: text/)
  const ui = fs.readFileSync(path.join(root, 'ui/admin/blog/edit/[[...slug]]/article-share-controls.tsx'), 'utf8')
  assert.doesNotMatch(ui, /localStorage|sessionStorage/)
  assert.doesNotMatch(ui, /<form/)
  assert.equal((ui.match(/<Button\b/g) ?? []).length, (ui.match(/<Button type="button"/g) ?? []).length)
})
