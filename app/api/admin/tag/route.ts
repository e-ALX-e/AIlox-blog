import { and, count, desc, eq, like, ne } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogTags, blogToBlogTag } from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import {
  createTagSchema,
  deleteTagQuerySchema,
  getTagsQuerySchema,
  updateTagSchema,
} from './schema'

export const GET = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const queryResult = getTagsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? undefined,
    take: request.nextUrl.searchParams.get('take') ?? undefined,
    skip: request.nextUrl.searchParams.get('skip') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { q, take, skip } = queryResult.data
  const where = q != null && q.length > 0 ? like(blogTags.tagName, `%${q}%`) : undefined

  const blogTotal = await db
    .select({ value: count() })
    .from(blogTags)
    .where(where)
    .then(([result]) => result.value)
  const total = blogTotal
  const blogSkip = Math.min(skip, blogTotal)
  const blogTake = Math.min(take, Math.max(blogTotal - blogSkip, 0))

  const blogTagList =
    blogTake > 0
      ? await db
          .select({
            id: blogTags.id,
            tagName: blogTags.tagName,
            count: count(blogToBlogTag.blogId),
          })
          .from(blogTags)
          .leftJoin(blogToBlogTag, eq(blogToBlogTag.tagId, blogTags.id))
          .where(where)
          .groupBy(blogTags.id, blogTags.tagName)
          .orderBy(desc(blogTags.id))
          .limit(blogTake)
          .offset(blogSkip)
      : []

  return {
    list: blogTagList,
    total,
    take,
    skip,
  }
})

export const POST = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const body = await readJsonBody(request)
  const parseResult = createTagSchema.safeParse(body)

  if (!parseResult.success) {
    throw new BadRequestError('Invalid request body.', { data: parseResult.error.flatten() })
  }

  const { tagName } = parseResult.data

  const existingTag = await db.query.blogTags.findFirst({
    where: eq(blogTags.tagName, tagName),
  })

  if (existingTag != null) {
    throw new BadRequestError('Tag name already exists.', { data: { tagName } })
  }

  const [created] = await db.insert(blogTags).values({ tagName }).returning()

  return {
    message: 'Created.',
    data: created,
  }
})

export const PATCH = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const body = await readJsonBody(request)
  const parseResult = updateTagSchema.safeParse(body)

  if (!parseResult.success) {
    throw new BadRequestError('Invalid request body.', { data: parseResult.error.flatten() })
  }

  const { id, tagName } = parseResult.data

  const existingTag = await db.query.blogTags.findFirst({ where: eq(blogTags.id, id) })

  if (existingTag == null) {
    throw new BadRequestError('Tag not found.', { data: { id } })
  }

  const duplicateTag = await db.query.blogTags.findFirst({
    where: and(eq(blogTags.tagName, tagName), ne(blogTags.id, id)),
  })

  if (duplicateTag != null) {
    throw new BadRequestError('Tag name already exists.', { data: { id, tagName } })
  }

  const [updated] = await db
    .update(blogTags)
    .set({ tagName })
    .where(eq(blogTags.id, id))
    .returning()

  return {
    message: 'Updated.',
    data: updated,
  }
})

export const DELETE = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const queryResult = deleteTagQuerySchema.safeParse({
    id: request.nextUrl.searchParams.get('id') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { id } = queryResult.data

  const existingTag = await db.query.blogTags.findFirst({ where: eq(blogTags.id, id) })

  if (existingTag == null) {
    throw new BadRequestError('Tag not found.', { data: { id } })
  }

  await db.delete(blogTags).where(eq(blogTags.id, id))

  return {
    message: 'Deleted.',
    id,
  }
})
