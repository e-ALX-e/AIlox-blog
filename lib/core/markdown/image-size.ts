export type MarkdownImageSize = {
  alt: string
  width?: string
}

export const parseMarkdownImageSize = (
  altValue: unknown,
): MarkdownImageSize => {
  const alt = typeof altValue === 'string' ? altValue : ''

  // 支持：
  // 图片说明|70%
  // 图片说明|600px
  const match = alt.match(/^(.*)\|(\d{1,4}%|\d{1,4}px)$/i)

  if (match == null) {
    return { alt }
  }

  const cleanAlt = match[1].trim()
  const rawWidth = match[2].toLowerCase()

  if (rawWidth.endsWith('%')) {
    const value = Number.parseInt(rawWidth, 10)

    // 限制 10% ~ 100%
    if (value < 10 || value > 100) {
      return { alt }
    }

    return {
      alt: cleanAlt,
      width: `${value}%`,
    }
  }

  const value = Number.parseInt(rawWidth, 10)

  // px 限制一下，避免误输入
  if (value < 64 || value > 2000) {
    return { alt }
  }

  return {
    alt: cleanAlt,
    width: `${value}px`,
  }
}
