import { and, eq } from 'drizzle-orm'
import { serverEnv } from '@/config/env/server-env'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { privateJson, readCodeJson, trustedCodeRequest } from '@/lib/core/blog-access/http'
import { readArticleAccess } from '@/lib/core/blog-access/service'
import { parseShareToken, signShareGrant } from '@/lib/core/blog-access/share-crypto'
import { shareCookieName, verifyArticleShare } from '@/lib/core/blog-access/share-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Public redemption, NOT public creation. A URL parameter is never itself authorization.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!trustedCodeRequest(request)) return privateJson({ message: '请求来源无效。' }, 403)
    const body = await readCodeJson(request)
    if (!parseShareToken(body?.token)) return privateJson({ message: '分享链接无效或已失效。' }, 403)
    const { slug } = await params
    const [blog] = await db.select({ id: blogs.id }).from(blogs)
      .where(and(eq(blogs.slug, slug), eq(blogs.isPublished, true))).limit(1)
    if (!blog) return privateJson({ message: '分享链接无效或已失效。' }, 403)
    const access = await readArticleAccess(blog.id)
    if (!access) return privateJson({ message: '分享链接无效或已失效。' }, 403)
    const share = await verifyArticleShare(body?.token, blog.id, access.codeHash)
    if (!share) return privateJson({ message: '分享链接无效或已失效。' }, 403)
    const current = await readArticleAccess(blog.id)
    if (current?.codeHash !== access.codeHash) return privateJson({ message: '分享链接无效或已失效。' }, 403)
    const grant = signShareGrant(share, access.codeHash, serverEnv.BETTER_AUTH_SECRET)
    // Do not mint an ordinary code grant: revoking a share must invalidate its reader sessions.
    const response = privateJson({ unlocked: true })
    response.cookies.set(shareCookieName(blog.id), grant.token, {
      httpOnly: true,
      secure: new URL(serverEnv.SITE_URL).protocol === 'https:',
      sameSite: 'lax', path: '/', maxAge: grant.maxAge,
    })
    return response
  } catch {
    return privateJson({ message: '暂时无法验证分享链接，请稍后重试。' }, 503)
  }
}
