import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { serverEnv } from '@/config/env/server-env'
import { noPermission } from '@/lib/core/auth/guard'
import { s3 } from '@/lib/infra/storage/s3'

const MAX_IMAGE_SIZE = 4 * 1024 * 1024

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

const extensionByType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

export async function POST(request: Request) {
  if (await noPermission()) {
    return NextResponse.json(
      {
        message: '权限不足',
      },
      {
        status: 403,
      },
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        message: '没有收到图片',
      },
      {
        status: 400,
      },
    )
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json(
      {
        message: '不支持的图片格式',
      },
      {
        status: 400,
      },
    )
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      {
        message: '图片不能超过 4MB',
      },
      {
        status: 413,
      },
    )
  }

  const extension = extensionByType[file.type]

  const now = new Date()

  const key = [
    'blog',
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    `${randomUUID()}.${extension}`,
  ].join('/')

  const bytes = Buffer.from(await file.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: serverEnv.S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return NextResponse.json({
    key,
    url: `/media/${key}`,
  })
}
