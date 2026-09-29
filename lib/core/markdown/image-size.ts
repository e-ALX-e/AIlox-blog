export type MarkdownImageSize = {
  alt: string
  width?: string
  float?: 'left' | 'right' | 'none'
  frame?: 'none' | 'default'
}

function parseWidth(value: string): string | undefined {
  const match = value.match(/^(\d{1,4})(%|px)$/i)
  if (match == null) return undefined

  const number = Number(match[1])
  const unit = match[2].toLowerCase()
  const valid = unit === '%' ? number >= 10 && number <= 100 : number >= 64 && number <= 2000

  return valid ? `${number}${unit}` : undefined
}

/**
 * Only consume a trailing sequence of known, validated layout options.
 * Existing alt text (including pipes) and the original |80% / |600px syntax
 * remain supported. Never turn arbitrary Markdown text into CSS.
 * Example: ![Photo|120px|float=right|frame=none](/media/photo.webp)
 */
export const parseMarkdownImageSize = (altValue: unknown): MarkdownImageSize => {
  const originalAlt = typeof altValue === 'string' ? altValue : ''
  const parts = originalAlt.split('|')
  const result: MarkdownImageSize = { alt: originalAlt }
  let consumed = false

  while (parts.length > 1) {
    const option = parts[parts.length - 1].trim().toLowerCase()
    const width = parseWidth(option.startsWith('width=') ? option.slice(6) : option)

    if (width != null) {
      result.width ??= width
    } else if (/^float=(left|right|none)$/.test(option)) {
      result.float ??= option.slice(6) as 'left' | 'right' | 'none'
    } else if (/^frame=(none|default)$/.test(option)) {
      result.frame ??= option.slice(6) as 'none' | 'default'
    } else {
      break
    }

    consumed = true
    parts.pop()
  }

  if (consumed) result.alt = parts.join('|').trim()
  return result
}
