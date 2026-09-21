import 'server-only'
import { parseMarkdownImageSize } from './image-size'
import sharp from 'sharp'

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

const isElement = (node: unknown): node is ElementLike => {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: string }).type === 'element'
  )
}

const imageDimensionPromises = new Map<
  string,
  Promise<{ width: number; height: number }>
>()

const resolveImageUrl = (src: string) => {
  // 外部图片本来就是完整 URL，直接使用
  if (/^https?:\/\//i.test(src)) {
    return src
  }

  // 本站 /media/... 图片从 Next.js 内部访问，
  // 避免绕 Cloudflare 再访问自己。
  if (src.startsWith('/')) {
    const port = process.env.PORT ?? '3000'
    return `http://127.0.0.1:${port}${src}`
  }

  throw new Error(`Unsupported image URL: ${src}`)
}

const getImageDimensions = (src: string) => {
  const existingPromise = imageDimensionPromises.get(src)

  if (existingPromise != null) {
    return existingPromise
  }

  const dimensionPromise = (async () => {
    const url = resolveImageUrl(src)

    const response = await fetch(url, {
      cache: 'force-cache',
    })

    if (!response.ok) {
      throw new Error(
        `Failed to read image dimensions: ${src} (${response.status})`,
      )
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    const metadata = await sharp(buffer).metadata()

    if (metadata.width == null || metadata.height == null) {
      throw new Error(`Image dimensions are missing: ${src}`)
    }

    return {
      width: metadata.width,
      height: metadata.height,
    }
  })()

  imageDimensionPromises.set(src, dimensionPromise)

  return dimensionPromise
}

const collectImages = (
  parent: ParentLike,
  images: ElementLike[],
): void => {
  for (const child of parent.children) {
    if (isElement(child) && child.tagName === 'img') {
      images.push(child)
      continue
    }

    if ('children' in child && Array.isArray(child.children)) {
      collectImages(child as ParentLike, images)
    }
  }
}

const addImageProperties = async (image: ElementLike) => {
  const src = image.properties?.src

  if (typeof src !== 'string' || src.length === 0) {
    throw new Error('Image source is missing')
  }

  const dimensions = await getImageDimensions(src)

  image.properties = {
    ...image.properties,
    loading: 'lazy',
    decoding: 'async',
    height: dimensions.height,
    width: dimensions.width,
  }
}

const createImageFrame = (imageNode: ElementLike): ElementLike => {
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

const walkAndDecorate = (parent: ParentLike): void => {
  parent.children = parent.children.map(child => {
    if (isElement(child) && child.tagName === 'img') {
      return createImageFrame(child)
    }

    if ('children' in child && Array.isArray(child.children)) {
      walkAndDecorate(child as ParentLike)
    }

    return child
  })
}

export const rehypeImageFrameRenderer = () => {
  return async (tree: ParentLike) => {
    const images: ElementLike[] = []

    collectImages(tree, images)

    await Promise.all(
      images.map(addImageProperties),
    )

    walkAndDecorate(tree)
  }
}
