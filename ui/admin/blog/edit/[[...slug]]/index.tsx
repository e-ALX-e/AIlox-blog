import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { noPermission } from '@/lib/core/auth/guard'
import { BlogEditForm } from './blog-edit-form'

export async function AdminBlogEditPage({ slug }: { slug: string | null }) {
  if (await noPermission()) {
    redirect('/admin/blog')
  }

  const article =
    slug != null
      ? await db.query.blogs.findFirst({
          where: eq(blogs.slug, slug),
          with: {
            tagLinks: {
              columns: {},
              with: {
                tag: true,
              },
            },
          },
        })
      : null

  const relatedBlogTagNames = article != null ? article.tagLinks.map(v => v.tag.tagName) : []
  const articleRecord =
    article == null ? null : (({ tagLinks: _tagLinks, ...record }) => record)(article)

  return <BlogEditForm article={articleRecord} relatedArticleTagNames={relatedBlogTagNames} />
}
