import { after } from 'next/server'
import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import {
  enqueuePendingTranslationTasks,
  startTranslationQueueWorker,
} from '@/lib/core/translation/translation-queue'
import { withResponse } from '@/lib/infra/http/with-response'
import { getPublicTranslationModelConfig } from '@/lib/infra/translation/config'

export const POST = withResponse(async () => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const config = await getPublicTranslationModelConfig()

  if (!config.enabled || !config.hasApiKey) {
    throw new BadRequestError('请先配置并启用翻译模型。')
  }

  const queue = await enqueuePendingTranslationTasks()

  after(async () => {
    await startTranslationQueueWorker()
  })

  return {
    message: 'Translation queue started.',
    queue,
  }
})
