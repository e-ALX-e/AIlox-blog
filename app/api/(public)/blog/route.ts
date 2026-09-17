import { and, desc, eq, like } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { withResponse } from '@/lib/infra/http/with-response'
import { getPublicBlogsQuerySchema } from './schema'

export const GET = withResponse(async request => {
  const queryResult = getPublicBlogsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { q } = queryResult.data
  const records = await db.query.blogs.findMany({
    where: and(
      eq(blogs.isPublished, true),
      q != null && q.length > 0 ? like(blogs.title, `%${q}%`) : undefined,
    ),
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

  return records.map(({ tagLinks, ...blog }) => ({
    ...blog,
    tags: tagLinks.map(link => link.tag),
  }))
})
