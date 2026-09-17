import 'server-only'

import type { AdminOverviewStats } from '@/lib/api/admin/get-admin-overview-stats'
import { count } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { getAdminPendingCount } from '../pending-count/get-admin-pending-count'

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const [blogGroups, pendingCount] = await Promise.all([
    db
      .select({
        isPublished: blogs.isPublished,
        count: count(),
      })
      .from(blogs)
      .groupBy(blogs.isPublished),
    getAdminPendingCount(),
  ])

  const blogCount = blogGroups.reduce((total, group) => total + group.count, 0)
  const blogDraftCount = blogGroups.reduce(
    (total, group) => total + (group.isPublished ? 0 : group.count),
    0,
  )

  return {
    blogCount,
    blogDraftCount,
    draftCount: blogDraftCount,
    commentPendingCount: pendingCount.commentPendingCount,
    friendLinkPendingCount: pendingCount.friendLinkPendingCount,
    pendingCount: pendingCount.pendingCount,
  }
}
