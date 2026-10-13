/* Run: node --test tests/admin-access.test.cjs (requires project TypeScript).
 * Run the actual policy and admin matcher with isolated server environment and
 * wallet-address adapters. No OAuth requests or real application sessions here.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

function load(file, mocks = {}) {
  const filename = path.join(root, file)
  const result = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  })
  assert.equal((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
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

const sitePolicy = load('config/auth/site-admins.ts')
const siteUrl = 'https://www.mikuflare.com'
const addedEmail = '3612996124@qq.com'
const wallet = '0x1234567890123456789012345678901234567890'
const anotherWallet = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const walletUser = { name: wallet, email: `${wallet}@wallet.invalid` }
// Address validation itself is viem's responsibility; use valid deterministic fixtures.
const viem = { isAddress: value => typeof value === 'string' && /^0x[\da-f]{40}$/i.test(value) }
function admin(overrides = {}) {
  const serverEnv = {
    SITE_URL: siteUrl,
    ADMIN_EMAILS: ['original@example.com'],
    ADMIN_WALLET_ADDRESS: undefined,
    ...overrides,
  }
  const matcher = load('lib/core/auth/admin.ts', {
    viem,
    '@/config/auth/site-admins': sitePolicy,
    '@/config/env/server-env': { serverEnv },
  })
  return { ...matcher, serverEnv }
}

test('both explicitly configured production origins grant the full QQ email', () => {
  for (const origin of [siteUrl, 'https://mikuflare.com']) {
    assert.equal(sitePolicy.isSiteAdminEmail(origin, addedEmail), true)
    assert.equal(admin({ SITE_URL: origin }).isAdminUser({ email: addedEmail }), true)
  }
})

test('matching is case insensitive without broadening the address', () => {
  assert.equal(admin().isAdminUser({ email: '3612996124@QQ.COM' }), true)
})

test('other domains, partial emails and lookalikes are not administrators', () => {
  for (const email of [
    '3612996124@', '3612996124@gmail.com', '3612996124@evil.example',
    '3612996124@qq.com.evil.example', 'x3612996124@qq.com',
    '3612996124+tag@qq.com', '3612996124@qQ.co', 'other@qq.com',
    '3612996124@qq.com@evil.example', '3612996124@qq.com\n',
    ' 3612996124@qq.com', '3612996124@qq.com ', '',
  ]) assert.equal(admin().isAdminUser({ email }), false, email)
})

test('missing users and missing emails fail closed', () => {
  for (const user of [undefined, null, {}, { email: null }, { email: undefined }]) {
    assert.equal(admin().isAdminUser(user), false)
  }
})

test('an email in the display name never grants administrator status', () => {
  assert.equal(admin().isAdminUser({ name: addedEmail, email: 'reader@example.com' }), false)
  assert.equal(admin().isAdminUser({ name: addedEmail }), false)
})

test('client-like role fields do not override the real email matcher', () => {
  assert.equal(admin().isAdminUser({ email: 'reader@example.com', isAdmin: true, role: 'admin' }), false)
})

test('existing environment administrators remain authorized', () => {
  const matcher = admin({ ADMIN_EMAILS: ['original@example.com', 'another@example.com'] })
  assert.equal(matcher.isAdminUser({ email: 'ORIGINAL@EXAMPLE.COM' }), true)
  assert.equal(matcher.isAdminUser({ email: 'another@example.com' }), true)
  assert.equal(matcher.isAdminUser({ email: addedEmail }), true)
})

test('the additional policy does not mutate or replace the environment allowlist', () => {
  const ADMIN_EMAILS = Object.freeze(['original@example.com'])
  assert.equal(admin({ ADMIN_EMAILS }).isAdminUser({ email: addedEmail }), true)
  assert.deepEqual(ADMIN_EMAILS, ['original@example.com'])
})

test('listing the added email in the environment too remains safe', () => {
  const matcher = admin({ ADMIN_EMAILS: ['original@example.com', addedEmail] })
  assert.equal(matcher.isAdminUser({ email: addedEmail }), true)
  assert.equal(matcher.isAdminUser({ email: 'reader@qq.com' }), false)
})

test('site additions never apply automatically to another deployment', () => {
  for (const origin of [
    'https://another-blog.example', 'https://preview.mikuflare.com',
    'https://www.mikuflare.com.evil.example', 'https://evil.example/mikuflare.com',
    'https://www.mikuflare.com@evil.example', 'https://www.mikuflare.com:444',
    'http://www.mikuflare.com', 'http://mikuflare.com', 'http://localhost:3000',
    '__proto__', 'constructor', '',
  ]) {
    const matcher = admin({ SITE_URL: origin })
    assert.equal(matcher.isAdminUser({ email: addedEmail }), false, origin)
    assert.equal(matcher.isAdminUser({ email: 'original@example.com' }), true, origin)
  }
})

test('another deployment can explicitly configure its own environment admins', () => {
  assert.equal(admin({ SITE_URL: 'https://another-blog.example', ADMIN_EMAILS: [addedEmail] })
    .isAdminUser({ email: addedEmail }), true)
})

test('request-like origin or Host fields on a user cannot enable site additions', () => {
  const matcher = admin({ SITE_URL: 'https://another-blog.example' })
  assert.equal(matcher.isAdminUser({ email: addedEmail, host: 'www.mikuflare.com', SITE_URL: siteUrl }), false)
})

test('configured wallet administrator is still recognized', () => {
  const matcher = admin({ ADMIN_WALLET_ADDRESS: wallet })
  assert.equal(matcher.isWalletSessionUser(walletUser), true)
  assert.equal(matcher.isAdminUser(walletUser), true)
})

test('other wallet users do not acquire administrator status', () => {
  const matcher = admin({ ADMIN_WALLET_ADDRESS: wallet })
  assert.equal(matcher.isAdminUser({ name: anotherWallet, email: `${anotherWallet}@wallet.invalid` }), false)
})

test('wallet matching keeps the original case-insensitive address comparison', () => {
  const matcher = admin({ ADMIN_WALLET_ADDRESS: anotherWallet })
  assert.equal(matcher.isAdminUser({ name: `0x${anotherWallet.slice(2).toUpperCase()}`, email: `${anotherWallet}@wallet.invalid` }), true)
})

test('adding a site email does not grant otherwise unconfigured wallet accounts', () => {
  assert.equal(admin().isAdminUser(walletUser), false)
  assert.equal(admin().isWalletSessionUser({ name: 'not a wallet', email: addedEmail }), false)
})

test('email administrators still work alongside a configured wallet administrator', () => {
  const matcher = admin({ ADMIN_WALLET_ADDRESS: wallet })
  assert.equal(matcher.isAdminUser({ email: addedEmail }), true)
  assert.equal(matcher.isAdminUser({ email: 'original@example.com' }), true)
})

test('both modules keep their server-only boundary', () => {
  for (const file of ['config/auth/site-admins.ts', 'lib/core/auth/admin.ts']) {
    assert.match(readFileSync(path.join(root, file), 'utf8'), /^import 'server-only'/)
  }
})
