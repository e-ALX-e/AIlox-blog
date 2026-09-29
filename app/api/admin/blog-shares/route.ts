import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { serverEnv } from '@/config/env/server-env'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { blogAccess } from '@/db/schema/blog-access'
import { blogShares } from '@/db/schema/blog-share'
import { noPermission, requireSignedInUser } from '@/lib/core/auth/guard'
import { privateJson, readCodeJson, trustedCodeRequest } from '@/lib/core/blog-access/http'
import { createShareToken, SHARE_LIFETIMES_HOURS, shareAccessVersion, shareStatus, validShareId } from '@/lib/core/blog-access/share-crypto'
import { buildArticleShareLink } from '@/lib/core/blog-access/share-link'
import { languages, type Language } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const validBlogId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

function shareDTO(share: typeof blogShares.$inferSelect, codeHash: string) {
  // No token, token hash, code version, code hash, or article body in listings.
  return { id: share.id, note: share.note, createdAt: share.createdAt,
    expiresAt: share.expiresAt, revokedAt: share.revokedAt, status: shareStatus(share, codeHash) }
}

export async function GET(request: Request) {
  try {
    if (await noPermission()) return privateJson({ message: '仅管理员可以管理分享。' }, 403)
    const blogId = Number(new URL(request.url).searchParams.get('blogId'))
    if (!validBlogId(blogId)) return privateJson({ message: '文章编号无效。' }, 400)
    const [blog] = await db.select({ id: blogs.id, isPublished: blogs.isPublished }).from(blogs)
      .where(eq(blogs.id, blogId)).limit(1)
    if (!blog) return privateJson({ message: '文章不存在。' }, 404)
    const [access] = await db.select().from(blogAccess).where(eq(blogAccess.blogId, blogId)).limit(1)
    const shares = await db.select().from(blogShares).where(eq(blogShares.blogId, blogId))
      .orderBy(desc(blogShares.createdAt))
    return privateJson({ enabled: access != null, isPublished: blog.isPublished,
      shares: shares.map(share => shareDTO(share, access?.codeHash ?? '')) })
  } catch {
    return privateJson({ message: '无法读取分享，请确认已更新数据库结构。' }, 503)
  }
}

export async function POST(request: Request) {
  try {
    if (await noPermission()) return privateJson({ message: '仅管理员可以创建分享。' }, 403)
    if (!trustedCodeRequest(request)) return privateJson({ message: '请求来源无效。' }, 403)
    const body = await readCodeJson(request)
    const blogId = body?.blogId
    const hours = body?.expiresInHours ?? 168
    const note = body?.note ?? ''
    const language = body?.language ?? 'zh'
    if (!validBlogId(blogId) || typeof hours !== 'number' ||
      !SHARE_LIFETIMES_HOURS.some(value => value === hours) || typeof note !== 'string' ||
      note.length > 80 || typeof language !== 'string' || !languages.some(value => value === language)) {
      return privateJson({ message: '请检查文章、有效期、语言和备注（最多 80 字）。' }, 400)
    }
    const user = await requireSignedInUser()
    const credential = createShareToken()
    const result = await db.transaction(async tx => {
      // Same lock order as article access settings: prevents create/rotate/disable races.
      const [blog] = await tx.select({ id: blogs.id, slug: blogs.slug, isPublished: blogs.isPublished })
        .from(blogs).where(eq(blogs.id, blogId)).for('update').limit(1)
      if (!blog) return { ok: false as const, status: 404, message: '文章不存在。' }
      if (!blog.isPublished) return { ok: false as const, status: 400, message: '请先发布文章再创建分享。' }
      const [access] = await tx.select().from(blogAccess).where(eq(blogAccess.blogId, blogId)).limit(1)
      if (!access) return { ok: false as const, status: 400, message: '请先开启并保存暗号保护；公开文章可直接分享普通链接。' }
      const [count] = await tx.select({ value: sql<number>`count(*)::int` }).from(blogShares)
        .where(and(eq(blogShares.blogId, blogId), isNull(blogShares.revokedAt),
          gt(blogShares.expiresAt, new Date()), eq(blogShares.accessVersion, shareAccessVersion(access.codeHash))))
      if (Number(count?.value ?? 0) >= 50) return { ok: false as const, status: 409, message: '有效分享已达 50 条，请先撤销不再使用的分享。' }
      const [share] = await tx.insert(blogShares).values({
        id: credential.id, blogId, tokenHash: credential.tokenHash,
        accessVersion: shareAccessVersion(access.codeHash), note: note.trim(), createdBy: user.id,
        expiresAt: new Date(Date.now() + hours * 3600 * 1000),
      }).returning()
      return { ok: true as const, share: shareDTO(share, access.codeHash), slug: blog.slug }
    })
    if (!result.ok) return privateJson({ message: result.message }, result.status)
    // The complete capability is returned once, only to the authenticated creator.
    return privateJson({ share: result.share,
      url: buildArticleShareLink(serverEnv.SITE_URL, result.slug, credential.token, language as Language) }, 201)
  } catch {
    return privateJson({ message: '暂时无法创建分享，请刷新列表检查后再试。' }, 503)
  }
}

export async function DELETE(request: Request) {
  try {
    if (await noPermission()) return privateJson({ message: '仅管理员可以撤销分享。' }, 403)
    if (!trustedCodeRequest(request)) return privateJson({ message: '请求来源无效。' }, 403)
    const body = await readCodeJson(request)
    if (!validBlogId(body?.blogId) || !validShareId(body?.id)) return privateJson({ message: '分享编号无效。' }, 400)
    const [share] = await db.update(blogShares).set({ revokedAt: new Date() })
      .where(and(eq(blogShares.id, body.id), eq(blogShares.blogId, body.blogId))).returning({ id: blogShares.id })
    if (!share) return privateJson({ message: '分享不存在。' }, 404)
    return privateJson({ id: share.id, revoked: true })
  } catch {
    return privateJson({ message: '暂时无法撤销分享，请稍后重试。' }, 503)
  }
}
