'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, startTransition, use, useLayoutEffect, useState } from 'react'
import { seoMetadata } from '@/config/seo'
import { isLanguage, type Language, languageHtmlLang, languages } from '@/lib/i18n/config'
import { getRoutePathname } from '@/lib/i18n/get-route-pathname'
import { messages } from '@/lib/i18n/messages'

const LanguageContext = createContext<
  | {
      language: Language
      nextLanguage: Language
      isLanguageChanging: boolean
      changeLanguage: (language: Language) => void
      toggleLanguage: () => void
    }
  | undefined
>(undefined)

function getLocalizedPathname(pathname: string, language: Language) {
  const pathSegments = pathname.split('/')

  pathSegments[1] = language
  return pathSegments.join('/')
}

function requireLanguage(value: string) {
  if (!isLanguage(value)) {
    throw new Error(`Unsupported route language: ${value}`)
  }

  return value
}

function getDocumentTitle(pathname: string, language: Language, currentTitle: string) {
  const routePathname = getRoutePathname(pathname)
  const pageTitle =
    routePathname === '/'
      ? seoMetadata[language].home.title
      : routePathname === '/blog'
        ? seoMetadata[language].blog.title
        : routePathname === '/friends'
          ? seoMetadata[language].friends.title
          : currentTitle.replace(/\s*&\s*(?:黯留星|Ailoxi|叶鱼|Yuuri)$/, '')
  const siteName = language === 'zh' || language === 'zh-tw' ? '黯留星' : 'Ailoxi'

  return `${pageTitle} & ${siteName}`
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const routeLanguage = requireLanguage(pathname.split('/')[1] ?? '')
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null)
  const language = pendingLanguage ?? routeLanguage
  const isLanguageChanging = pendingLanguage != null && pendingLanguage !== routeLanguage
  const languageIndex = languages.indexOf(language)
  const nextLanguage = languages[(languageIndex + 1) % languages.length]

  useLayoutEffect(() => {
    if (pendingLanguage === routeLanguage) {
      setPendingLanguage(null)
    }

    document.documentElement.lang = languageHtmlLang[language]
    document.title = getDocumentTitle(pathname, language, document.title)
  }, [language, pathname, pendingLanguage, routeLanguage])

  const changeLanguage = (next: Language) => {
    if (isLanguageChanging || next === language) return

    const url = new URL(window.location.href)
    url.pathname = getLocalizedPathname(pathname, next)
    const href = `${url.pathname}${url.search}${url.hash}`

    // Update client-side labels immediately, but also navigate through the
    // Next.js router so Server Components (blog list/detail) are re-fetched.
    setPendingLanguage(next)
    startTransition(() => {
      router.replace(href, { scroll: false })
    })
  }

  const toggleLanguage = () => {
    changeLanguage(nextLanguage)
  }

  const value = {
    language,
    nextLanguage,
    isLanguageChanging,
    changeLanguage,
    toggleLanguage,
  }

  return <LanguageContext value={value}>{children}</LanguageContext>
}

export function useLanguage() {
  const context = use(LanguageContext)

  if (context === undefined) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }

  return context
}

export function useTranslations() {
  const { language } = useLanguage()

  return messages[language]
}
