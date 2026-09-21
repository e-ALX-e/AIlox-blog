import { eq } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import { syncBlogTranslation } from '@/lib/core/translation/sync-blog-translations'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import {
  getPublicTranslationModelConfig,
  getTranslationUsageStats,
  saveTranslationModelConfig,
} from '@/lib/infra/translation/config'
import { syncTranslationSchema, updateTranslationConfigSchema } from './schema'

export const GET = withResponse(async () => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const [config, usage, publishedBlogs] = await Promise.all([
    getPublicTranslationModelConfig(),
    getTranslationUsageStats(),
    db
      .select({ id: blogs.id })
      .from(blogs)
      .where(eq(blogs.isPublished, true))
      .orderBy(blogs.id),
  ])

  return {
    config,
    usage,
    publishedBlogIds: publishedBlogs.map(blog => blog.id),
  }
})

export const PATCH = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const body = await readJsonBody(request)
  const parsed = updateTranslationConfigSchema.safeParse(body)

  if (!parsed.success) {
    throw new BadRequestError('Invalid translation configuration.', {
      data: parsed.error.flatten(),
    })
  }

  const current = await getPublicTranslationModelConfig()

  if (parsed.data.enabled && !current.hasApiKey && !parsed.data.apiKey?.trim()) {
    throw new BadRequestError('启用翻译前必须填写 API Key。')
  }

  await saveTranslationModelConfig(parsed.data)

  return {
    message: 'Saved.',
    config: await getPublicTranslationModelConfig(),
  }
})

export const POST = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const config = await getPublicTranslationModelConfig()

  if (!config.enabled || !config.hasApiKey) {
    throw new BadRequestError('请先配置并启用翻译模型。')
  }

  const body = await readJsonBody(request)
  const parsed = syncTranslationSchema.safeParse(body)

  if (!parsed.success) {
    throw new BadRequestError('Invalid translation job.', {
      data: parsed.error.flatten(),
    })
  }

  const result = await syncBlogTranslation(parsed.data.blogId, parsed.data.language)

  if (!result.attempted || !result.translated) {
    throw new BadRequestError('文章不存在、未发布或翻译模型未启用。')
  }

  return {
    message: 'Translation completed.',
    result,
    usage: await getTranslationUsageStats(),
  }
})
