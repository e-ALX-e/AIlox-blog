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

  if (!config.enabled || !config.hasApiKey) {
    throw new BadRequestError('请先配置并启用翻译模型。')
  }

  const body = await readJsonBody(request)
  const parsed = retranslateTranslationSchema.safeParse(body)

  if (!parsed.success) {
    throw new BadRequestError('Invalid retranslation request.', {
      data: parsed.error.flatten(),
    })
  }

  try {
    const task = await enqueueForcedTranslationTask(
      parsed.data.blogId,
      parsed.data.language,
    )

    after(async () => {
      await startTranslationQueueWorker()
    })

    return {
      message: 'Retranslation queued.',
      task,
    }
  } catch (error) {
    throw new BadRequestError(
      error instanceof Error ? error.message : '无法创建重新翻译任务。',
    )
  }
})
