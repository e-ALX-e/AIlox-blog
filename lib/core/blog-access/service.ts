import 'server-only'

import { eq, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { serverEnv } from '@/config/env/server-env'
import { db } from '@/db/instance'
import { blogAccess, blogUnlockBudget } from '@/db/schema/blog-access'
import { noPermission } from '@/lib/core/auth/guard'
import { verifyArticleGrant } from './crypto'

export const articleCookieName = (blogId: number) => `ailoxi-article-${blogId}`

export async function readArticleAccess(blogId: number) {
  return db.select().from(blogAccess).where(eq(blogAccess.blogId, blogId))
    .limit(1).then(rows => rows[0] ?? null)
}

export async function canReadArticle(blogId: number): Promise<boolean> {
  const access = await readArticleAccess(blogId)
  if (access == null) return true
  // This affects public article/JSON/comment reads only, not the admin editor.
  if (access.adminBypass === true && !(await noPermission())) return true
  const jar = await cookies()
  if (verifyArticleGrant(jar.get(articleCookieName(blogId))?.value, blogId,
    access.codeHash, serverEnv.BETTER_AUTH_SECRET)) return true
  const shareToken = jar.get(`ailoxi-share-${blogId}`)?.value
  if (!shareToken?.startsWith('sg1.')) return false
  // Load share storage only for share sessions, not every ordinary article read.
  const { canReadSharedArticle } = await import('./share-service')
  return canReadSharedArticle(shareToken, blogId, access.codeHash)
}

export async function takeUnlockAttempt(blogId: number): Promise<boolean> {
  // SQL current_timestamp is shared across application processes/replicas.
  const now = sql`current_timestamp`
  const next = sql`current_timestamp + interval '10 minutes'`
  const [accepted] = await db.insert(blogUnlockBudget)
    .values({ blogId, attempts: 1, resetsAt: next })
    .onConflictDoUpdate({
      target: blogUnlockBudget.blogId,
      set: {
        attempts: sql`case when ${blogUnlockBudget.resetsAt} <= ${now} then 1 else ${blogUnlockBudget.attempts} + 1 end`,
        resetsAt: sql`case when ${blogUnlockBudget.resetsAt} <= ${now} then ${next} else ${blogUnlockBudget.resetsAt} end`,
      },
      setWhere: sql`${blogUnlockBudget.resetsAt} <= ${now} or ${blogUnlockBudget.attempts} < 30`,
    })
    .returning({ blogId: blogUnlockBudget.blogId })
  return accepted != null
}
