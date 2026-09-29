import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export const GRANT_TTL_SECONDS = 12 * 60 * 60
const HASH_PATTERN = /^s1:([a-f0-9]{32}):([a-f0-9]{64})$/

export function validArticleCode(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 4 &&
    value.length <= 128 && Buffer.byteLength(value, 'utf8') <= 512
}

function derive(code: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(code, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, result) => error ? reject(error) : resolve(result))
  })
}

export async function hashArticleCode(code: string): Promise<string> {
  if (!validArticleCode(code)) throw new Error('暗号须为 4–128 个字符，且不能全为空格。')
  const salt = randomBytes(16)
  const hash = await derive(code, salt)
  return `s1:${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function verifyArticleCode(code: unknown, stored: string): Promise<boolean> {
  if (!validArticleCode(code)) return false
  const match = HASH_PATTERN.exec(stored)
  if (match == null) return false
  const actual = await derive(code, Buffer.from(match[1], 'hex'))
  return timingSafeEqual(actual, Buffer.from(match[2], 'hex'))
}

function signature(blogId: number, hash: string, expires: number, secret: string) {
  if (secret.length < 32) throw new Error('服务端暗号签名配置无效。')
  return createHmac('sha256', secret)
    .update(`ailoxi:article-access:v1\n${blogId}\n${hash}\n${expires}`)
    .digest('hex')
}

export function signArticleGrant(blogId: number, hash: string, secret: string, now = Date.now()) {
  if (!Number.isSafeInteger(blogId) || blogId <= 0 || !HASH_PATTERN.test(hash)) {
    throw new Error('无效的文章访问配置。')
  }
  const expires = Math.floor(now / 1000) + GRANT_TTL_SECONDS
  return `v1.${expires}.${signature(blogId, hash, expires, secret)}`
}

export function verifyArticleGrant(
  token: string | undefined, blogId: number, hash: string, secret: string, now = Date.now(),
): boolean {
  if (!token || token.length > 100 || !HASH_PATTERN.test(hash)) return false
  const match = /^v1\.(\d{10,12})\.([a-f0-9]{64})$/.exec(token)
  if (match == null) return false
  const expires = Number(match[1])
  const seconds = Math.floor(now / 1000)
  if (expires <= seconds || expires > seconds + GRANT_TTL_SECONDS) return false
  return timingSafeEqual(
    Buffer.from(match[2], 'hex'),
    Buffer.from(signature(blogId, hash, expires, secret), 'hex'),
  )
}
