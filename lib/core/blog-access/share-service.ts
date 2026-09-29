import 'server-only'

import { and, eq } from 'drizzle-orm'
import { serverEnv } from '@/config/env/server-env'
import { db } from '@/db/instance'
import { blogShares } from '@/db/schema/blog-share'
import { parseShareToken, readShareGrant, shareStatus, verifyShareToken } from './share-crypto'

export const shareCookieName = (blogId: number) => `ailoxi-share-${blogId}`

async function readShare(id: string, blogId: number) {
  const [share] = await db.select().from(blogShares)
    .where(and(eq(blogShares.id, id), eq(blogShares.blogId, blogId))).limit(1)
  return share ?? null
}

export async function verifyArticleShare(token: unknown, blogId: number, codeHash: string) {
  const parsed = parseShareToken(token)
  if (!parsed) return null
  const share = await readShare(parsed.id, blogId)
  if (!share || shareStatus(share, codeHash) !== 'active' || !verifyShareToken(token, share.tokenHash)) return null
  return share
}

export async function canReadSharedArticle(token: string | undefined, blogId: number, codeHash: string) {
  // Reject fabricated cookies before querying the database.
  const grant = readShareGrant(token, blogId, codeHash, serverEnv.BETTER_AUTH_SECRET)
  if (!grant) return false
  const share = await readShare(grant.id, blogId)
  // This is checked on EVERY protected page/API/comment request, even after redemption.
  return share != null && shareStatus(share, codeHash) === 'active'
}
