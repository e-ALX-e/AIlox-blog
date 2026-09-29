import { and, eq } from 'drizzle-orm'
import { serverEnv } from '@/config/env/server-env'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { GRANT_TTL_SECONDS, signArticleGrant, validArticleCode, verifyArticleCode } from '@/lib/core/blog-access/crypto'
import { privateJson, readCodeJson, trustedCodeRequest } from '@/lib/core/blog-access/http'
import { articleCookieName, readArticleAccess, takeUnlockAttempt } from '@/lib/core/blog-access/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!trustedCodeRequest(request)) return privateJson({ message: '请求来源无效。' }, 403)
    const { slug } = await params
    const [blog] = await db.select({ id: blogs.id, title: blogs.title }).from(blogs)
      .where(and(eq(blogs.slug, slug), eq(blogs.isPublished, true))).limit(1)
    if (!blog) return privateJson({ message: '文章不存在。' }, 404)
    const access = await readArticleAccess(blog.id)
    if (access == null) return privateJson({ unlocked: true })
    const body = await readCodeJson(request)
    if (!validArticleCode(body?.code)) return privateJson({ message: '暗号不正确，请重试。' }, 403)
    if (!(await takeUnlockAttempt(blog.id))) {
      const response = privateJson({ message: '尝试次数较多，请十分钟后再试。' }, 429)
      response.headers.set('Retry-After', '600')
      return response
    }
    if (!(await verifyArticleCode(body.code, access.codeHash))) {
      return privateJson({ message: '暗号不正确，请重试。' }, 403)
    }
    // A code could have been rotated while scrypt was running. Never grant the old version.
    const current = await readArticleAccess(blog.id)
    if (current?.codeHash !== access.codeHash) return privateJson({ message: '暗号设置已变更，请重试。' }, 409)
    const response = privateJson({ unlocked: true })
    response.cookies.set(articleCookieName(blog.id), signArticleGrant(blog.id, access.codeHash, serverEnv.BETTER_AUTH_SECRET), {
      httpOnly: true,
      secure: new URL(serverEnv.SITE_URL).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: GRANT_TTL_SECONDS,
    })
    return response
  } catch {
    return privateJson({ message: '暂时无法验证暗号，请稍后重试。' }, 503)
  }
}
