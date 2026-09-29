import { and, eq } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { canReadArticle } from '@/lib/core/blog-access/service'
import { privateJson } from '@/lib/core/blog-access/http'
import { processor } from '@/lib/core/markdown/processor'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    if (slug.trim().length === 0) return privateJson({ message: '文章地址无效。' }, 400)
    const record = await db.query.blogs.findFirst({
      where: and(eq(blogs.slug, slug), eq(blogs.isPublished, true)),
      with: { tagLinks: { columns: {}, with: { tag: true } } },
    })
    if (record == null || record.content.length === 0) return privateJson(null)
    if (!(await canReadArticle(record.id))) {
      // Deliberately construct an allowlisted DTO; never spread the record here.
      return privateJson({ id: record.id, slug: record.slug, title: record.title,
        requiresAccessCode: true, message: '请先输入文章暗号。' }, 403)
    }
    const { tagLinks, ...blog } = record
    const blogHTML = await processor.process(blog.content)
    return privateJson({ ...blog, content: blogHTML.toString(), tags: tagLinks.map(link => link.tag) })
  } catch {
    return privateJson({ message: '暂时无法读取文章。' }, 503)
  }
}
