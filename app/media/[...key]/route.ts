import { GetObjectCommand } from '@aws-sdk/client-s3'
import { serverEnv } from '@/config/env/server-env'
import { s3 } from '@/lib/infra/storage/s3'

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      key: string[]
    }>
  },
) {
  const { key } = await params

  if (key.length === 0) {
    return new Response(null, {
      status: 404,
    })
  }

  try {
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: serverEnv.S3_BUCKET,
        Key: key.join('/'),
      }),
    )

    if (object.Body == null) {
      return new Response(null, {
        status: 404,
      })
    }

    const bytes = await object.Body.transformToByteArray()
    const body = Buffer.from(bytes)

    return new Response(body, {
      headers: {
        'Content-Type':
          object.ContentType ?? 'application/octet-stream',

        'Cache-Control':
          object.CacheControl ??
          'public, max-age=31536000, immutable',

        ...(object.ETag != null
          ? {
              ETag: object.ETag,
            }
          : {}),
      },
    })
  } catch {
    return new Response(null, {
      status: 404,
    })
  }
}
