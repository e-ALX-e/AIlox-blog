import type { Metadata } from 'next'
import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { seoMetadata } from '@/config/seo'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { getRouteLanguage } from '@/lib/i18n/get-route-language'
import { BlogDetail } from '@/ui/(main)/blog/[slug]'

export async function generateStaticParams() {
  const publishedBlogs = await db
    .select({ slug: blogs.slug })
    .from(blogs)
    .where(eq(blogs.isPublished, true))

  return publishedBlogs.map(blog => ({ slug: blog.slug }))
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
    columns: { title: true },
  })

  if (blog == null) {
    notFound()
  }

  return {
    title: blog.title,
    description: seoMetadata[language].articleDescription(blog.title),
    alternates: {
      canonical: `/${language}/blog/${slug}`,
      languages: {
        zh: `/zh/blog/${slug}`,
        en: `/en/blog/${slug}`,
      },
    },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ language: string; slug: string }>
}) {
  const slug = (await params).slug

  return <BlogDetail slug={slug} />
}
