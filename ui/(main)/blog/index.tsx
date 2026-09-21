import type { Language } from '@/lib/i18n/config'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs, blogTranslations } from '@/db/schema'
import { ArticleList } from './article-list'

export default async function BlogListPage({ language }: { language: Language }) {
  const records = await db.query.blogs.findMany({
    where: eq(blogs.isPublished, true),
    orderBy: desc(blogs.createdAt),
    columns: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      tagLinks: {
        columns: {},
        with: {
          tag: true,
        },
      },
    },
  })

  const localizedTitleByBlogId = new Map<number, string>()

  if (language !== 'zh' && records.length > 0) {
    const translatedTitles = await db
      .select({
        blogId: blogTranslations.blogId,
        title: blogTranslations.title,
      })
      .from(blogTranslations)
      .where(
        and(
          eq(blogTranslations.language, language),
          inArray(
            blogTranslations.blogId,
            records.map(record => record.id),
          ),
        ),
      )

    for (const translation of translatedTitles) {
      localizedTitleByBlogId.set(translation.blogId, translation.title)
    }
  }

  const blogList = records.map(({ tagLinks, ...blog }) => ({
    ...blog,
    title: localizedTitleByBlogId.get(blog.id) ?? blog.title,
    tags: tagLinks.map(link => link.tag),
  }))

  return <ArticleList items={blogList} />
}
