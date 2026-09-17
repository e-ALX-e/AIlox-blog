import { db } from '@/db/instance'
import { siteCommentConfig } from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { isTrustedRequestOrigin, noPermission } from '@/lib/core/auth/guard'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import { updateCommentConfigSchema } from './schema'

const siteCommentConfigId = 1
const defaultSiteCommentConfig = {
  autoApproveEmailUsers: true,
  autoApproveWalletUsers: false,
}

export const POST = withResponse(async request => {
  if (!isTrustedRequestOrigin(request) || (await noPermission())) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const [config] = await db
    .insert(siteCommentConfig)
    .values({
      id: siteCommentConfigId,
      ...defaultSiteCommentConfig,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteCommentConfig.id,
      set: { id: siteCommentConfigId },
    })
    .returning()

  return {
    data: config,
  }
})

export const PATCH = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const body = await readJsonBody(request)
  const parseResult = updateCommentConfigSchema.safeParse(body)

  if (!parseResult.success) {
    throw new BadRequestError('Invalid request body.', { data: parseResult.error.flatten() })
  }

  const payload = parseResult.data

  const [updated] = await db
    .insert(siteCommentConfig)
    .values({
      id: siteCommentConfigId,
      ...payload,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteCommentConfig.id,
      set: {
        ...payload,
        updatedAt: new Date(),
      },
    })
    .returning()

  return {
    message: 'Updated.',
    data: updated,
  }
})
