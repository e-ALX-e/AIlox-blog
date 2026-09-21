import type { Metadata } from 'next'
import { seoMetadata } from '@/config/seo'
import { getRouteLanguage } from '@/lib/i18n/get-route-language'
import BlogListPage from '@/ui/(main)/blog'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string }>
}): Promise<Metadata> {
  const language = getRouteLanguage((await params).language)

  return {
    ...seoMetadata[language].blog,
    alternates: {
      canonical: `/${language}/blog`,
      languages: {
        'zh': "/zh/blog",
        'en': "/en/blog",
        'zh-TW': "/zh-tw/blog",
        'ja': "/ja/blog",
        'ru': "/ru/blog",
        'de': "/de/blog"
},
    },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ language: string }>
}) {
  const language = getRouteLanguage((await params).language)

  return <BlogListPage language={language} />
}
