'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { readArticleCodeLink } from '@/lib/core/blog-access/share-link'

/** Authorized/public pages also remove a supplied phrase; no redundant unlock is needed. */
export function ArticleAccessLinkCleanup() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    const clean = () => {
      const supplied = readArticleCodeLink(window.location.href)
      if (supplied != null) window.history.replaceState(null, '', supplied.cleanUrl)
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
