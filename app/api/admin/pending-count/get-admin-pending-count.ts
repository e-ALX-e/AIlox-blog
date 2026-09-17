import 'server-only'

import { and, count, eq } from 'drizzle-orm'
import { db } from '@/db/instance'
import { friendLinks, siteComments } from '@/db/schema'

export async function getAdminPendingCount() {
  const [siteCommentPendingCount, friendLinkPendingCount] = await Promise.all([
    db
      .select({ value: count() })
      .from(siteComments)
      .where(and(eq(siteComments.state, 'PENDING'), eq(siteComments.targetType, 'BLOG')))
      .then(([result]) => result.value),
    db
      .select({ value: count() })
      .from(friendLinks)
      .where(eq(friendLinks.state, 'PENDING'))
      .then(([result]) => result.value),
  ])
  const commentPendingCount = siteCommentPendingCount

  return {
    siteCommentPendingCount,
    commentPendingCount,
    friendLinkPendingCount,
    pendingCount: commentPendingCount + friendLinkPendingCount,
  }
}
