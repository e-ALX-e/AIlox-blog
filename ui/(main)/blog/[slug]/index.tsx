import type { Language } from '@/lib/i18n/config'
import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db/instance'
import { blogs, blogTranslations } from '@/db/schema'
import { canReadArticle } from '@/lib/core/blog-access/service'
import { processor } from '@/lib/core/markdown/processor'
import { ArticleCodeGate } from '@/ui/(main)/blog/article-code-gate'
import ArticleDisplayPage from '@/ui/(main)/blog/article-display-page'
import DeferredCommentCard from '@/ui/(main)/blog/comment-card/deferred-comment-card'
import HorizontalDividingLine from '@/ui/components/shared/horizontal-dividing-line'
import { MainScrollBlur } from '@/ui/components/shared/main-scroll-blur'

export async function BlogDetail({ slug, language }: { slug: string; language: Language }) {
  const record = await db.query.blogs.findFirst({
    where: and(eq(blogs.slug, slug), eq(blogs.isPublished, true)),
    with: { tagLinks: { columns: {}, with: { tag: true } } },
  })
  if (record == null || record.content.length === 0) notFound()

  if (!(await canReadArticle(record.id))) {
    // Titles remain public in every locale; no body is serialized into client props.
    const translatedTitle = language === 'zh' ? null : await db
      .select({ title: blogTranslations.title, sourceUpdatedAt: blogTranslations.sourceUpdatedAt })
      .from(blogTranslations)
      .where(and(eq(blogTranslations.blogId, record.id), eq(blogTranslations.language, language)))
      .limit(1).then(rows => rows[0] ?? null)
    const title = translatedTitle != null &&
      new Date(translatedTitle.sourceUpdatedAt).getTime() >= new Date(record.updatedAt).getTime()
      ? translatedTitle.title : record.title
    return <ArticleCodeGate slug={slug} title={title} language={language} />
  }

  const translation = language === 'zh' ? null : await db
    .select({ title: blogTranslations.title, content: blogTranslations.content,
      sourceUpdatedAt: blogTranslations.sourceUpdatedAt })
    .from(blogTranslations)
    .where(and(eq(blogTranslations.blogId, record.id), eq(blogTranslations.language, language)))
    .limit(1).then(rows => rows[0] ?? null)
  const isFreshTranslation = translation != null &&
    new Date(translation.sourceUpdatedAt).getTime() >= new Date(record.updatedAt).getTime()
  const localizedContent = isFreshTranslation ? translation.content : record.content
  const sanitizedBlogHtml = await processor.process(localizedContent)
  const tagNames = record.tagLinks.map(link => link.tag.tagName)

  return (
    <div className="flex flex-col gap-4">
      <ArticleDisplayPage createdAt={record.createdAt} sanitizedContent={sanitizedBlogHtml.toString()} tags={tagNames} />
      <HorizontalDividingLine />
      <DeferredCommentCard articleId={record.id} />
      <MainScrollBlur />
    </div>
  )
}
