import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { blogAccess, blogUnlockBudget } from '@/db/schema/blog-access'
import { noPermission } from '@/lib/core/auth/guard'
import { hashArticleCode, validArticleCode } from '@/lib/core/blog-access/crypto'
import { privateJson, readCodeJson, trustedCodeRequest } from '@/lib/core/blog-access/http'
import { readArticleAccess } from '@/lib/core/blog-access/service'
import { languages } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    if (await noPermission()) return privateJson({ message: '权限不足。' }, 403)
    const id = Number(new URL(request.url).searchParams.get('blogId'))
    if (!Number.isSafeInteger(id) || id <= 0) return privateJson({ message: '文章编号无效。' }, 400)
    const blog = await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.id, id)).limit(1)
    if (!blog[0]) return privateJson({ message: '文章不存在。' }, 404)
    return privateJson({ enabled: (await readArticleAccess(id)) != null })
  } catch {
    return privateJson({ message: '无法读取暗号设置，请确认已更新数据库结构。' }, 503)
  }
}

export async function PATCH(request: Request) {
  try {
    if (await noPermission()) return privateJson({ message: '权限不足。' }, 403)
    if (!trustedCodeRequest(request)) return privateJson({ message: '请求来源无效。' }, 403)
    const body = await readCodeJson(request)
    const id = body?.blogId
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 ||
      typeof body?.enabled !== 'boolean') return privateJson({ message: '设置内容无效。' }, 400)
    const enabled = body.enabled
    const code = body.code
    if (enabled && code !== undefined && code !== '' && !validArticleCode(code)) {
      return privateJson({ message: '暗号须为 4–128 个字符。' }, 400)
    }
    const hash = enabled && typeof code === 'string' && code !== ''
      ? await hashArticleCode(code) : null
    const result = await db.transaction(async tx => {
      // Serialize settings changes for the same article, including removal.
      const [blog] = await tx.select({ id: blogs.id, slug: blogs.slug }).from(blogs)
        .where(eq(blogs.id, id)).for('update').limit(1)
      if (!blog) return { status: 404, message: '文章不存在。' }
      if (!enabled) {
        await tx.delete(blogAccess).where(eq(blogAccess.blogId, id))
      } else if (hash != null) {
        await tx.insert(blogAccess).values({ blogId: id, codeHash: hash, updatedAt: new Date() })
          .onConflictDoUpdate({ target: blogAccess.blogId, set: { codeHash: hash, updatedAt: new Date() } })
      } else {
        const existing = await tx.select({ blogId: blogAccess.blogId }).from(blogAccess)
          .where(eq(blogAccess.blogId, id)).limit(1)
        if (!existing[0]) return { status: 400, message: '首次开启时请填写暗号。' }
      }
      if (!enabled || hash != null) await tx.delete(blogUnlockBudget).where(eq(blogUnlockBudget.blogId, id))
      return { status: 200, message: '暗号设置已保存。', slug: blog.slug }
    })
    if (result.status !== 200) return privateJson({ message: result.message }, result.status)
    for (const language of languages) {
      revalidatePath(`/${language}/blog/${encodeURIComponent(result.slug!)}`)
    }
    return privateJson({ enabled, message: result.message })
  } catch {
    return privateJson({ message: '无法保存暗号设置，请稍后重试并确认数据库已更新。' }, 503)
  }
}
