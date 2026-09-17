import { and, eq } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { processor } from '@/lib/core/markdown/processor'
import { withResponse } from '@/lib/infra/http/with-response'

export const GET = withResponse(async (_, { params }: { params: Promise<{ slug: string }> }) => {
  const slug = (await params).slug

  if (slug.trim().length === 0) {
    throw new BadRequestError('Invalid slug.', { data: { slug } })
  }

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

  if (record == null || record.content.length === 0) {
    return null
  }

  const { tagLinks, ...blog } = record
  const blogHTML = await processor.process(blog.content)

  return {
    ...blog,
    content: blogHTML.toString(),
    tags: tagLinks.map(link => link.tag),
  }
})
