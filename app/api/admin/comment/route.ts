import { and, count, desc, eq, like } from 'drizzle-orm'
import { db } from '@/db/instance'
import { siteComments } from '@/db/schema'
import {
  getSiteCommentTarget,
  getSiteCommentTargetKey,
  getSiteCommentTargetMap,
} from '@/lib/api/comment/target'
import { BadRequestError } from '@/lib/common/errors/request'
import { isAdminUser, isWalletSessionUser, noPermission } from '@/lib/core/auth/guard'
import { notifyCommentAuthorReply } from '@/lib/infra/email/notifications'
import { sendEmailInBackground } from '@/lib/infra/email/send-email'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import {
  deleteCommentQuerySchema,
  getAdminCommentsQuerySchema,
  updateCommentSchema,
} from './schema'

const adminCommentUserRelation = {
  columns: {
    id: true,
    name: true,
    email: true,
    image: true,
  },
} as const

const adminCommentRelations = {
  user: adminCommentUserRelation,
  parent: {
    columns: {
      id: true,
      userId: true,
      authorName: true,
      authorImage: true,
      isDeleted: true,
    },
    with: {
      user: adminCommentUserRelation,
    },
  },
} as const

const getAdminSiteCommentList = (where: ReturnType<typeof and>, take: number, skip: number) =>
  db.query.siteComments.findMany({
    where,
    with: adminCommentRelations,
    orderBy: desc(siteComments.createdAt),
    limit: take,
    offset: skip,
  })

const serializeAdminCommentParent = (
  comment: NonNullable<Awaited<ReturnType<typeof getAdminSiteCommentList>>[number]['parent']>,
) => ({
  id: comment.id,
  userId: comment.userId,
  isAdmin: isAdminUser(comment.user),
  authorName: comment.authorName,
  authorImage: comment.authorImage,
  isDeleted: comment.isDeleted,
  user:
    comment.user == null
      ? null
      : {
          id: comment.user.id,
          name: comment.user.name,
          image: comment.user.image,
        },
})

export const GET = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const queryResult = getAdminCommentsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? undefined,
    targetType: request.nextUrl.searchParams.get('targetType') ?? undefined,
    targetId: request.nextUrl.searchParams.get('targetId') ?? undefined,
    state: request.nextUrl.searchParams.get('state') ?? undefined,
    isDeleted: request.nextUrl.searchParams.get('isDeleted') ?? undefined,
    take: request.nextUrl.searchParams.get('take') ?? undefined,
    skip: request.nextUrl.searchParams.get('skip') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { q, targetType, targetId, state, isDeleted, take, skip } = queryResult.data
  const where = and(
    eq(siteComments.targetType, 'BLOG'),
    q != null && q.length > 0 ? like(siteComments.content, `%${q}%`) : undefined,
    targetType != null ? eq(siteComments.targetType, targetType) : undefined,
    targetId != null ? eq(siteComments.targetId, targetId) : undefined,
    state != null ? eq(siteComments.state, state) : undefined,
    isDeleted != null ? eq(siteComments.isDeleted, isDeleted) : undefined,
  )

  const [rawList, total] = await Promise.all([
    getAdminSiteCommentList(where, take, skip),
    db
      .select({ value: count() })
      .from(siteComments)
      .where(where)
      .then(([result]) => result.value),
  ])
  const targetMap = await getSiteCommentTargetMap(rawList)
  const list = rawList.map(comment => ({
    ...comment,
    parent: comment.parent == null ? null : serializeAdminCommentParent(comment.parent),
    target: targetMap.get(getSiteCommentTargetKey(comment.targetType, comment.targetId)) ?? null,
  }))

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
  const parseResult = updateCommentSchema.safeParse(body)

  if (!parseResult.success) {
    throw new BadRequestError('Invalid request body.', { data: parseResult.error.flatten() })
  }

  const payload = parseResult.data
  const existing = await db.query.siteComments.findFirst({
    where: eq(siteComments.id, payload.id),
  })

  if (existing == null) {
    throw new BadRequestError('Comment not found.', { data: { id: payload.id } })
  }

  if ('isDeleted' in payload) {
    const [updated] = await db
      .update(siteComments)
      .set({
        isDeleted: payload.isDeleted,
        updatedAt: new Date(),
      })
      .where(eq(siteComments.id, payload.id))
      .returning()

    return {
      message: 'Updated.',
      data: updated,
    }
  }

  const [updated] = await db
    .update(siteComments)
    .set({
      state: payload.state,
      updatedAt: new Date(),
    })
    .where(eq(siteComments.id, payload.id))
    .returning()

  if (existing.state !== 'APPROVED' && updated.state === 'APPROVED' && updated.parentId != null) {
    const approvedReply = await db.query.siteComments.findFirst({
      where: eq(siteComments.id, updated.id),
      columns: {
        content: true,
        authorName: true,
        userId: true,
        targetType: true,
        targetId: true,
      },
      with: {
        parent: {
          columns: {
            authorName: true,
          },
          with: {
            user: adminCommentUserRelation,
          },
        },
      },
    })
    const target = await getSiteCommentTarget(updated.targetType, updated.targetId)
    const approvedReplyParent = approvedReply?.parent
    const parentCommentUser = approvedReplyParent?.user

    if (
      target != null &&
      target.isPublished &&
      approvedReply != null &&
      approvedReplyParent != null &&
      parentCommentUser != null &&
      !isAdminUser(parentCommentUser) &&
      !isWalletSessionUser(parentCommentUser) &&
      parentCommentUser.id !== approvedReply.userId
    ) {
      sendEmailInBackground(() =>
        notifyCommentAuthorReply({
          to: parentCommentUser.email,
          recipientName: approvedReplyParent.authorName,
          replyAuthorName: approvedReply.authorName,
          targetTitle: target.title,
          targetPath: target.path,
          replyContent: approvedReply.content,
        }),
      )
    }
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

  const queryResult = deleteCommentQuerySchema.safeParse({
    id: request.nextUrl.searchParams.get('id') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { id } = queryResult.data
  const existing = await db.query.siteComments.findFirst({
    where: eq(siteComments.id, id),
  })

  if (existing == null) {
    throw new BadRequestError('Comment not found.', { data: { id } })
  }

  await db
    .update(siteComments)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(eq(siteComments.id, id))

  return {
    message: 'Deleted.',
    id,
  }
})
