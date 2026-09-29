/* Run with: node --test tests/floating-menus.test.cjs
 * Tests execute the real feature code with small React/Base UI adapters.
 * They are unit/regression tests, not a full browser or production build test.
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const base = 'ui/(main)/layout/draggable-floating-menu/'
const node = (type, props) => ({ type, props: props || {} })
const jsx = { jsx: node, jsxs: node, Fragment: 'Fragment' }
const css = new Proxy({}, { get: (_, name) => String(name) })
const cn = (...values) => values.filter(Boolean).join(' ')

function load(file, mocks = {}) {
  const filename = path.join(root, file)
  const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  })
  assert.equal((diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  const instance = new Module(filename, module)
  instance.filename = filename
  instance.paths = Module._nodeModulePaths(path.dirname(filename))
  instance.require = name => {
    if (name === 'react/jsx-runtime') return jsx
    if (name.endsWith('.module.css')) return css
    if (name === '@/lib/utils/common/shadcn') return { cn }
    if (Object.hasOwn(mocks, name)) return mocks[name]
    return require(name)
  }
  instance._compile(outputText, filename)
  return instance.exports
}

function hookAdapter(server = false) {
  const slots = []
  let index = 0
  const effects = []
  const hooks = {
    useState(initial) {
      const i = index++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(value) { const i = index++; return slots[i] ??= { current: value } },
    useMemo(fn) { return fn() },
    useEffect(fn, deps) {
      const i = index++
      const previous = slots[i]
      if (!previous || deps.some((d, n) => d !== previous.deps[n])) {
        effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() } })
      }
    },
    useSyncExternalStore(_subscribe, snapshot, serverSnapshot) {
      return server ? serverSnapshot() : snapshot()
    },
  }
  return {
    hooks,
    render(component, props) {
      index = 0
      const result = component(props)
      while (effects.length) effects.shift()()
      return result
    },
  }
}

function walk(tree) {
  if (tree == null || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(walk)
  return [tree, ...walk(tree.props?.children)]
}
const find = (tree, type) => walk(tree).find(n => n.type === type)
const labels = load(base + 'menu-labels.ts')
const provider = { useLanguage: () => ({ language: 'zh' }) }

const commonClockMocks = {
  '@/lib/i18n/config': { languageHtmlLang: { zh: 'zh-CN' } },
  '@/ui/components/provider/main/language-provider': provider,
  './floating-menu-shell': { FloatingMenuShell: 'Shell' },
  './menu-labels': labels,
}

for (const [name, timeZone, date, expected] of [
  ['LA winter', 'America/Los_Angeles', '2026-01-15T12:34:56Z', '04:34:56'],
  ['LA summer', 'America/Los_Angeles', '2026-07-15T12:34:56Z', '05:34:56'],
  ['China winter', 'Asia/Shanghai', '2026-01-15T12:34:56Z', '20:34:56'],
  ['China summer', 'Asia/Shanghai', '2026-07-15T12:34:56Z', '20:34:56'],
  ['China midnight', 'Asia/Shanghai', '2026-09-29T16:00:00Z', '00:00:00'],
  ['LA spring DST before', 'America/Los_Angeles', '2026-03-08T09:59:59Z', '01:59:59'],
  ['LA spring DST after', 'America/Los_Angeles', '2026-03-08T10:00:00Z', '03:00:00'],
  ['LA fall DST before', 'America/Los_Angeles', '2026-11-01T08:59:59Z', '01:59:59'],
  ['LA fall DST after', 'America/Los_Angeles', '2026-11-01T09:00:00Z', '01:00:00'],
]) {
  test(name, () => {
    const { createWorldTimeFormatters } = load(base + 'world-time-floating-menu.tsx', { ...commonClockMocks, react: {} })
    assert.equal(createWorldTimeFormatters('en-US', timeZone).time.format(new Date(date)), expected)
  })
}

test('clock date crosses local midnight, not the browser midnight', () => {
  const { createWorldTimeFormatters } = load(base + 'world-time-floating-menu.tsx', { ...commonClockMocks, react: {} })
  const date = new Date('2026-09-29T16:00:00Z')
  assert.equal(createWorldTimeFormatters('en-US', 'Asia/Shanghai').date.formatToParts(date).find(p => p.type === 'day').value, '30')
  assert.equal(createWorldTimeFormatters('en-US', 'America/Los_Angeles').date.formatToParts(date).find(p => p.type === 'day').value, '29')
})

test('clock mounts only its two locations and stops timers when hidden or closed', () => {
  const previous = { window: global.window, document: global.document }
  const events = new Map(), timers = new Map(), frames = new Map()
  let next = 0
  global.window = {
    requestAnimationFrame: fn => { frames.set(++next, fn); return next },
    cancelAnimationFrame: id => frames.delete(id),
    setInterval: (fn, ms) => { assert.equal(ms, 1000); timers.set(++next, fn); return next },
    clearInterval: id => timers.delete(id),
  }
  global.document = { visibilityState: 'visible', addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) }
  try {
    const app = hookAdapter()
    const { WorldTimeFloatingMenu } = load(base + 'world-time-floating-menu.tsx', { ...commonClockMocks, react: app.hooks })
    let output = app.render(WorldTimeFloatingMenu, { open: false, onOpenChange() {} })
    assert.equal(timers.size, 0)
    assert.equal(output.props.kind, 'time')
    assert.deepEqual(walk(output).filter(n => n.props?.timeZone).map(n => n.props.timeZone), ['Asia/Shanghai', 'America/Los_Angeles'])
    output = app.render(WorldTimeFloatingMenu, { open: true, onOpenChange() {} })
    assert.equal(timers.size, 1)
    for (const fn of timers.values()) fn()
    global.document.visibilityState = 'hidden'; events.get('visibilitychange')()
    assert.equal(timers.size, 0); assert.equal(frames.size, 0)
    global.document.visibilityState = 'visible'; events.get('visibilitychange')()
    assert.equal(timers.size, 1); assert.equal(frames.size, 1)
    app.render(WorldTimeFloatingMenu, { open: false, onOpenChange() {} })
    assert.equal(timers.size, 0); assert.equal(frames.size, 0); assert.equal(events.size, 0)
  } finally { Object.assign(global, previous) }
})

test('both independent orbs mount once; a stale close cannot dismiss the other panel', () => {
  const app = hookAdapter()
  const { MainStage } = load('ui/(main)/layout/main-stage.tsx', {
    react: app.hooks,
    '@/store/use-sky-background-store': { useIsBackgroundOnly: () => false },
    './background': { Background: 'Background' },
    './background/sky-background-sync': { SkyBackgroundSync: 'SkySync' },
    './draggable-floating-menu': { DraggableFloatingMenu: 'Settings' },
    './draggable-floating-menu/world-time-floating-menu': { WorldTimeFloatingMenu: 'Time' },
  })
  const render = () => app.render(MainStage, { children: 'article' })
  let output = render()
  assert.equal(walk(output).filter(n => ['Settings', 'Time'].includes(n.type)).length, 2)
  assert.equal(find(output, 'Settings').props.open, false)
  assert.equal(find(output, 'Time').props.open, false)
  find(output, 'Settings').props.onOpenChange(true)
  output = render(); assert.equal(find(output, 'Settings').props.open, true)
  find(output, 'Time').props.onOpenChange(true)
  find(output, 'Settings').props.onOpenChange(false)
  output = render()
  assert.equal(find(output, 'Settings').props.open, false)
  assert.equal(find(output, 'Time').props.open, true)
  find(output, 'Time').props.onOpenChange(false)
  assert.equal(find(render(), 'Time').props.open, false)
})

function shellFixture({ server = false, compact = false, open = false, kind = 'settings' } = {}) {
  const app = hookAdapter(server)
  const opens = [], styleChanges = []
  const { FloatingMenuShell } = load(base + 'floating-menu-shell.tsx', {
    '@base-ui/react/popover': { Popover: Object.fromEntries(['Root', 'Trigger', 'Portal', 'Positioner', 'Popup', 'Title', 'Close'].map(k => [k, k])) },
    'lucide-react': { Globe2: 'Globe', Layers: 'Layers', Sparkles: 'Sparkles' },
    'motion/react': { motion: { div: 'Drag' }, useReducedMotion: () => false },
    react: app.hooks, 'react-dom': { createPortal: content => content },
    '@/ui/components/provider/main/language-provider': provider,
    '@/ui/shadcn/fluid-orb': { __esModule: true, default: 'FluidOrb' },
    './floating-menu-action-button': { FloatingMenuActionButton: 'OrbButton' },
    './menu-labels': labels,
    './use-panel-style': { usePanelStyle: () => ['standard', value => styleChanges.push(value)] },
  })
  global.window = { matchMedia: () => ({ matches: compact }) }
  global.document = { body: 'body' }
  return { output: app.render(FloatingMenuShell, { kind, open, title: 'Title', openLabel: 'Open', closeLabel: 'Close', onOpenChange: next => opens.push(next), children: 'content' }), opens, styleChanges }
}

test('shared shell has the same sizing and style switch for both colors', () => {
  const previous = { window: global.window, document: global.document }
  try {
    for (const kind of ['settings', 'time']) {
      const { output, styleChanges } = shellFixture({ kind })
      assert.equal(find(output, 'FluidOrb').props.size, 48)
      assert.equal(find(output, 'FluidOrb').props.color, kind === 'time' ? '#8b5cf6' : '#3b82f6')
      assert.equal(find(output, 'Drag').props['data-floating-menu'], kind)
      assert.equal(find(output, 'Popup').props['data-menu'], kind)
      assert.equal(find(output, 'Popup').props['data-surface'], 'standard')
      const styleButtons = walk(output).filter(n => n.type === 'button')
      assert.equal(styleButtons.length, 2)
      styleButtons[1].props.onClick()
      assert.deepEqual(styleChanges, ['glass'])
      assert.equal(find(output, 'Positioner').props.side, 'left')
      assert.equal(find(output, 'Positioner').props.align, 'end')
    }
    assert.equal(find(shellFixture({ compact: true }).output, 'Positioner').props.side, 'top')
  } finally { Object.assign(global, previous) }
})

test('dragging does not open a panel; a subsequent click or keyboard action does', () => {
  const previous = { window: global.window, document: global.document }
  try {
    const { output, opens } = shellFixture()
    const drag = find(output, 'Drag').props, popup = find(output, 'Root').props
    assert.equal(drag.drag, true)
    drag.onPointerDownCapture({ clientX: 100, clientY: 100 })
    drag.onPointerMoveCapture({ clientX: 115, clientY: 110 })
    drag.onDragStart(); drag.onDragEnd(); drag.onPointerUpCapture()
    popup.onOpenChange(true)
    assert.equal(opens.length, 0)
    let prevented = 0
    drag.onClickCapture({ detail: 1, preventDefault: () => prevented++, stopPropagation: () => prevented++ })
    assert.equal(prevented, 2)
    drag.onPointerDownCapture({ clientX: 50, clientY: 50 })
    drag.onPointerUpCapture()
    popup.onOpenChange(true)
    assert.deepEqual(opens, [true])
    drag.onDragStart(); drag.onDragEnd()
    drag.onKeyDownCapture({ key: 'Enter' }); popup.onOpenChange(true)
    assert.deepEqual(opens, [true, true])
    assert.equal(find(shellFixture({ open: true }).output, 'Drag').props.drag, false)
    assert.equal(shellFixture({ server: true }).output, null)
  } finally { Object.assign(global, previous) }
})

test('original music, sky and theme controls remain in the blue settings panel', () => {
  const effects = [], app = hookAdapter()
  const { DraggableFloatingMenu } = load(base + 'index.tsx', {
    react: app.hooks,
    'motion/react': { motion: { span: 'motion.span' }, useReducedMotion: () => false },
    'next-themes': { useTheme: () => ({ resolvedTheme: 'light', setTheme: v => effects.push(v) }) },
    '@/hooks/common/use-sound': { useSound: () => [() => effects.push('sound')] },
    '@/lib/core/sound/u-chat-scroll-button': { uChatScrollButtonSound: {} },
    '@/store/use-background-music-store': { useIsPlaying: () => false, useBackgroundMusicActions: () => ({ play: () => effects.push('play'), pause: () => effects.push('pause') }) },
    '@/ui/components/provider/main/language-provider': { useTranslations: () => ({ common: new Proxy({}, { get: (_, n) => String(n) }) }) },
    ...Object.fromEntries(['moon', 'sun', 'switch', 'volume', 'volume-off'].map(n => ['@/ui/shadcn/' + n, { [n === 'switch' ? 'Switch' : n === 'volume-off' ? 'VolumeOffIcon' : n[0].toUpperCase() + n.slice(1) + 'Icon']: n }])),
    './floating-menu-shell': { FloatingMenuShell: 'Shell' },
    './sky-background-controls': { SkyBackgroundControls: 'Sky' },
  })
  const output = app.render(DraggableFloatingMenu, { open: true, onOpenChange() {} })
  assert.equal(output.props.kind, 'settings')
  assert.ok(find(output, 'Sky'))
  find(output, 'switch').props.onCheckedChange(true)
  find(output, 'switch').props.onCheckedChange(false)
  walk(output).find(n => n.props?.['aria-label'] === 'switchToDarkTheme').props.onClick()
  assert.deepEqual(effects, ['play', 'sound', 'pause', 'dark', 'sound'])
})

test('existing surface preference is shared and retained without a storage migration', () => {
  const previous = global.window
  let value = 'glass'
  const events = []
  global.window = { localStorage: { getItem: key => { assert.equal(key, 'ailoxi:quick-menu:panel-style'); return value }, setItem: (_, v) => { value = v } }, dispatchEvent: e => events.push(e.type) }
  try {
    const { usePanelStyle } = load(base + 'use-panel-style.ts', { react: hookAdapter().hooks })
    assert.equal(usePanelStyle()[0], 'glass')
    usePanelStyle()[1]('standard')
    assert.equal(usePanelStyle()[0], 'standard')
    global.window.localStorage.setItem = () => { throw new Error('blocked') }
    usePanelStyle()[1]('glass')
    assert.equal(usePanelStyle()[0], 'glass')
    assert.equal(events.length, 2)
  } finally { global.window = previous }
})

test('styles explicitly dock both 48px orbs on the right and keep the reading bar clear', () => {
  const text = fs.readFileSync(path.join(root, base + 'panel.module.css'), 'utf8')
  assert.match(text, /right: calc\(28px \+ env\(safe-area-inset-right/)
  assert.match(text, /bottom: calc\(28px \+ env\(safe-area-inset-bottom/)
  assert.match(text, /bottom: calc\(104px \+ env\(safe-area-inset-bottom/)
  assert.match(text, /width: 48px/)
  assert.match(text, /height: 48px/)
  assert.match(text, /z-index: 110/)
  assert.match(text, /overflow-y: auto/)
  assert.match(text, /prefers-reduced-transparency/)
  assert.match(text, /prefers-reduced-motion/)
  assert.doesNotMatch(fs.readFileSync(path.join(root, base + 'index.tsx'), 'utf8'), /ChevronLeft|ChevronRight|setPage|aria-current/)
})

test('every supported language has non-empty clock and surface labels', () => {
  assert.deepEqual(Object.keys(labels.menuLabels).sort(), ['de', 'en', 'ja', 'ru', 'zh', 'zh-tw'])
  for (const language of Object.values(labels.menuLabels)) {
    assert.equal(Object.values(language).every(value => typeof value === 'string' && value.length > 0), true)
  }
})
