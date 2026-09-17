import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/instance'
import { account, siteCommentConfig, siteComments } from '@/db/schema'
import { getSiteCommentTarget } from '@/lib/api/comment/target'
import { BadRequestError } from '@/lib/common/errors/request'
import { isAdminUser, isWalletSessionUser, requireSignedInUser } from '@/lib/core/auth/guard'
import { commentProcessor } from '@/lib/core/markdown/comment-processor'
import {
  notifyAdminNewSiteComment,
  notifyCommentAuthorReply,
} from '@/lib/infra/email/notifications'
import { sendEmailInBackground } from '@/lib/infra/email/send-email'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import {
  createCommentSchema,
  deleteCommentQuerySchema,
  getPublicCommentsQuerySchema,
} from './schema'

const siteCommentConfigId = 1
const defaultSiteCommentConfig = {
  autoApproveEmailUsers: true,
  autoApproveWalletUsers: false,
}
const deletedCommentText = '已删除'
const commentLoginProviderIds = ['github', 'google']

const publicCommentUserRelation = {
  columns: {
    id: true,
    name: true,
    email: true,
    image: true,
  },
  with: {
    accounts: {
      where: inArray(account.providerId, commentLoginProviderIds),
      columns: {
        providerId: true,
        accountId: true,
      },
    },
  },
} as const

const publicCommentRelations = {
  user: publicCommentUserRelation,
  parent: {
    columns: {
      id: true,
      userId: true,
      authorName: true,
      authorImage: true,
      isDeleted: true,
    },
    with: {
      user: publicCommentUserRelation,
    },
  },
} as const

const getPublicSiteCommentList = (
  targetType: 'BLOG',
  targetId: number,
  take: number,
  skip: number,
) =>
  db.query.siteComments.findMany({
    where: and(
      eq(siteComments.targetType, targetType),
      eq(siteComments.targetId, targetId),
      eq(siteComments.state, 'APPROVED'),
    ),
    with: publicCommentRelations,
    orderBy: desc(siteComments.createdAt),
    limit: take,
    offset: skip,
  })

const serializePublicCommentUser = (
  user: NonNullable<Awaited<ReturnType<typeof getPublicSiteCommentList>>[number]['user']>,
) => ({
  id: user.id,
  name: user.name,
  image: user.image,
  accounts: user.accounts.map(accountRecord => ({
    providerId: accountRecord.providerId,
    accountId: accountRecord.accountId,
  })),
})

const serializePublicCommentParent = (
  comment: NonNullable<Awaited<ReturnType<typeof getPublicSiteCommentList>>[number]['parent']>,
) => {
  return {
    id: comment.id,
    userId: comment.userId,
    isAdmin: isAdminUser(comment.user),
    authorName: comment.authorName,
    authorImage: comment.authorImage,
    isDeleted: comment.isDeleted,
    user: comment.user == null ? null : serializePublicCommentUser(comment.user),
  }
}

const serializePublicComment = async (
  comment: Awaited<ReturnType<typeof getPublicSiteCommentList>>[number],
) => {
  const content = comment.isDeleted ? deletedCommentText : comment.content
  const sanitizedHtmlContent = comment.isDeleted
    ? deletedCommentText
    : String(await commentProcessor.process(content))

  return {
    id: comment.id,
    targetType: comment.targetType,
    targetId: comment.targetId,
    parentId: comment.parentId,
    parent: comment.parent == null ? null : serializePublicCommentParent(comment.parent),
    userId: comment.userId,
    isAdmin: isAdminUser(comment.user),
    authorName: comment.authorName,
    authorImage: comment.authorImage,
    content,
    sanitizedHtmlContent,
    isDeleted: comment.isDeleted,
    state: comment.state,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: comment.user == null ? null : serializePublicCommentUser(comment.user),
  }
}

const getSiteCommentPolicy = async () => {
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
    .returning({
      autoApproveEmailUsers: siteCommentConfig.autoApproveEmailUsers,
      autoApproveWalletUsers: siteCommentConfig.autoApproveWalletUsers,
    })

  return config
}

export const GET = withResponse(async request => {
  const queryResult = getPublicCommentsQuerySchema.safeParse({
    targetType: request.nextUrl.searchParams.get('targetType') ?? undefined,
    targetId: request.nextUrl.searchParams.get('targetId') ?? undefined,
    take: request.nextUrl.searchParams.get('take') ?? undefined,
    skip: request.nextUrl.searchParams.get('skip') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { targetType, targetId, take, skip } = queryResult.data
  const target = await getSiteCommentTarget(targetType, targetId)

  if (target == null || !target.isPublished) {
    return {
      list: [],
      total: 0,
      take,
      skip,
    }
  }

  const [rawList, total] = await Promise.all([
    getPublicSiteCommentList(targetType, targetId, take, skip),
    db
      .select({ value: count() })
      .from(siteComments)
      .where(
        and(
          eq(siteComments.targetType, targetType),
          eq(siteComments.targetId, targetId),
          eq(siteComments.state, 'APPROVED'),
        ),
      )
      .then(([result]) => result.value),
  ])
  const list = await Promise.all(rawList.map(serializePublicComment))

  return {
    list,
    total,
    take,
    skip,
  }
})

export const POST = withResponse(async request => {
  const [user, config, body] = await Promise.all([
    requireSignedInUser(),
    getSiteCommentPolicy(),
    readJsonBody(request),
  ])

  const parseResult = createCommentSchema.safeParse(body)

  if (!parseResult.success) {
    throw new BadRequestError('Invalid request body.', { data: parseResult.error.flatten() })
  }

  const payload = parseResult.data
  const target = await getSiteCommentTarget(payload.targetType, payload.targetId)

  if (target == null || !target.isPublished) {
    throw new BadRequestError('Article not found.')
  }

  const parentComment =
    payload.parentId == null
      ? null
      : await db.query.siteComments.findFirst({
          where: eq(siteComments.id, payload.parentId),
          columns: {
            id: true,
            targetType: true,
            targetId: true,
            authorName: true,
            state: true,
          },
          with: {
            user: publicCommentUserRelation,
          },
        })

  if (payload.parentId != null) {
    if (parentComment == null) {
      throw new BadRequestError('Reply target not found.')
    }

    if (
      parentComment.targetType !== payload.targetType ||
      parentComment.targetId !== payload.targetId
    ) {
      throw new BadRequestError('Reply target does not belong to the current article.')
    }

    if (parentComment.state !== 'APPROVED') {
      throw new BadRequestError('Reply target is not publicly visible.')
    }
  }

  const isWalletUser = isWalletSessionUser(user)
  const autoApproveByPolicy = isWalletUser
    ? config.autoApproveWalletUsers
    : config.autoApproveEmailUsers
  const currentUserIsAdmin = isAdminUser(user)
  const autoApprove = currentUserIsAdmin || autoApproveByPolicy

  const created = await db.transaction(async transaction => {
    const [createdComment] = await transaction
      .insert(siteComments)
      .values({
        targetType: payload.targetType,
        targetId: payload.targetId,
        parentId: payload.parentId ?? null,
        userId: user.id,
        authorName: user.name,
        authorImage: user.image,
        content: payload.content,
        state: autoApprove ? 'APPROVED' : 'PENDING',
        updatedAt: new Date(),
      })
      .returning({ id: siteComments.id })

    const record = await transaction.query.siteComments.findFirst({
      where: eq(siteComments.id, createdComment.id),
      with: publicCommentRelations,
    })

    if (record == null) {
      throw new Error('Created comment could not be loaded.')
    }

    return record
  })

  const shouldNotifyAdmin = !currentUserIsAdmin || payload.parentId == null

  if (shouldNotifyAdmin) {
    sendEmailInBackground(() =>
      notifyAdminNewSiteComment({
        authorName: created.authorName,
        authorEmail: user.email,
        content: created.content,
        targetTitle: target.title,
        targetPath: target.path,
        state: created.state,
      }),
    )
  }

  const parentCommentUser = parentComment?.user
  if (
    created.state === 'APPROVED' &&
    parentComment != null &&
    parentCommentUser != null &&
    !isAdminUser(parentCommentUser) &&
    !isWalletSessionUser(parentCommentUser) &&
    parentCommentUser.id !== user.id
  ) {
    const parentCommentUserEmail = parentCommentUser.email
    const parentCommentAuthorName = parentComment.authorName

    sendEmailInBackground(() =>
      notifyCommentAuthorReply({
        to: parentCommentUserEmail,
        recipientName: parentCommentAuthorName,
        replyAuthorName: created.authorName,
        targetTitle: target.title,
        targetPath: target.path,
        replyContent: created.content,
      }),
    )
  }

  return {
    message: autoApprove ? 'Comment published.' : 'Comment submitted, waiting for approval.',
    data: await serializePublicComment(created),
  }
})

export const DELETE = withResponse(async request => {
  const user = await requireSignedInUser()

  const queryResult = deleteCommentQuerySchema.safeParse({
    id: request.nextUrl.searchParams.get('id') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { id } = queryResult.data
  const existing = await db.query.siteComments.findFirst({
    where: eq(siteComments.id, id),
    columns: {
      id: true,
      userId: true,
    },
  })

  if (existing == null) {
    throw new BadRequestError('Comment not found.', { data: { id } })
  }

  if (existing.userId !== user.id) {
    throw new BadRequestError('只能删除自己的评论。')
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
