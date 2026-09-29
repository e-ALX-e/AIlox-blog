import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { serverEnv } from '@/config/env/server-env'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { blogAccess, blogUnlockBudget } from '@/db/schema/blog-access'
import { noPermission } from '@/lib/core/auth/guard'
import { hashArticleCode, validArticleCode, verifyArticleCode } from '@/lib/core/blog-access/crypto'
import { privateJson, readCodeJson, trustedCodeRequest } from '@/lib/core/blog-access/http'
import { readArticleAccess } from '@/lib/core/blog-access/service'
import { buildArticleCodeLink } from '@/lib/core/blog-access/share-link'
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
    const access = await readArticleAccess(id)
    return privateJson({ enabled: access != null, adminBypass: access?.adminBypass === true })
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
      typeof body?.enabled !== 'boolean' ||
      (body.adminBypass !== undefined && typeof body.adminBypass !== 'boolean')) {
      return privateJson({ message: '设置内容无效。' }, 400)
    }
    const enabled = body.enabled
    const requestedBypass = body.adminBypass as boolean | undefined
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
      const [existing] = await tx.select().from(blogAccess).where(eq(blogAccess.blogId, id)).limit(1)
      const adminBypass = enabled && (requestedBypass ?? existing?.adminBypass ?? false)
      if (!enabled) {
        await tx.delete(blogAccess).where(eq(blogAccess.blogId, id))
      } else if (hash != null) {
        const settings = { codeHash: hash, adminBypass, updatedAt: new Date() }
        await tx.insert(blogAccess).values({ blogId: id, ...settings })
          .onConflictDoUpdate({ target: blogAccess.blogId, set: settings })
      } else {
        if (!existing) return { status: 400, message: '首次开启时请填写暗号。' }
        // Changing the exemption does not replace the code or its valid reader grants.
        await tx.update(blogAccess).set({ adminBypass, updatedAt: new Date() })
          .where(eq(blogAccess.blogId, id))
      }
      if (!enabled || hash != null) await tx.delete(blogUnlockBudget).where(eq(blogUnlockBudget.blogId, id))
      return { status: 200, message: '暗号设置已保存。', slug: blog.slug, adminBypass }
    })
    if (result.status !== 200) return privateJson({ message: result.message }, result.status)
    for (const language of languages) {
      revalidatePath(`/${language}/blog/${encodeURIComponent(result.slug!)}`)
    }
    return privateJson({ enabled, adminBypass: result.adminBypass === true, message: result.message })
  } catch {
    return privateJson({ message: '无法保存暗号设置，请稍后重试并确认数据库已更新。' }, 503)
  }
}

/** Generate an explicitly requested credential-bearing link, without unlocking this browser. */
export async function POST(request: Request) {
  try {
    if (await noPermission()) return privateJson({ message: '权限不足。' }, 403)
    if (!trustedCodeRequest(request)) return privateJson({ message: '请求来源无效。' }, 403)
    const body = await readCodeJson(request)
    const id = body?.blogId
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || !validArticleCode(body?.code)) {
      return privateJson({ message: '请填写文章编号和已保存的暗号。' }, 400)
    }
    const [blog] = await db.select({ slug: blogs.slug, isPublished: blogs.isPublished }).from(blogs)
      .where(eq(blogs.id, id)).limit(1)
    if (!blog) return privateJson({ message: '文章不存在。' }, 404)
    if (!blog.isPublished) return privateJson({ message: '请先发布文章，再生成分享链接。' }, 400)
    const access = await readArticleAccess(id)
    if (!access) return privateJson({ message: '请先开启并保存文章暗号保护。' }, 400)
    // An administrator's exemption must not skip checking the link's code.
    if (!(await verifyArticleCode(body.code, access.codeHash))) {
      return privateJson({ message: '暗号与当前保存的暗号不一致。' }, 403)
    }
    const current = await readArticleAccess(id)
    if (current?.codeHash !== access.codeHash) return privateJson({ message: '暗号设置已变更，请重试。' }, 409)
    return privateJson({ url: buildArticleCodeLink(serverEnv.SITE_URL, blog.slug, body.code) })
  } catch {
    return privateJson({ message: '暂时无法生成链接，请稍后重试。' }, 503)
  }
}
