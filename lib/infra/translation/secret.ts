import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { serverEnv } from '@/config/env/server-env'

const VERSION = 'v1'

function getKey() {
  return createHash('sha256').update(serverEnv.BETTER_AUTH_SECRET).digest()
}

export function encryptTranslationSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

export function decryptTranslationSecret(value: string) {
  const [version, ivValue, authTagValue, encryptedValue] = value.split(':')

  if (
    version !== VERSION ||
    ivValue == null ||
    authTagValue == null ||
    encryptedValue == null
  ) {
    throw new Error('Unsupported encrypted translation secret format.')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivValue, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
