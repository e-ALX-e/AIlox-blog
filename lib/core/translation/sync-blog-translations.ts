import 'server-only'

import type { TranslationLanguage } from '@/lib/i18n/config'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs, blogTranslations, translationUsage } from '@/db/schema'
import { translationLanguages } from '@/lib/i18n/config'
import { getTranslationModelConfig } from '@/lib/infra/translation/config'
import { translateMarkdown } from '@/lib/infra/translation/openai-compatible'

export type BlogTranslationJobResult = {
  attempted: boolean
  translated: boolean
  skipped: boolean
  language: TranslationLanguage
}

export type BlogTranslationSyncResult = {
  attempted: boolean
  translatedLanguages: string[]
  skippedLanguages: string[]
  failedLanguages: Array<{ language: string; error: string }>
}

export async function syncBlogTranslation(
  blogId: number,
  language: TranslationLanguage,
): Promise<BlogTranslationJobResult> {
  const config = await getTranslationModelConfig()

  if (!config.enabled || config.apiKey == null) {
    return {
      attempted: false,
      translated: false,
      skipped: false,
      language,
    }
  }

  const blog = await db.query.blogs.findFirst({
    where: and(eq(blogs.id, blogId), eq(blogs.isPublished, true)),
  })

  if (blog == null) {
    return {
      attempted: false,
      translated: false,
      skipped: false,
      language,
    }
  }

  const existingTranslation = await db
    .select({
      sourceUpdatedAt: blogTranslations.sourceUpdatedAt,
    })
    .from(blogTranslations)
    .where(
      and(
        eq(blogTranslations.blogId, blog.id),
        eq(blogTranslations.language, language),
      ),
    )
    .limit(1)
    .then(rows => rows[0])

  if (
    existingTranslation != null &&
    new Date(existingTranslation.sourceUpdatedAt).getTime() >= blog.updatedAt.getTime()
  ) {
    return {
      attempted: false,
      translated: false,
      skipped: true,
      language,
    }
  }

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

  return {
    attempted: true,
    translated: true,
    skipped: false,
    language,
  }
}

export async function syncBlogTranslations(blogId: number): Promise<BlogTranslationSyncResult> {
  const translatedLanguages: string[] = []
  const skippedLanguages: string[] = []
  const failedLanguages: Array<{ language: string; error: string }> = []
  let attempted = false

  // Run languages sequentially. Some compatible providers are unstable when
  // several long Markdown completions share one connection/account at once.
  for (const language of translationLanguages) {
    try {
      const result = await syncBlogTranslation(blogId, language)
      attempted ||= result.attempted

      if (result.translated) {
        translatedLanguages.push(language)
      }

      if (result.skipped) {
        skippedLanguages.push(language)
      }
    } catch (error) {
      attempted = true
      failedLanguages.push({
        language,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    attempted,
    translatedLanguages,
    skippedLanguages,
    failedLanguages,
  }
}
