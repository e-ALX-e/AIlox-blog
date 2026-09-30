/* Run: node --test tests/access-manager.test.cjs
 * Real TS/TSX modules with isolated Next/React/DB adapters. Not an end-to-end test.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) }
function load(file, mocks = {}) {
  const filename = path.join(root, file)
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename, reportDiagnostics: true,
  })
  assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  const instance = new Module(filename, module)
  instance.filename = filename
  instance.paths = Module._nodeModulePaths(path.dirname(filename))
  instance.require = name => {
    if (name === 'server-only') return {}
    if (name === 'react/jsx-runtime') return jsx
    if (name === 'next/link') return { default: 'a' }
    if (Object.hasOwn(mocks, name)) return mocks[name]
    return require(name)
  }
  instance._compile(compiled.outputText, filename)
  return instance.exports
}
const urls = load('lib/core/blog-access/admin-navigation.ts')
const table = { id: 'id', title: 'title', slug: 'slug', isPublished: 'published', content: 'SECRET_BODY', updatedAt: 'updated' }
const access = { blogId: 'accessId', adminBypass: 'adminBypass', codeHash: 'SECRET_HASH' }
const ops = Object.fromEntries(['and','count','desc','eq','ilike','isNotNull','isNull','or'].map(name => [name, (...args) => ({ [name]: args })]))
const nav = { redirect: url => { throw Error(`REDIRECT:${url}`) }, notFound: () => { throw Error('NOT_FOUND') } }
const article = { id: 3, title: '公开标题', slug: 'example/article', isPublished: false, protectedId: 3, adminBypass: false }
function nodes(tree) {
  if (tree == null || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
const text = tree => JSON.stringify(tree)

test('URL helpers validate ids without accepting coercions', () => {
  for (const value of ['0','-1','1.5','1e3','03','../3','2147483648',['3'],null,3]) assert.equal(urls.parseArticleId(value), null)
  assert.equal(urls.parseArticleId('2147483647'), 2147483647)
  assert.equal(urls.articleAccessPath(3), '/admin/blog-access/3')
  assert.throws(() => urls.articleAccessPath(-1))
})
test('search, status and page inputs have bounded defaults', () => {
  assert.deepEqual(urls.parseAccessListQuery({ q: ['unsafe'], filter: 'other', page: '1e8' }), { q: '', filter: 'all', page: 1 })
  assert.equal(urls.parseAccessListQuery({ q: 'x'.repeat(300) }).q.length, 100)
  assert.deepEqual(urls.parseAccessListQuery({ q: '  简历  ', filter: 'protected', page: '4' }), { q: '简历', filter: 'protected', page: 4 })
})
test('pagination preserves encoded filters but never credentials', () => {
  const q = urls.parseAccessListQuery({ q: 'a&b#c', filter: 'draft', code: 'SECRET', share: 'TOKEN' })
  const url = new URL(urls.accessListHref(q, 2), 'https://example.com')
  assert.equal(url.searchParams.get('q'), 'a&b#c')
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(url.searchParams.has('code'), false)
  assert.equal(urls.accessListHref({ q: '', filter: 'all' }, 1), '/admin/blog-access')
})
test('LIKE wildcard input is escaped literally', () => {
  assert.equal(urls.accessSearchPattern('a%b_c\\d'), '%a\\%b\\_c\\\\d%')
})
function listFixture({ denied = false, total = 41, rows = [article], fail = false } = {}) {
  const selections = [], calls = []
  const db = { select(fields) {
    selections.push(fields)
    if (fail) throw Error('DB unavailable')
    const index = selections.length
    const query = { then(resolve, reject) { return Promise.resolve(index === 1 ? [{ total }] : rows).then(resolve, reject) } }
    for (const op of ['from','leftJoin','where','orderBy','limit','offset']) query[op] = (...args) => { calls.push([op,...args]); return query }
    return query
  } }
  const list = load('lib/core/blog-access/admin-list.ts', {
    'drizzle-orm': ops, 'next/navigation': nav, '@/db/instance': { db }, '@/db/schema': { blogs: table },
    '@/db/schema/blog-access': { blogAccess: access }, '@/lib/core/auth/guard': { noPermission: async () => denied },
    './admin-navigation': urls,
  })
  return { ...list, selections, calls }
}
test('list denies non-admins before accessing the database', async () => {
  const fixture = listFixture({ denied: true })
  await assert.rejects(fixture.getAdminAccessList({ q: '', filter: 'all', page: 1 }), /REDIRECT/)
  assert.equal(fixture.selections.length, 0)
})
test('list projections never fetch bodies, hashes or share tokens', async () => {
  const fixture = listFixture()
  await fixture.getAdminAccessList({ q: '', filter: 'all', page: 1 })
  assert.deepEqual(Object.keys(fixture.selections[1]).sort(), ['adminBypass','id','isPublished','protectedId','slug','title'])
  assert.doesNotMatch(JSON.stringify(fixture.selections), /SECRET|token/i)
})
test('out-of-range pagination clamps to the last real page', async () => {
  const fixture = listFixture()
  const result = await fixture.getAdminAccessList({ q: '', filter: 'all', page: 99999 })
  assert.equal(result.page, 3)
  assert.equal(result.pages, 3)
  assert.ok(fixture.calls.some(([op,arg]) => op === 'offset' && arg === 40))
  assert.ok(fixture.calls.some(([op,arg]) => op === 'limit' && arg === 20))
})
test('empty results still have a valid first page', async () => {
  const result = await listFixture({ total: 0, rows: [] }).getAdminAccessList({ q: '', filter: 'all', page: 9 })
  assert.equal(result.page, 1); assert.equal(result.pages, 1); assert.equal(result.articles.length, 0)
})
test('database failure is not converted to an empty list or public access', async () => {
  await assert.rejects(listFixture({ fail: true }).getAdminAccessList({ q: '', filter: 'all', page: 1 }), /DB unavailable/)
})
test('filters are sent to the query, including literal title/slug search', async () => {
  const fixture = listFixture()
  await fixture.getAdminAccessList({ q: 'x%', filter: 'public', page: 1 })
  const condition = fixture.calls.find(([op]) => op === 'where')[1]
  assert.match(JSON.stringify(condition), /ilike/)
  assert.match(JSON.stringify(condition), /isNull/)
  assert.match(JSON.stringify(condition), /published/)
})
test('list renders independent manage/edit links and a metadata-only empty state', async () => {
  const make = rows => load('app/admin/blog-access/page.tsx', {
    '@/lib/core/blog-access/admin-navigation': urls,
    '@/lib/core/blog-access/admin-list': { getAdminAccessList: async () => ({ articles: rows, total: rows.length, page: 1, pages: 1 }) },
  })
  const tree = await make([article]).default({ searchParams: Promise.resolve({}) })
  assert.ok(nodes(tree).some(n => n.props?.href === '/admin/blog-access/3'))
  assert.ok(nodes(tree).some(n => n.props?.href === '/admin/blog/edit/example%2Farticle'))
  const empty = await make([]).default({ searchParams: Promise.resolve({}) })
  assert.match(text(empty), /没有找到文章/)
  assert.doesNotMatch(text(tree), /SECRET/)
})
test('detail page authenticates, validates IDs and serializes only the article ID to controls', async () => {
  let queries = 0
  const selections = []
  const loadPage = denied => load('app/admin/blog-access/[id]/page.tsx', {
    'drizzle-orm': ops, 'next/navigation': nav, '@/db/schema': { blogs: table },
    '@/lib/core/auth/guard': { noPermission: async () => denied }, '@/lib/core/blog-access/admin-navigation': urls,
    '@/ui/admin/blog-access/article-access-manager': { ArticleAccessManager: 'Manager' },
    '@/db/instance': { db: { select(fields) { queries++; selections.push(fields); return { from(){return this},where(){return this},limit:async()=>[article] } } } },
  })
  await assert.rejects(loadPage(true).default({ params: Promise.resolve({ id: '3' }) }), /REDIRECT/)
  assert.equal(queries, 0)
  await assert.rejects(loadPage(false).default({ params: Promise.resolve({ id: '1e3' }) }), /NOT_FOUND/)
  assert.equal(queries, 0)
  const result = await loadPage(false).default({ params: Promise.resolve({ id: '3' }) })
  assert.deepEqual(nodes(result).find(n => n.type === 'Manager').props, { articleId: 3 })
  assert.deepEqual(Object.keys(selections[0]).sort(), ['id','isPublished','slug','title'])
  assert.match(text(result), /尚未发布/)
})
test('editor mounts only the content form and an external manager shortcut', () => {
  const props = { article, relatedArticleTagNames: ['技术'] }
  const editor = load('ui/admin/blog/edit/[[...slug]]/blog-edit-form.tsx', {
    '@/lib/core/blog-access/admin-navigation': urls, './blog-edit-form-fields': { BlogEditForm: 'ContentForm' },
  })
  const tree = editor.BlogEditForm(props)
  const link = nodes(tree).find(n => n.props?.href === '/admin/blog-access/3')
  assert.equal(link.props.target, '_blank')
  assert.deepEqual(nodes(tree).find(n => n.type === 'ContentForm').props, props)
  assert.doesNotMatch(text(tree), /ArticleAccessControls|ArticleShareControls/)
  assert.match(text(editor.BlogEditForm({ article: null })), /先保存为草稿/)
})
test('admin nav activates only the correct management section', () => {
  const { adminRoutes } = load('ui/admin/layout/header/constant.ts')
  for (const url of ['/admin/blog-access','/admin/blog-access/3']) {
    assert.deepEqual(adminRoutes.filter(r => r.pattern.test(url)).map(r => r.pathName), ['暗号与分享'])
  }
  assert.deepEqual(adminRoutes.filter(r => r.pattern.test('/admin/blog/edit/a')).map(r => r.pathName), ['博客'])
})
const baseMessages = Object.fromEntries(['zh','zh-tw','en','ja','ru','de'].map(language => [language, {
  header: { routes: { blog: `${language}-original`, friends: 'friends', login: 'login' } },
  home: { greeting: `${language}-greeting` },
}]))
const localized = load('lib/i18n/site-messages.ts', { './messages': { messages: baseMessages } })
test('Chinese section rebranding is limited to the navigation labels', () => {
  assert.equal(localized.messages.zh.header.routes.blog, '闲书')
  assert.equal(localized.messages['zh-tw'].header.routes.blog, '閒書')
  assert.equal(baseMessages.zh.header.routes.blog, 'zh-original')
  for (const language of ['en','ja','ru','de']) assert.equal(localized.messages[language], baseMessages[language])
  assert.equal(localized.messages.zh.home, baseMessages.zh.home)
})
test('SEO uses the same Chinese labels without renaming URLs or article titles', () => {
  const { seoMetadata: seo } = load('config/seo/index.ts', { '@/lib/i18n/site-messages': localized })
  assert.equal(seo.zh.blog.title, '闲书'); assert.equal(seo['zh-tw'].blog.title, '閒書')
  assert.equal(seo.zh.blog.alternates.canonical, '/zh/blog')
  assert.equal(seo['zh-tw'].blog.alternates.canonical, '/zh-tw/blog')
  assert.equal(seo.en.blog.title, 'Blog')
  assert.match(seo.zh.articleDescription('原文章标题'), /原文章标题/)
})

function hooks() {
  const slots = [], effectDeps = [], cleanups = []
  let cursor = 0, effects = []
  return {
    react: {
      useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
      useRef(value) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }) },
      useEffect(fn, deps) { const i = cursor++; if (!effectDeps[i] || deps.some((d,j) => !Object.is(d,effectDeps[i][j]))) { effectDeps[i]=deps; effects.push(() => { cleanups[i]?.(); cleanups[i] = fn() }) } },
    },
    render(fn, props) { cursor=0; effects=[]; const result=fn(props); for(const effect of effects) effect(); return result },
    dispose() { cleanups.forEach(fn=>fn?.()) },
  }
}
test('switching sections keeps drafts and the share component instance', async () => {
  const oldFetch = global.fetch, oldWindow = global.window
  const requests = [], listeners = new Set()
  global.window = { addEventListener: name => listeners.add(name), removeEventListener: name => listeners.delete(name) }
  global.fetch = async (url, options) => { requests.push([url,options]); return { ok: true, json: async()=>({ enabled: true, adminBypass: false }) } }
  const h = hooks()
  try {
    const { ArticleAccessControls: Controls } = load('ui/admin/blog/edit/[[...slug]]/article-access-controls.tsx', {
      react: h.react, '@/ui/shadcn/button': { Button:'Button' }, '@/ui/shadcn/input': { Input:'Input' },
      '@/ui/shadcn/switch': { Switch:'Switch' }, './article-share-controls': { ArticleShareControls:'Shares' },
    })
    const props = { articleId:3, section:'protection' }
    h.render(Controls, props)
    await new Promise(resolve=>setImmediate(resolve))
    let tree=h.render(Controls, props)
    const share=nodes(tree).find(n=>n.type==='Shares')
    assert.ok(share)
    nodes(tree).find(n=>n.props?.id==='article-access-code').props.onChange({ target:{ value:'unsaved-phrase' } })
    tree=h.render(Controls, { ...props, section:'sharing' })
    assert.equal(nodes(tree).find(n=>n.type==='Shares').key, share.key)
    assert.equal(nodes(tree).find(n=>n.type==='Shares').props.disabled, true)
    assert.equal(nodes(tree).find(n=>n.props?.['aria-label']==='文章暗号').props.hidden, true)
    tree=h.render(Controls, props)
    assert.equal(nodes(tree).find(n=>n.props?.id==='article-access-code').props.value, 'unsaved-phrase')
    assert.equal(listeners.has('beforeunload'), true)
    assert.equal(requests.length, 1)
  } finally { h.dispose(); global.fetch=oldFetch; global.window=oldWindow }
})
test('loaded false disables mutations and sharing after a settings read failure', async () => {
  const oldFetch=global.fetch
  global.fetch=async()=>({ ok:false, json:async()=>({ message:'数据库暂不可用' }) })
  const h=hooks()
  try {
    const { ArticleAccessControls:Controls }=load('ui/admin/blog/edit/[[...slug]]/article-access-controls.tsx', {
      react:h.react,'@/ui/shadcn/button':{Button:'Button'},'@/ui/shadcn/input':{Input:'Input'},
      '@/ui/shadcn/switch':{Switch:'Switch'},'./article-share-controls':{ArticleShareControls:'Shares'},
    })
    h.render(Controls,{articleId:3,section:'sharing'})
    await new Promise(resolve=>setImmediate(resolve))
    const tree=h.render(Controls,{articleId:3,section:'sharing'})
    assert.equal(nodes(tree).filter(n=>n.type==='Shares').length,0)
    assert.ok(nodes(tree).some(n=>n.props?.id==='article-access-enabled' && n.props.disabled))
    assert.match(text(tree),/重新读取设置/)
  } finally { h.dispose(); global.fetch=oldFetch }
})
