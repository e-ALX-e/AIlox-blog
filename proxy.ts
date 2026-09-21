import { type NextRequest, NextResponse } from 'next/server'

function getPreferredLanguage(acceptLanguage: string | null) {
  const value = acceptLanguage?.toLowerCase() ?? ''

  if (/\bzh-(tw|hk|mo)\b/.test(value)) return 'zh-tw'
  if (/\bzh\b/.test(value)) return 'zh'
  if (/\bja\b/.test(value)) return 'ja'
  if (/\bru\b/.test(value)) return 'ru'
  if (/\bde\b/.test(value)) return 'de'

  return 'en'
}

export function proxy(request: NextRequest) {
  const language = getPreferredLanguage(request.headers.get('accept-language'))
  const localizedUrl = request.nextUrl.clone()
  localizedUrl.pathname = `/${language}${request.nextUrl.pathname}`

  return NextResponse.redirect(localizedUrl)
}

export const config = {
  matcher: ['/', '/blog', '/blog/:path*', '/friends'],
}
