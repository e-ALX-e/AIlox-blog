import type { Metadata } from 'next'
import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { seoMetadata } from '@/config/seo'
import { db } from '@/db/instance'
import { blogs, blogTranslations } from '@/db/schema'
import { getRouteLanguage } from '@/lib/i18n/get-route-language'
import { BlogDetail } from '@/ui/(main)/blog/[slug]'

export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string; slug: string }>
}): Promise<Metadata> {
  const { language: languageParam, slug } = await params
  const language = getRouteLanguage(languageParam)
  const blog = await db.query.blogs.findFirst({
    where: and(eq(blogs.slug, slug), eq(blogs.isPublished, true)),
    columns: { id: true, title: true, updatedAt: true },
  })

  if (blog == null) {
    notFound()
  }

  const translatedTitle =
    language === 'zh'
      ? null
      : await db
          .select({ title: blogTranslations.title, sourceUpdatedAt: blogTranslations.sourceUpdatedAt })
          .from(blogTranslations)
          .where(
            and(
              eq(blogTranslations.blogId, blog.id),
              eq(blogTranslations.language, language),
            ),
          )
          .limit(1)
          .then(rows => {
            const translation = rows[0]
            if (translation == null) return null

            return new Date(translation.sourceUpdatedAt).getTime() >= new Date(blog.updatedAt).getTime()
              ? translation.title
              : null
          })

  const title = translatedTitle ?? blog.title

  return {
    title,
    description: seoMetadata[language].articleDescription(title),
    alternates: {
      canonical: `/${language}/blog/${slug}`,
      languages: {
        zh: `/zh/blog/${slug}`,
        en: `/en/blog/${slug}`,
        'zh-TW': `/zh-tw/blog/${slug}`,
        ja: `/ja/blog/${slug}`,
        ru: `/ru/blog/${slug}`,
        de: `/de/blog/${slug}`,
      },
    },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ language: string; slug: string }>
}) {
  const { slug, language: languageParam } = await params
  const language = getRouteLanguage(languageParam)

  return <BlogDetail slug={slug} language={language} />
}
