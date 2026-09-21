import type { Language } from '@/lib/i18n/config'
import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db/instance'
import { blogs, blogTranslations } from '@/db/schema'
import { processor } from '@/lib/core/markdown/processor'
import ArticleDisplayPage from '@/ui/(main)/blog/article-display-page'
import DeferredCommentCard from '@/ui/(main)/blog/comment-card/deferred-comment-card'
import HorizontalDividingLine from '@/ui/components/shared/horizontal-dividing-line'
import { MainScrollBlur } from '@/ui/components/shared/main-scroll-blur'

export async function BlogDetail({ slug, language }: { slug: string; language: Language }) {
  const record = await db.query.blogs.findFirst({
    where: and(eq(blogs.slug, slug), eq(blogs.isPublished, true)),
    with: {
      tagLinks: {
        columns: {},
        with: {
          tag: true,
        },
      },
    },
  })

  if (record == null || record.content.length === 0) notFound()

  const translation =
    language === 'zh'
      ? null
      : await db
          .select({
            title: blogTranslations.title,
            content: blogTranslations.content,
            sourceUpdatedAt: blogTranslations.sourceUpdatedAt,
          })
          .from(blogTranslations)
          .where(
            and(
              eq(blogTranslations.blogId, record.id),
              eq(blogTranslations.language, language),
            ),
          )
          .limit(1)
          .then(rows => rows[0] ?? null)

  const { tagLinks, ...blog } = record
  const isFreshTranslation =
    translation != null &&
    new Date(translation.sourceUpdatedAt).getTime() >= new Date(blog.updatedAt).getTime()
  const localizedTranslation = isFreshTranslation ? translation : null
  const localizedContent = localizedTranslation?.content ?? blog.content
  const sanitizedBlogHtml = await processor.process(localizedContent)
  const article = {
    ...blog,
    title: localizedTranslation?.title ?? blog.title,
    content: sanitizedBlogHtml.toString(),
    tags: tagLinks.map(link => link.tag),
  }

  const { content, createdAt, tags, id } = article

  const tagNames = tags.map(v => v.tagName)

  return (
    <div className="flex flex-col gap-4">
      <ArticleDisplayPage createdAt={createdAt} sanitizedContent={content} tags={tagNames} />
      <HorizontalDividingLine />
      <DeferredCommentCard articleId={id} />
      <MainScrollBlur />
    </div>
  )
}
