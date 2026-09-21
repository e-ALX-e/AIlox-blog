import { after } from 'next/server'
import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import {
  cancelTranslationTasks,
  pauseTranslationTasks,
  resumeTranslationTasks,
  startTranslationQueueWorker,
} from '@/lib/core/translation/translation-queue'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import { translationTaskActionSchema } from '../schema'

export const PATCH = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const body = await readJsonBody(request)
  const parsed = translationTaskActionSchema.safeParse(body)

  if (!parsed.success) {
    throw new BadRequestError('Invalid translation task action.', {
      data: parsed.error.flatten(),
    })
  }

  const { action, taskIds } = parsed.data
  let changedTaskIds: number[]

  if (action === 'pause') {
    changedTaskIds = await pauseTranslationTasks(taskIds)
  } else if (action === 'resume') {
    changedTaskIds = await resumeTranslationTasks(taskIds)

    if (changedTaskIds.length > 0) {
      after(async () => {
        await startTranslationQueueWorker()
      })
    }
  } else {
    changedTaskIds = await cancelTranslationTasks(taskIds)
  }

  return {
    message: 'Translation tasks updated.',
    action,
    changedTaskIds,
  }
})
