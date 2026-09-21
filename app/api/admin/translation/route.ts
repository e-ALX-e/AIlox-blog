import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import { syncAllPublishedBlogTranslations } from '@/lib/core/translation/sync-blog-translations'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import {
  getPublicTranslationModelConfig,
  getTranslationUsageStats,
  saveTranslationModelConfig,
} from '@/lib/infra/translation/config'
import { updateTranslationConfigSchema } from './schema'

export const GET = withResponse(async () => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const [config, usage] = await Promise.all([
    getPublicTranslationModelConfig(),
    getTranslationUsageStats(),
  ])

  return {
    config,
    usage,
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

export const POST = withResponse(async () => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const config = await getPublicTranslationModelConfig()

  if (!config.enabled || !config.hasApiKey) {
    throw new BadRequestError('请先配置并启用翻译模型。')
  }

  const results = await syncAllPublishedBlogTranslations()
  const failures = results.flatMap(({ blogId, result }) =>
    result.failedLanguages.map(failure => ({
      blogId,
      language: failure.language,
      error: failure.error,
    })),
  )
  const translatedCount = results.reduce(
    (total, item) => total + item.result.translatedLanguages.length,
    0,
  )

  if (failures.length > 0) {
    console.error(
      '[translation] sync completed with failures:',
      failures.map(item => ({
        blogId: item.blogId,
        language: item.language,
        error: item.error,
      })),
    )
  }

  return {
    message:
      failures.length === 0
        ? 'Translation sync completed.'
        : `Translation sync completed with ${failures.length} failure(s).`,
    results,
    failures,
    translatedCount,
    usage: await getTranslationUsageStats(),
  }
})
