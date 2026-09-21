import { after } from 'next/server'
import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import {
  enqueueForcedTranslationTask,
  startTranslationQueueWorker,
} from '@/lib/core/translation/translation-queue'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import { getPublicTranslationModelConfig } from '@/lib/infra/translation/config'
import { retranslateTranslationSchema } from '../schema'

export const POST = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const config = await getPublicTranslationModelConfig()

  if (
    !config.hasApiKey ||
    config.baseUrl.trim().length === 0 ||
    config.model.trim().length === 0
  ) {
    throw new BadRequestError('请先完整配置翻译模型、API Base URL 和 API Key。')
  }

  const body = await readJsonBody(request)
  const parsed = retranslateTranslationSchema.safeParse(body)

  if (!parsed.success) {
    throw new BadRequestError('Invalid retranslation request.', {
      data: parsed.error.flatten(),
    })
  }

  const tasks: Array<{
    id: number
    blogId: number
    language: string
  }> = []
  const failures: Array<{
    blogId: number
    language: string
    error: string
  }> = []

  for (const blogId of [...new Set(parsed.data.blogIds)]) {
    for (const language of [...new Set(parsed.data.languages)]) {
      try {
        const task = await enqueueForcedTranslationTask(blogId, language)
        tasks.push(task)
      } catch (error) {
        failures.push({
          blogId,
          language,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  if (tasks.length > 0) {
    after(async () => {
      await startTranslationQueueWorker()
    })
  }

  return {
    message:
      failures.length === 0
        ? 'Retranslation jobs queued.'
        : 'Retranslation jobs queued with some failures.',
    tasks,
    failures,
  }
})
