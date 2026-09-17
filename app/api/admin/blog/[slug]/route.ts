import { eq } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import { withResponse } from '@/lib/infra/http/with-response'

export const GET = withResponse(
  async (_request, { params }: { params: Promise<{ slug: string }> }) => {
    if (await noPermission()) {
      throw new BadRequestError('Insufficient permissions.')
    }

    const slug = (await params).slug

    if (slug.trim().length === 0) {
      throw new BadRequestError('Invalid slug.', { data: { slug } })
    }

    const record = await db.query.blogs.findFirst({
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

    if (record == null) {
      return null
    }

    const { tagLinks, ...blog } = record

    return {
      ...blog,
      tags: tagLinks.map(link => link.tag),
    }
  },
)
