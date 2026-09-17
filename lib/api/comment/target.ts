import 'server-only'

import type { CommentTarget } from './type'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs, type siteCommentTargetTypeEnum } from '@/db/schema'
import { defaultLanguage } from '@/lib/i18n/config'

export const getSiteCommentTargetKey = (
  targetType: (typeof siteCommentTargetTypeEnum.enumValues)[number],
  targetId: number,
) => `${targetType}:${targetId}`

export async function getSiteCommentTarget(
  targetType: (typeof siteCommentTargetTypeEnum.enumValues)[number],
  targetId: number,
): Promise<CommentTarget | null> {
  const blog = await db.query.blogs.findFirst({
    where: eq(blogs.id, targetId),
    columns: {
      id: true,
      title: true,
      slug: true,
      isPublished: true,
    },
  })

  if (blog == null) {
    return null
  }

  return {
    ...blog,
    targetType,
    path: `/${defaultLanguage}/blog/${blog.slug}`,
  }
}

export async function getSiteCommentTargetMap(
  targets: Array<{
    targetType: (typeof siteCommentTargetTypeEnum.enumValues)[number]
    targetId: number
  }>,
) {
  const blogIdSet = new Set<number>()

  for (const target of targets) {
    blogIdSet.add(target.targetId)
  }

  const blogIds = Array.from(blogIdSet)

  const blogList =
    blogIds.length === 0
      ? []
      : await db.query.blogs.findMany({
          where: inArray(blogs.id, blogIds),
          columns: {
            id: true,
            title: true,
            slug: true,
            isPublished: true,
          },
        })

  const map = new Map<string, CommentTarget>()

  for (const blog of blogList) {
    map.set(getSiteCommentTargetKey('BLOG', blog.id), {
      ...blog,
      targetType: 'BLOG',
      path: `/${defaultLanguage}/blog/${blog.slug}`,
    })
  }

  return map
}
