import { parseMarkdownImageSize } from './image-size'

export type NodeLike = {
  type: string
  children?: NodeLike[]
  [key: string]: unknown
}

export type ElementLike = NodeLike & {
  type: 'element'
  tagName: string
  properties?: Record<string, unknown>
  children: NodeLike[]
}

export type ParentLike = { children: NodeLike[] }

export const isElement = (node: unknown): node is ElementLike =>
  typeof node === 'object' && node !== null &&
  (node as { type?: string }).type === 'element'

function hasClass(node: ElementLike, name: string) {
  const classes = node.properties?.className
  return Array.isArray(classes)
    ? classes.includes(name)
    : typeof classes === 'string' && classes.split(/\s+/).includes(name)
}

function createImageFrame(image: ElementLike): ElementLike {
  const options = parseMarkdownImageSize(image.properties?.alt)
  const floating = options.float === 'left' || options.float === 'right'
  const frameless = options.frame === 'none' || (floating && options.frame !== 'default')
  const className = ['md-image-frame']

  if (floating) className.push('md-image-float', `md-image-float-${options.float}`)
  if (frameless) className.push('md-image-frameless')

  image.properties = { ...image.properties, alt: options.alt }

  return {
    type: 'element',
    tagName: 'span',
    properties: {
      className,
      ...(options.width != null ? { style: `--md-image-width: ${options.width};` } : {}),
    },
    children: [image],
  }
}

function isWhitespace(node: NodeLike) {
  return node.type === 'text' && typeof node.value === 'string' && node.value.trim() === ''
}

function isFloatingImage(node: NodeLike): boolean {
  if (!isElement(node)) return false
  if (hasClass(node, 'md-image-float')) return true

  // Preserve links around images without leaving an empty paragraph behind.
  const children = node.children.filter(child => !isWhitespace(child))
  return node.tagName === 'a' && children.length === 1 && isFloatingImage(children[0])
}

/** Shared by the browser preview and the server renderer, after sanitization. */
export function decorateImageFrames(parent: ParentLike): void {
  parent.children = parent.children.flatMap(child => {
    if (isElement(child) && child.tagName === 'img') return [createImageFrame(child)]

    // Keep this transformer idempotent (do not re-wrap an already framed img).
    if (isElement(child) && hasClass(child, 'md-image-frame')) return [child]

    if (Array.isArray(child.children)) decorateImageFrames(child as ParentLike)

    if (isElement(child) && child.tagName === 'p') {
      const content = child.children.filter(node => !isWhitespace(node))
      if (content.length > 0 && content.every(isFloatingImage)) {
        // A Markdown image on its own line is normally wrapped in <p>.
        // Lift only floated images out so subsequent paragraphs can wrap,
        // without phantom paragraph margins or invalid block-in-p markup.
        return content
      }
    }

    return [child]
  })
}
