'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { readArticleAccessLink } from '@/lib/core/blog-access/share-link'

/** Already authorized/public pages scrub capability URLs too; no redundant grant is needed. */
export function ArticleAccessLinkCleanup() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    const clean = () => {
      const supplied = readArticleAccessLink(window.location.href)
      if (supplied != null) window.history.replaceState(window.history.state, '', supplied.cleanUrl)
    }
    clean()
    window.addEventListener('hashchange', clean)
    window.addEventListener('popstate', clean)
    return () => {
      window.removeEventListener('hashchange', clean)
      window.removeEventListener('popstate', clean)
    }
  }, [pathname, searchParams])
  return null
}
