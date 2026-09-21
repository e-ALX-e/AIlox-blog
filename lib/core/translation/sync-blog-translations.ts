import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs, blogTranslations, translationUsage } from '@/db/schema'
import { translationLanguages } from '@/lib/i18n/config'
import { getTranslationModelConfig } from '@/lib/infra/translation/config'
import { translateMarkdown } from '@/lib/infra/translation/openai-compatible'

export type BlogTranslationSyncResult = {
  attempted: boolean
  translatedLanguages: string[]
  failedLanguages: Array<{ language: string; error: string }>
}

export async function syncBlogTranslations(blogId: number): Promise<BlogTranslationSyncResult> {
  const config = await getTranslationModelConfig()

  if (!config.enabled || config.apiKey == null) {
    return {
      attempted: false,
      translatedLanguages: [],
      failedLanguages: [],
    }
  }

  const blog = await db.query.blogs.findFirst({
    where: and(eq(blogs.id, blogId), eq(blogs.isPublished, true)),
  })

  if (blog == null) {
    return {
      attempted: false,
      translatedLanguages: [],
      failedLanguages: [],
    }
  }

  const results = await Promise.allSettled(
    translationLanguages.map(async language => {
      const translated = await translateMarkdown({
        title: blog.title,
        content: blog.content,
        targetLanguage: language,
      })

      await db.transaction(async transaction => {
        await transaction
          .insert(blogTranslations)
          .values({
            blogId: blog.id,
            language,
            title: translated.title.slice(0, 120),
            content: translated.content,
            sourceUpdatedAt: blog.updatedAt,
            translatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [blogTranslations.blogId, blogTranslations.language],
            set: {
              title: translated.title.slice(0, 120),
              content: translated.content,
              sourceUpdatedAt: blog.updatedAt,
              translatedAt: new Date(),
            },
          })

        await transaction.insert(translationUsage).values({
          blogId: blog.id,
          language,
          model: translated.model,
          promptTokens: translated.usage.promptTokens,
          completionTokens: translated.usage.completionTokens,
          totalTokens: translated.usage.totalTokens,
        })
      })

      return language
    }),
  )

  const translatedLanguages: string[] = []
  const failedLanguages: Array<{ language: string; error: string }> = []

  results.forEach((result, index) => {
    const language = translationLanguages[index]

    if (result.status === 'fulfilled') {
      translatedLanguages.push(language)
      return
    }

    failedLanguages.push({
      language,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    })
  })

  return {
    attempted: true,
    translatedLanguages,
    failedLanguages,
  }
}

export async function syncAllPublishedBlogTranslations() {
  const publishedBlogs = await db
    .select({ id: blogs.id })
    .from(blogs)
    .where(eq(blogs.isPublished, true))

  const results = []

  for (const blog of publishedBlogs) {
    results.push({
      blogId: blog.id,
      result: await syncBlogTranslations(blog.id),
    })
  }

  return results
}
