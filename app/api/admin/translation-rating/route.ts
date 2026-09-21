import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/instance'
import {
  blogs,
  blogTranslations,
  translationRatings,
} from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import { translationLanguages } from '@/lib/i18n/config'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import { updateTranslationRatingSchema } from './schema'

export const GET = withResponse(async () => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const publishedBlogs = await db
    .select({
      id: blogs.id,
      title: blogs.title,
    })
    .from(blogs)
    .where(eq(blogs.isPublished, true))
    .orderBy(asc(blogs.id))

  const blogIds = publishedBlogs.map(blog => blog.id)

  if (blogIds.length === 0) {
    return {
      blogs: [],
      languages: translationLanguages,
      availableTranslations: [],
      ratings: [],
    }
  }

  const [translations, ratings] = await Promise.all([
    db
      .select({
        blogId: blogTranslations.blogId,
        language: blogTranslations.language,
      })
      .from(blogTranslations)
      .where(inArray(blogTranslations.blogId, blogIds)),
    db
      .select({
        blogId: translationRatings.blogId,
        language: translationRatings.language,
        score: translationRatings.score,
        updatedAt: translationRatings.updatedAt,
      })
      .from(translationRatings)
      .where(inArray(translationRatings.blogId, blogIds)),
  ])

  return {
    blogs: publishedBlogs,
    languages: translationLanguages,
    availableTranslations: translations,
    ratings,
  }
})

export const PATCH = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const body = await readJsonBody(request)
  const parsed = updateTranslationRatingSchema.safeParse(body)

  if (!parsed.success) {
    throw new BadRequestError('Invalid translation rating.', {
      data: parsed.error.flatten(),
    })
  }

  const { blogId, language, score } = parsed.data

  const translationExists = await db
    .select({ blogId: blogTranslations.blogId })
    .from(blogTranslations)
    .where(
      and(
        eq(blogTranslations.blogId, blogId),
        eq(blogTranslations.language, language),
      ),
    )
    .limit(1)
    .then(rows => rows[0] != null)

  if (!translationExists) {
    throw new BadRequestError('该博客当前没有这个语言的译文，无法评分。')
  }

  if (score == null) {
    await db
      .delete(translationRatings)
      .where(
        and(
          eq(translationRatings.blogId, blogId),
          eq(translationRatings.language, language),
        ),
      )

    return {
      message: 'Translation rating cleared.',
      rating: null,
    }
  }

  const now = new Date()
  const [rating] = await db
    .insert(translationRatings)
    .values({
      blogId,
      language,
      score,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        translationRatings.blogId,
        translationRatings.language,
      ],
      set: {
        score,
        updatedAt: now,
      },
    })
    .returning({
      blogId: translationRatings.blogId,
      language: translationRatings.language,
      score: translationRatings.score,
      updatedAt: translationRatings.updatedAt,
    })

  return {
    message: 'Translation rating saved.',
    rating,
  }
})
