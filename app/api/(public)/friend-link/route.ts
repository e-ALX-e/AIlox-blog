import { count, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/instance'
import { friendLinks } from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { languages } from '@/lib/i18n/config'
import { notifyAdminFriendLinkApplication } from '@/lib/infra/email/notifications'
import { sendEmailInBackground } from '@/lib/infra/email/send-email'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import { createFriendLinkSchema, getPublicFriendLinksQuerySchema } from './schema'

export const GET = withResponse(async request => {
  const queryResult = getPublicFriendLinksQuerySchema.safeParse({
    take: request.nextUrl.searchParams.get('take') ?? undefined,
    skip: request.nextUrl.searchParams.get('skip') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { take, skip } = queryResult.data
  const [list, total] = await Promise.all([
    db
      .select({
        id: friendLinks.id,
        name: friendLinks.name,
        description: friendLinks.description,
        avatarUrl: friendLinks.avatarUrl,
        siteUrl: friendLinks.siteUrl,
        state: friendLinks.state,
        createdAt: friendLinks.createdAt,
        updatedAt: friendLinks.updatedAt,
      })
      .from(friendLinks)
      .where(eq(friendLinks.state, 'APPROVED'))
      .orderBy(desc(friendLinks.updatedAt), desc(friendLinks.id))
      .limit(take)
      .offset(skip),
    db
      .select({ value: count() })
      .from(friendLinks)
      .where(eq(friendLinks.state, 'APPROVED'))
      .then(([result]) => result.value),
  ])

  return {
    list,
    total,
    take,
    skip,
  }
})

export const POST = withResponse(async request => {
  const body = await readJsonBody(request)
  const parseResult = createFriendLinkSchema.safeParse(body)

  if (!parseResult.success) {
    throw new BadRequestError('Invalid request body.', { data: parseResult.error.flatten() })
  }

  const [created] = await db
    .insert(friendLinks)
    .values({
      ...parseResult.data,
      state: 'PENDING',
      updatedAt: new Date(),
    })
    .returning()

  for (const language of languages) {
    revalidatePath(`/${language}/friends`)
  }
  revalidatePath('/admin/friend-link')

  sendEmailInBackground(() =>
    notifyAdminFriendLinkApplication({
      name: created.name,
      email: parseResult.data.email,
      description: created.description,
      siteUrl: created.siteUrl,
      avatarUrl: created.avatarUrl,
    }),
  )

  return {
    message: '友链申请已提交，等待审核。',
    data: created,
  }
})
