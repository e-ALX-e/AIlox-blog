import 'server-only'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { serverEnv } from '@/config/env/server-env'
import { canReadArticle } from './service'

export function privateJson(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' },
  })
}

export function trustedCodeRequest(request: Request): boolean {
  return request.headers.get('origin') === new URL(serverEnv.SITE_URL).origin &&
    request.headers.get('content-type')?.split(';')[0].trim() === 'application/json'
}

/** Limit bytes while reading, rather than trusting Content-Length. */
export async function readCodeJson(request: Request): Promise<Record<string, unknown> | null> {
  if (request.body == null) return null
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 4096) {
        void reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return value != null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : null
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

/** Comments can quote article text, so public reads/writes use the same gate. */
export function withArticleCommentAccess(
  handler: (request: NextRequest) => Promise<NextResponse>,
) {
  return async (request: NextRequest) => {
    try {
      let target: Record<string, unknown> | null
      if (request.method === 'GET') {
        target = { targetType: request.nextUrl.searchParams.get('targetType'), targetId: request.nextUrl.searchParams.get('targetId') }
      } else {
        target = await readCodeJson(request.clone())
        if (target == null) return privateJson({ message: '请求内容无效或过长。' }, 400)
      }
      const id = Number(target?.targetId)
      if (target?.targetType === 'BLOG' && Number.isSafeInteger(id) && id > 0 &&
        !(await canReadArticle(id))) {
        return privateJson({ message: '请先输入文章暗号。', requiresAccessCode: true }, 403)
      }
      const response = await handler(request)
      response.headers.set('Cache-Control', 'private, no-store, max-age=0')
      response.headers.set('Vary', 'Cookie')
      return response
    } catch {
      return privateJson({ message: '暂时无法读取评论，请稍后重试。' }, 503)
    }
  }
}
