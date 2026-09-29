import type { Language } from '@/lib/i18n/config'

/** Browser-safe URL helpers: a URL supplies a candidate, never authorization. */
export function buildArticleCodeLink(siteUrl: string, slug: string, code: string): string {
  const url = new URL(`/zh/blog/${encodeURIComponent(slug)}`, siteUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('站点地址无效。')
  }
  // Fragments are not part of the HTTP request URL. Encode literal +, &, # and spaces.
  url.hash = `code=${encodeURIComponent(code)}`
  return url.toString()
}

export function readArticleCodeLink(href: string): { code: string | null; cleanUrl: string } | null {
  const url = new URL(href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  const hasFragmentCode = fragment.has('code')
  const hasQueryCode = url.searchParams.has('code')
  if (!hasFragmentCode && !hasQueryCode) return null

  // Query links are accepted for compatibility, but generation always uses #code.
  // Their first request may already be in proxy logs; cleanup cannot undo that.
  const candidates = [...fragment.getAll('code'), ...url.searchParams.getAll('code')]
  if (hasFragmentCode) {
    fragment.delete('code')
    url.hash = fragment.toString()
  }
  if (hasQueryCode) url.searchParams.delete('code')

  // Reject ambiguous duplicates rather than guessing which credential to verify.
  const code = candidates.length === 1 && candidates[0].length <= 128 ? candidates[0] : null
  return { code, cleanUrl: `${url.pathname}${url.search}${url.hash}` }
}

export function buildArticleShareLink(siteUrl: string, slug: string, token: string, language: Language = 'zh') {
  const url = new URL(`/${language}/blog/${encodeURIComponent(slug)}`, siteUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('站点地址无效。')
  url.hash = `share=${encodeURIComponent(token)}`
  return url.toString()
}

export function readArticleAccessLink(href: string): {
  kind: 'code' | 'share'; value: string | null; cleanUrl: string
} | null {
  const url = new URL(href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  const shares = [...fragment.getAll('share'), ...url.searchParams.getAll('share')]
  if (shares.length === 0) {
    const code = readArticleCodeLink(href)
    return code == null ? null : { kind: 'code', value: code.code, cleanUrl: code.cleanUrl }
  }
  const mixed = fragment.has('code') || url.searchParams.has('code')
  const fragmentCredential = fragment.has('share') || fragment.has('code')
  for (const key of ['code', 'share']) {
    fragment.delete(key)
    url.searchParams.delete(key)
  }
  // Keep ordinary chapter anchors untouched, and scrub even conflicting credentials.
  if (fragmentCredential) url.hash = fragment.toString()
  return { kind: 'share', value: !mixed && shares.length === 1 && shares[0].length === 84 ? shares[0] : null,
    cleanUrl: `${url.pathname}${url.search}${url.hash}` }
}
