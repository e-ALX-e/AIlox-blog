// Run with: node --test tests/markdown-image-layout.test.cjs
// Use the project's TypeScript dev dependency without adding a test runner.
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

const modules = new Map()
function loadTypeScript(filename) {
  filename = path.resolve(__dirname, '..', filename)
  if (modules.has(filename)) return modules.get(filename).exports
  const module = { exports: {} }
  modules.set(filename, module)
  const source = readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: filename,
  })
  const requireFromFile = createRequire(filename)
  const localRequire = id => {
    // The server-only import is a bundler guard, not part of the transformer.
    if (id === 'server-only') return {}
    if (id.startsWith('.')) return loadTypeScript(path.resolve(path.dirname(filename), `${id}.ts`))
    return requireFromFile(id)
  }
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports)
  return module.exports
}

const { parseMarkdownImageSize: parse } = loadTypeScript('lib/core/markdown/image-size.ts')
const { decorateImageFrames } = loadTypeScript('lib/core/markdown/image-frame.ts')
const { rehypeImageFramePreviewRenderer } = loadTypeScript('lib/core/markdown/rehype-image-frame-preview-renderer.ts')
const element = (tagName, children = [], properties = {}) => ({ type: 'element', tagName, properties, children })
const text = value => ({ type: 'text', value })
const image = (alt, src = '/media/photo.png') => element('img', [], { alt, src })
const root = (...children) => ({ type: 'root', children })

for (const [name, alt, expected] of [
  ['plain image', 'Photo', { alt: 'Photo' }],
  ['missing alt', undefined, { alt: '' }],
  ['legacy percentage', 'Photo|60%', { alt: 'Photo', width: '60%' }],
  ['legacy pixels', 'Photo|600px', { alt: 'Photo', width: '600px' }],
  ['right portrait', 'Photo|120px|float=right', { alt: 'Photo', width: '120px', float: 'right' }],
  ['left portrait reordered', 'Photo|float=left|width=140px', { alt: 'Photo', width: '140px', float: 'left' }],
  ['explicit frame', 'Photo|30%|float=right|frame=default', { alt: 'Photo', width: '30%', float: 'right', frame: 'default' }],
  ['frameless centered', 'Photo|200px|frame=none', { alt: 'Photo', width: '200px', frame: 'none' }],
  ['empty alt with options', '|float=right', { alt: '', float: 'right' }],
  ['pipes in caption', 'A | B|120px|float=right', { alt: 'A | B', width: '120px', float: 'right' }],
  ['case and spaces', 'Photo | 120PX | FLOAT=RIGHT ', { alt: 'Photo', width: '120px', float: 'right' }],
  ['rightmost option wins', 'Photo|float=left|float=right', { alt: 'Photo', float: 'right' }],
  ['invalid size stays caption', 'Photo|9000px', { alt: 'Photo|9000px' }],
  ['percent range rejected', 'Photo|101%', { alt: 'Photo|101%' }],
  ['CSS injection rejected', 'Photo|width=120px;background:url(x)', { alt: 'Photo|width=120px;background:url(x)' }],
  ['invalid float rejected', 'Photo|float=right;position:fixed', { alt: 'Photo|float=right;position:fixed' }],
  ['explicit no wrap', 'Photo|120px|float=none', { alt: 'Photo', width: '120px', float: 'none' }],
]) {
  test(name, () => assert.deepEqual(parse(alt), expected))
}

test('ordinary image keeps its paragraph, centered frame, and empty style', () => {
  const tree = root(element('p', [image('Photo')]))
  decorateImageFrames(tree)
  const paragraph = tree.children[0]
  assert.equal(paragraph.tagName, 'p')
  assert.deepEqual(paragraph.children[0].properties, { className: ['md-image-frame'] })
})

test('standalone float is lifted out of p without swallowing following content', () => {
  const paragraph = element('p', [text('Contact details and biography.')])
  const tree = root(element('p', [image('Photo|120px|float=right')]), paragraph)
  decorateImageFrames(tree)
  assert.equal(tree.children[0].tagName, 'span')
  assert.deepEqual(tree.children[0].properties, {
    className: ['md-image-frame', 'md-image-float', 'md-image-float-right', 'md-image-frameless'],
    style: '--md-image-width: 120px;',
  })
  assert.equal(tree.children[0].children[0].properties.alt, 'Photo')
  assert.equal(tree.children[1], paragraph)
})

test('inline float retains surrounding text and paragraph semantics', () => {
  const tree = root(element('p', [text('Before '), image('Photo|float=left'), text(' after.')]))
  decorateImageFrames(tree)
  assert.equal(tree.children[0].tagName, 'p')
  assert.equal(tree.children[0].children[0].value, 'Before ')
  assert.equal(tree.children[0].children[2].value, ' after.')
})

test('linked float remains clickable and standalone paragraph is removed', () => {
  const link = element('a', [image('Photo|float=right')], { href: '/profile' })
  const tree = root(element('p', [text('\n'), link, text(' ')]))
  decorateImageFrames(tree)
  assert.equal(tree.children[0], link)
  assert.equal(link.properties.href, '/profile')
  assert.ok(link.children[0].properties.className.includes('md-image-float-right'))
})

test('explicit default frame restores original presentation around float', () => {
  const tree = root(image('Photo|float=left|frame=default'))
  decorateImageFrames(tree)
  assert.ok(!tree.children[0].properties.className.includes('md-image-frameless'))
})

test('decoration is idempotent', () => {
  const tree = root(element('p', [image('Photo|120px|float=right')]))
  decorateImageFrames(tree)
  const once = structuredClone(tree)
  decorateImageFrames(tree)
  assert.deepEqual(tree, once)
})

test('code text and nested list content are not rewritten', () => {
  const literal = '![Photo|120px|float=right](/photo.png)'
  const tree = root(element('pre', [element('code', [text(literal)])]), element('ul', [element('li', [element('p', [image('Photo|float=left')])])]))
  decorateImageFrames(tree)
  assert.equal(tree.children[0].children[0].children[0].value, literal)
  assert.equal(tree.children[1].children[0].children[0].tagName, 'span')
})

test('invalid layout options never become CSS or classes', () => {
  const tree = root(image('Photo|float=right;position:fixed'))
  decorateImageFrames(tree)
  assert.deepEqual(tree.children[0].properties.className, ['md-image-frame'])
  assert.equal(tree.children[0].properties.style, undefined)
})

test('server and preview use identical layout; server retains intrinsic metadata', async () => {
  const sharp = require('sharp')
  const bytes = await sharp({ create: { width: 90, height: 120, channels: 3, background: '#ccc' } }).png().toBuffer()
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(bytes, { status: 200 })
  try {
    const { rehypeImageFrameRenderer } = loadTypeScript('lib/core/markdown/rehype-image-frame-renderer.ts')
    const fixture = root(element('p', [image('Photo|120px|float=right')]), element('p', [text('Biography')]))
    const preview = structuredClone(fixture)
    const server = structuredClone(fixture)
    rehypeImageFramePreviewRenderer()(preview)
    await rehypeImageFrameRenderer()(server)
    assert.deepEqual(server.children[0].properties, preview.children[0].properties)
    const serverImage = server.children[0].children[0].properties
    assert.equal(serverImage.width, 90)
    assert.equal(serverImage.height, 120)
    assert.equal(serverImage.loading, 'lazy')
    assert.equal(serverImage.alt, preview.children[0].children[0].properties.alt)
    assert.equal(server.children[1].children[0].value, 'Biography')
  } finally {
    globalThis.fetch = previousFetch
  }
})
