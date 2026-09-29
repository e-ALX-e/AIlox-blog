import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

export const SHARE_SESSION_SECONDS = 12 * 60 * 60
export const SHARE_LIFETIMES_HOURS = [1, 24, 168, 720] as const
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}'
const SHARE_PATTERN = new RegExp(String.raw`^as1\.${UUID}\.[A-Za-z0-9_-]{43}$`)
const GRANT_PATTERN = new RegExp(String.raw`^sg1\.(${UUID})\.(\d{10,12})\.([a-f0-9]{64})$`)

export function validShareId(id: unknown): id is string {
  return typeof id === 'string' && new RegExp(`^${UUID}$`).test(id)
}

export function parseShareToken(token: unknown): { id: string } | null {
  if (typeof token !== 'string' || token.length !== 84 || !SHARE_PATTERN.test(token)) return null
  return { id: token.split('.')[1] }
}

export function shareTokenHash(token: string): string {
  return createHash('sha256').update('ailoxi:article-share:token:v1\n').update(token).digest('hex')
}

export function shareAccessVersion(codeHash: string): string {
  return createHash('sha256').update('ailoxi:article-share:code:v1\n').update(codeHash).digest('hex')
}

function equalHash(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(actual) || !/^[a-f0-9]{64}$/.test(expected)) return false
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
}

export function createShareToken() {
  const id = randomUUID()
  const token = `as1.${id}.${randomBytes(32).toString('base64url')}`
  return { id, token, tokenHash: shareTokenHash(token) }
}

export function verifyShareToken(token: unknown, expectedHash: string): boolean {
  return parseShareToken(token) != null && equalHash(shareTokenHash(token as string), expectedHash)
}

export type ShareRecord = {
  id: string
  blogId: number
  tokenHash: string
  accessVersion: string
  expiresAt: Date
  revokedAt: Date | null
}

export function shareStatus(share: ShareRecord, currentCodeHash: string, now = Date.now()) {
  if (share.revokedAt != null) return 'revoked' as const
  if (!equalHash(share.accessVersion, shareAccessVersion(currentCodeHash))) return 'invalidated' as const
  if (!Number.isFinite(share.expiresAt.getTime()) || share.expiresAt.getTime() <= now) return 'expired' as const
  return 'active' as const
}

function grantSignature(blogId: number, id: string, version: string, expires: number, secret: string) {
  if (secret.length < 32) throw new Error('服务端分享签名配置无效。')
  return createHmac('sha256', secret)
    .update(`ailoxi:article-share:grant:v1\n${blogId}\n${id}\n${version}\n${expires}`)
    .digest('hex')
}

// Unlike an ordinary article-code grant, this cookie must also pass a DB revocation check.
export function signShareGrant(share: ShareRecord, codeHash: string, secret: string, now = Date.now()) {
  if (!validShareId(share.id) || !Number.isSafeInteger(share.blogId) || share.blogId <= 0 ||
    shareStatus(share, codeHash, now) !== 'active') throw new Error('分享不可用。')
  const seconds = Math.floor(now / 1000)
  const expires = Math.min(seconds + SHARE_SESSION_SECONDS, Math.floor(share.expiresAt.getTime() / 1000))
  if (expires <= seconds) throw new Error('分享已过期。')
  const signature = grantSignature(share.blogId, share.id, share.accessVersion, expires, secret)
  return { token: `sg1.${share.id}.${expires}.${signature}`, maxAge: expires - seconds }
}

export function readShareGrant(token: string | undefined, blogId: number, codeHash: string,
  secret: string, now = Date.now()): { id: string } | null {
  if (!token || token.length > 128 || !Number.isSafeInteger(blogId) || blogId <= 0) return null
  const match = GRANT_PATTERN.exec(token)
  if (!match) return null
  const expires = Number(match[2])
  const seconds = Math.floor(now / 1000)
  if (expires <= seconds || expires > seconds + SHARE_SESSION_SECONDS) return null
  return equalHash(match[3], grantSignature(blogId, match[1], shareAccessVersion(codeHash), expires, secret))
    ? { id: match[1] } : null
}
