import { parseMarkdownImageSize } from './image-size'

type NodeLike = {
  type: string
  children?: NodeLike[]
  [key: string]: unknown
}

type ElementLike = NodeLike & {
  type: 'element'
  tagName: string
  properties?: Record<string, unknown>
  children: NodeLike[]
}

type ParentLike = {
  children: NodeLike[]
}

const isElement = (
  node: unknown,
): node is ElementLike => {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: string }).type === 'element'
  )
}

const createImageFrame = (
  imageNode: ElementLike,
): ElementLike => {
  const { alt, width } = parseMarkdownImageSize(
    imageNode.properties?.alt,
  )

  imageNode.properties = {
    ...imageNode.properties,
    alt,
  }

  return {
    type: 'element',
    tagName: 'span',

    properties: {
      className: ['md-image-frame'],

      ...(width != null
        ? {
            style: `--md-image-width: ${width};`,
          }
        : {}),
    },

    children: [imageNode],
  }
}

const walkAndDecorate = (
  parent: ParentLike,
): void => {
  parent.children = parent.children.map(child => {
    if (
      isElement(child) &&
      child.tagName === 'img'
    ) {
      return createImageFrame(child)
    }

    if (
      'children' in child &&
      Array.isArray(child.children)
    ) {
      walkAndDecorate(child as ParentLike)
    }

    return child
  })
}

export const rehypeImageFramePreviewRenderer = () => {
  return (tree: ParentLike) => {
    walkAndDecorate(tree)
  }
}
