import type { SQL } from 'drizzle-orm'
import { and, count, countDistinct, desc, eq, inArray, like, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/instance'
import { blogs, blogTags, blogToBlogTag, siteComments } from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import { languages } from '@/lib/i18n/config'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import {
  createBlogSchema,
  deleteBlogQuerySchema,
  getBlogsQuerySchema,
  updateBlogSchema,
} from './schema'

function parseTagNames(rawTagNames: string | undefined) {
  if (rawTagNames == null || rawTagNames.length === 0) {
    return []
  }

  return rawTagNames.split(',').reduce<string[]>((acc, value) => {
    const tagName = value.trim()
    if (tagName.length > 0) {
      acc.push(tagName)
    }
    return acc
  }, [])
}

function revalidateBlogPaths(...slugs: Array<string | undefined>) {
  revalidatePath('/admin/blog')

  const uniqueSlugs = new Set<string>()

  for (const slug of slugs) {
    const normalizedSlug = slug?.trim()
    if (normalizedSlug != null && normalizedSlug.length > 0) {
      uniqueSlugs.add(normalizedSlug)
    }
  }

  for (const language of languages) {
    revalidatePath(`/${language}/blog`)

    for (const slug of uniqueSlugs) {
      revalidatePath(`/${language}/blog/${encodeURIComponent(slug)}`)
    }
  }
}

export const GET = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const queryResult = getBlogsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? undefined,
    tagNames: request.nextUrl.searchParams.get('tagNames') ?? undefined,
    take: request.nextUrl.searchParams.get('take') ?? undefined,
    skip: request.nextUrl.searchParams.get('skip') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { q, tagNames: rawTagNames, take, skip } = queryResult.data
  const tagNames = [...new Set(parseTagNames(rawTagNames))]
  const conditions: SQL[] = []

  if (q != null && q.length > 0) {
    conditions.push(like(blogs.title, `%${q}%`))
  }

  if (tagNames.length > 0) {
    const matchingBlogIds = db
      .select({ blogId: blogToBlogTag.blogId })
      .from(blogToBlogTag)
      .innerJoin(blogTags, eq(blogTags.id, blogToBlogTag.tagId))
      .where(inArray(blogTags.tagName, tagNames))
      .groupBy(blogToBlogTag.blogId)
      .having(eq(countDistinct(blogTags.tagName), tagNames.length))

    conditions.push(inArray(blogs.id, matchingBlogIds))
  }

  const where = and(...conditions)

  const [list, total] = await Promise.all([
    db.query.blogs
      .findMany({
        where,
        columns: {
          id: true,
          slug: true,
          title: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          tagLinks: {
            columns: {},
            with: {
              tag: true,
            },
          },
        },
        orderBy: desc(blogs.createdAt),
        limit: take,
        offset: skip,
      })
      .then(records =>
        records.map(({ tagLinks, ...blog }) => ({
          ...blog,
          tags: tagLinks.map(link => link.tag),
        })),
      ),
    db
      .select({ value: count() })
      .from(blogs)
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

export const POST = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const body = await readJsonBody(request)
  const parseResult = createBlogSchema.safeParse(body)

  if (!parseResult.success) {
    throw new BadRequestError('Invalid request body.', { data: parseResult.error.flatten() })
  }

  const payload = parseResult.data
  const existingBlog = await db.query.blogs.findFirst({
    where: eq(blogs.slug, payload.slug),
  })

  if (existingBlog != null) {
    throw new BadRequestError('该 slug 已存在', { data: { slug: payload.slug } })
  }

  const relatedTags =
    payload.relatedTagNames.length === 0
      ? []
      : await db
          .select({ id: blogTags.id, tagName: blogTags.tagName })
          .from(blogTags)
          .where(inArray(blogTags.tagName, payload.relatedTagNames))

  if (relatedTags.length > 3) {
    throw new BadRequestError('标签数量超过 3 个限制', {
      data: { relatedTagNames: payload.relatedTagNames },
    })
  }

  const created = await db.transaction(async transaction => {
    const [createdBlog] = await transaction
      .insert(blogs)
      .values({
        title: payload.title,
        slug: payload.slug,
        isPublished: payload.isPublished,
        content: payload.content,
        updatedAt: new Date(),
      })
      .returning()

    if (relatedTags.length > 0) {
      await transaction.insert(blogToBlogTag).values(
        relatedTags.map(tag => ({
          blogId: createdBlog.id,
          tagId: tag.id,
        })),
      )
    }

    return {
      ...createdBlog,
      tags: relatedTags,
    }
  })

  revalidateBlogPaths(created.slug)

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
  const parseResult = updateBlogSchema.safeParse(body)

  if (!parseResult.success) {
    throw new BadRequestError('Invalid request body.', { data: parseResult.error.flatten() })
  }

  const { id, title, slug, isPublished, relatedTagNames, content } = parseResult.data
  const existingBlog = await db.query.blogs.findFirst({
    where: eq(blogs.id, id),
  })

  if (existingBlog == null) {
    throw new BadRequestError('Blog 不存在', { data: { id } })
  }

  if (slug != null) {
    const duplicatedSlugBlog = await db.query.blogs.findFirst({
      where: and(eq(blogs.slug, slug), ne(blogs.id, id)),
    })

    if (duplicatedSlugBlog != null) {
      throw new BadRequestError('该 slug 已存在', { data: { id, slug } })
    }
  }

  let relatedTags: Array<{ id: number; tagName: string }> | undefined

  if (relatedTagNames != null) {
    relatedTags =
      relatedTagNames.length === 0
        ? []
        : await db
            .select({ id: blogTags.id, tagName: blogTags.tagName })
            .from(blogTags)
            .where(inArray(blogTags.tagName, relatedTagNames))

    if (relatedTags.length > 3) {
      throw new BadRequestError('标签数量超过 3 个限制', { data: { relatedTagNames } })
    }
  }

  const updated = await db.transaction(async transaction => {
    const [updatedBlog] = await transaction
      .update(blogs)
      .set({
        ...(title != null ? { title } : {}),
        ...(slug != null ? { slug } : {}),
        ...(isPublished != null ? { isPublished } : {}),
        ...(content != null ? { content } : {}),
        updatedAt: new Date(),
      })
      .where(eq(blogs.id, id))
      .returning()

    let updatedTags: Array<{ id: number; tagName: string }>

    if (relatedTags == null) {
      updatedTags = await transaction
        .select({ id: blogTags.id, tagName: blogTags.tagName })
        .from(blogToBlogTag)
        .innerJoin(blogTags, eq(blogTags.id, blogToBlogTag.tagId))
        .where(eq(blogToBlogTag.blogId, id))
    } else {
      await transaction.delete(blogToBlogTag).where(eq(blogToBlogTag.blogId, id))

      if (relatedTags.length > 0) {
        await transaction.insert(blogToBlogTag).values(
          relatedTags.map(tag => ({
            blogId: id,
            tagId: tag.id,
          })),
        )
      }

      updatedTags = relatedTags
    }

    return {
      ...updatedBlog,
      tags: updatedTags,
    }
  })

  revalidateBlogPaths(existingBlog.slug, updated.slug)

  return {
    message: 'Updated.',
    data: updated,
  }
})

export const DELETE = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const queryResult = deleteBlogQuerySchema.safeParse({
    id: request.nextUrl.searchParams.get('id') ?? undefined,
  })

  if (!queryResult.success) {
    throw new BadRequestError('Invalid query parameters.', { data: queryResult.error.flatten() })
  }

  const { id } = queryResult.data
  const existingBlog = await db.query.blogs.findFirst({
    where: eq(blogs.id, id),
  })

  if (existingBlog == null) {
    throw new BadRequestError('Blog 不存在', { data: { id } })
  }

  await db.transaction(async transaction => {
    await transaction
      .delete(siteComments)
      .where(and(eq(siteComments.targetType, 'BLOG'), eq(siteComments.targetId, id)))
    await transaction.delete(blogs).where(eq(blogs.id, id))
  })

  revalidateBlogPaths(existingBlog.slug)

  return {
    message: 'Deleted.',
    id,
  }
})
