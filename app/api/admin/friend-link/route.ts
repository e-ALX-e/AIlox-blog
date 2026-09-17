import { and, count, desc, eq, like, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/instance'
import { friendLinks } from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import { languages } from '@/lib/i18n/config'
import {
  notifyAdminFriendLinkApproved,
  notifyFriendLinkApproved,
} from '@/lib/infra/email/notifications'
import { sendEmailInBackground } from '@/lib/infra/email/send-email'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import {
  deleteFriendLinkQuerySchema,
  getAdminFriendLinksQuerySchema,
  updateFriendLinkSchema,
} from './schema'

export const GET = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const queryResult = getAdminFriendLinksQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? undefined,
    state: request.nextUrl.searchParams.get('state') ?? undefined,
    take: request.nextUrl.searchParams.get('take') ?? undefined,
    skip: request.nextUrl.searchParams.get('skip') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { q, state, take, skip } = queryResult.data
  const where = and(
    q != null && q.length > 0
      ? or(
          like(friendLinks.name, `%${q}%`),
          like(friendLinks.description, `%${q}%`),
          like(friendLinks.email, `%${q}%`),
          like(friendLinks.siteUrl, `%${q}%`),
        )
      : undefined,
    state != null ? eq(friendLinks.state, state) : undefined,
  )

  const [list, total] = await Promise.all([
    db
      .select()
      .from(friendLinks)
      .where(where)
      .orderBy(desc(friendLinks.createdAt))
      .limit(take)
      .offset(skip),
    db
      .select({ value: count() })
      .from(friendLinks)
      .where(where)
      .then(([result]) => result.value),
  ])

  return {
    list,
    total,
    take,
    skip,
  }
})

export const PATCH = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const body = await readJsonBody(request)
  const parseResult = updateFriendLinkSchema.safeParse(body)

  if (!parseResult.success) {
    throw new BadRequestError('Invalid request body.', { data: parseResult.error.flatten() })
  }

  const payload = parseResult.data
  const existing = await db.query.friendLinks.findFirst({
    where: eq(friendLinks.id, payload.id),
  })

  if (existing == null) {
    throw new BadRequestError('Friend link not found.', { data: { id: payload.id } })
  }

  const [updated] = await db
    .update(friendLinks)
    .set({
      ...(payload.name != null ? { name: payload.name } : {}),
      ...(payload.email !== undefined ? { email: payload.email } : {}),
      ...(payload.description != null ? { description: payload.description } : {}),
      ...(payload.avatarUrl != null ? { avatarUrl: payload.avatarUrl } : {}),
      ...(payload.siteUrl != null ? { siteUrl: payload.siteUrl } : {}),
      ...(payload.state != null ? { state: payload.state } : {}),
      updatedAt: new Date(),
    })
    .where(eq(friendLinks.id, payload.id))
    .returning()

  for (const language of languages) {
    revalidatePath(`/${language}/friends`)
  }
  revalidatePath('/admin/friend-link')

  if (existing.state !== 'APPROVED' && updated.state === 'APPROVED') {
    const approvedFriendLinkEmail = updated.email

    if (approvedFriendLinkEmail != null) {
      sendEmailInBackground(() =>
        notifyFriendLinkApproved({
          to: approvedFriendLinkEmail,
          name: updated.name,
          siteUrl: updated.siteUrl,
        }),
      )
    }

    sendEmailInBackground(() =>
      notifyAdminFriendLinkApproved({
        name: updated.name,
        email: updated.email ?? '未填写',
        siteUrl: updated.siteUrl,
      }),
    )
  }

  return {
    message: 'Updated.',
    data: updated,
  }
})

export const DELETE = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const queryResult = deleteFriendLinkQuerySchema.safeParse({
    id: request.nextUrl.searchParams.get('id') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { id } = queryResult.data
  const existing = await db.query.friendLinks.findFirst({
    where: eq(friendLinks.id, id),
  })

  if (existing == null) {
    throw new BadRequestError('Friend link not found.', { data: { id } })
  }

  await db.delete(friendLinks).where(eq(friendLinks.id, id))

  for (const language of languages) {
    revalidatePath(`/${language}/friends`)
  }
  revalidatePath('/admin/friend-link')

  return {
    message: 'Deleted.',
    id,
  }
})
