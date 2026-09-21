import type { Metadata } from 'next'
import { seoMetadata } from '@/config/seo'
import { getRouteLanguage } from '@/lib/i18n/get-route-language'
import HomePage from '@/ui/(main)/(home)'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string }>
}): Promise<Metadata> {
  const language = getRouteLanguage((await params).language)

  return {
    ...seoMetadata[language].home,
    alternates: {
      canonical: `/${language}`,
      languages: {
        'zh': "/zh",
        'en': "/en",
        'zh-TW': "/zh-tw",
        'ja': "/ja",
        'ru': "/ru",
        'de': "/de"
},
    },
  }
}

export default function Page() {
  return <HomePage />
}
