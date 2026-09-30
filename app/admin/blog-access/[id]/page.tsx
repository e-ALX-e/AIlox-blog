import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { noPermission } from '@/lib/core/auth/guard'
import { accessManagerPath, parseArticleId } from '@/lib/core/blog-access/admin-navigation'
import { ArticleAccessManager } from '@/ui/admin/blog-access/article-access-manager'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '管理暗号与分享', robots: { index: false, follow: false } }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (await noPermission()) redirect('/zh')
  const id = parseArticleId((await params).id)
  if (id == null) notFound()
  const [article] = await db.select({ id: blogs.id, title: blogs.title, slug: blogs.slug, isPublished: blogs.isPublished })
    .from(blogs).where(eq(blogs.id, id)).limit(1)
  if (!article) notFound()

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 py-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <a href={accessManagerPath} className="underline underline-offset-4">← 返回暗号与分享</a>
          <a href={`/admin/blog/edit/${encodeURIComponent(article.slug)}`} className="rounded-md border px-4 py-2">返回编辑内容</a>
        </div>
        <div className="space-y-2">
          <h1 className="break-words text-2xl font-semibold">{article.title}</h1>
          <p className="break-all text-sm text-muted-foreground">#{article.id} · {article.slug} · {article.isPublished ? '已发布' : '草稿'}</p>
          <p className="text-sm text-muted-foreground">暗号保护和分享分别管理，不影响正文编辑；保存权限设置不会触发文章翻译。</p>
        </div>
      </header>
      {!article.isPublished ? <p className="rounded-lg border p-4 text-sm">这篇文章尚未发布。可以先设置暗号，再返回编辑页发布；发布后才能创建免暗号分享。</p> : null}
      <ArticleAccessManager key={article.id} articleId={article.id} />
    </div>
  )
}
