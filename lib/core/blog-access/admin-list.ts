import 'server-only'

import { and, count, desc, eq, ilike, isNotNull, isNull, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { blogAccess } from '@/db/schema/blog-access'
import { noPermission } from '@/lib/core/auth/guard'
import { accessListPageSize, accessSearchPattern, type AccessListQuery } from './admin-navigation'

export async function getAdminAccessList(query: AccessListQuery) {
  // Check here as well as in the admin layout: a parent layout is not an API/data boundary.
  if (await noPermission()) redirect('/zh')
  const condition = and(
    query.q ? or(ilike(blogs.title, accessSearchPattern(query.q)), ilike(blogs.slug, accessSearchPattern(query.q))) : undefined,
    query.filter === 'protected' ? isNotNull(blogAccess.blogId) : undefined,
    query.filter === 'public' ? and(eq(blogs.isPublished, true), isNull(blogAccess.blogId)) : undefined,
    query.filter === 'draft' ? eq(blogs.isPublished, false) : undefined,
  )
  const [result] = await db.select({ total: count() }).from(blogs)
    .leftJoin(blogAccess, eq(blogAccess.blogId, blogs.id)).where(condition)
  const total = Number(result?.total ?? 0)
  const pages = Math.max(1, Math.ceil(total / accessListPageSize))
  const page = Math.min(query.page, pages)
  // Never select article bodies, code hashes or share tokens for this list.
  const articles = await db.select({
    id: blogs.id, title: blogs.title, slug: blogs.slug, isPublished: blogs.isPublished,
    protectedId: blogAccess.blogId, adminBypass: blogAccess.adminBypass,
  }).from(blogs).leftJoin(blogAccess, eq(blogAccess.blogId, blogs.id))
    .where(condition).orderBy(desc(blogs.updatedAt), desc(blogs.id))
    .limit(accessListPageSize).offset((page - 1) * accessListPageSize)
  return { articles, total, page, pages }
}
