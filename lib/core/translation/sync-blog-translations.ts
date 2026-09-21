import 'server-only'

import type { TranslationLanguage } from '@/lib/i18n/config'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/instance'
import {
  blogs,
  blogTranslations,
  translationTasks,
  translationUsage,
} from '@/db/schema'
import { translationLanguages } from '@/lib/i18n/config'
import { getTranslationModelConfig } from '@/lib/infra/translation/config'
import { translateMarkdown } from '@/lib/infra/translation/openai-compatible'

const ACTIVE_TASK_TTL_MS = 3 * 60 * 1000
const CONTROLLED_STATUSES = new Set(['paused', 'canceled'])

export type BlogTranslationJobResult = {
  attempted: boolean
  translated: boolean
  skipped: boolean
  inProgress: boolean
  controlled: boolean
  language: TranslationLanguage
}

export type BlogTranslationSyncResult = {
  attempted: boolean
  translatedLanguages: string[]
  skippedLanguages: string[]
  inProgressLanguages: string[]
  controlledLanguages: string[]
  failedLanguages: Array<{ language: string; error: string }>
}

type SyncBlogTranslationOptions = {
  signal?: AbortSignal
  taskId?: number
  taskAlreadyClaimed?: boolean
}

async function getTaskStatus(taskId: number) {
  return await db
    .select({ status: translationTasks.status })
    .from(translationTasks)
    .where(eq(translationTasks.id, taskId))
    .limit(1)
    .then(rows => rows[0]?.status ?? null)
}

export async function syncBlogTranslation(
  blogId: number,
  language: TranslationLanguage,
  options: SyncBlogTranslationOptions = {},
): Promise<BlogTranslationJobResult> {
  const config = await getTranslationModelConfig()

  if (!config.enabled || config.apiKey == null) {
    return {
      attempted: false,
      translated: false,
      skipped: false,
      inProgress: false,
      controlled: false,
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
      inProgress: false,
      controlled: false,
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
    existingTranslation.sourceUpdatedAt.getTime() >= blog.updatedAt.getTime()
  ) {
    return {
      attempted: false,
      translated: false,
      skipped: true,
      inProgress: false,
      controlled: false,
      language,
    }
  }

  let taskId = options.taskId

  if (!options.taskAlreadyClaimed) {
    const existingTask = await db
      .select({
        id: translationTasks.id,
        status: translationTasks.status,
        updatedAt: translationTasks.updatedAt,
      })
      .from(translationTasks)
      .where(
        and(
          eq(translationTasks.blogId, blog.id),
          eq(translationTasks.language, language),
          eq(translationTasks.sourceUpdatedAt, blog.updatedAt),
        ),
      )
      .limit(1)
      .then(rows => rows[0])

    if (existingTask != null && CONTROLLED_STATUSES.has(existingTask.status)) {
      return {
        attempted: false,
        translated: false,
        skipped: false,
        inProgress: false,
        controlled: true,
        language,
      }
    }

    if (
      existingTask?.status === 'processing' &&
      Date.now() - existingTask.updatedAt.getTime() < ACTIVE_TASK_TTL_MS
    ) {
      return {
        attempted: false,
        translated: false,
        skipped: false,
        inProgress: true,
        controlled: false,
        language,
      }
    }

    const now = new Date()

    const [task] = await db
      .insert(translationTasks)
      .values({
        blogId: blog.id,
        language,
        sourceUpdatedAt: blog.updatedAt,
        status: 'processing',
        attempts: 1,
        error: null,
        startedAt: now,
        finishedAt: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          translationTasks.blogId,
          translationTasks.language,
          translationTasks.sourceUpdatedAt,
        ],
        set: {
          status: 'processing',
          attempts: sql`${translationTasks.attempts} + 1`,
          error: null,
          startedAt: now,
          finishedAt: null,
          updatedAt: now,
        },
      })
      .returning({ id: translationTasks.id })

    taskId = task?.id
  }

  if (taskId == null) {
    throw new Error('Translation task id is missing.')
  }

  const heartbeat = setInterval(() => {
    void db
      .update(translationTasks)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(translationTasks.id, taskId),
          eq(translationTasks.status, 'processing'),
        ),
      )
      .catch(() => undefined)
  }, 20_000)

  try {
    const translated = await translateMarkdown({
      title: blog.title,
      content: blog.content,
      targetLanguage: language,
      signal: options.signal,
    })

    const statusBeforeSave = await getTaskStatus(taskId)

    if (statusBeforeSave != null && CONTROLLED_STATUSES.has(statusBeforeSave)) {
      return {
        attempted: true,
        translated: false,
        skipped: false,
        inProgress: false,
        controlled: true,
        language,
      }
    }

    const finishedAt = new Date()

    await db.transaction(async transaction => {
      await transaction
        .insert(blogTranslations)
        .values({
          blogId: blog.id,
          language,
          title: translated.title.slice(0, 120),
          content: translated.content,
          sourceUpdatedAt: blog.updatedAt,
          translatedAt: finishedAt,
        })
        .onConflictDoUpdate({
          target: [blogTranslations.blogId, blogTranslations.language],
          set: {
            title: translated.title.slice(0, 120),
            content: translated.content,
            sourceUpdatedAt: blog.updatedAt,
            translatedAt: finishedAt,
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

      await transaction
        .update(translationTasks)
        .set({
          status: 'succeeded',
          error: null,
          finishedAt,
          updatedAt: finishedAt,
        })
        .where(eq(translationTasks.id, taskId))
    })

    return {
      attempted: true,
      translated: true,
      skipped: false,
      inProgress: false,
      controlled: false,
      language,
    }
  } catch (error) {
    const currentStatus = await getTaskStatus(taskId)

    if (currentStatus != null && CONTROLLED_STATUSES.has(currentStatus)) {
      return {
        attempted: true,
        translated: false,
        skipped: false,
        inProgress: false,
        controlled: true,
        language,
      }
    }

    const failedAt = new Date()
    const message = error instanceof Error ? error.message : String(error)

    await db
      .update(translationTasks)
      .set({
        status: 'failed',
        error: message,
        finishedAt: failedAt,
        updatedAt: failedAt,
      })
      .where(eq(translationTasks.id, taskId))

    throw error
  } finally {
    clearInterval(heartbeat)
  }
}

export async function syncBlogTranslations(blogId: number): Promise<BlogTranslationSyncResult> {
  const translatedLanguages: string[] = []
  const skippedLanguages: string[] = []
  const inProgressLanguages: string[] = []
  const controlledLanguages: string[] = []
  const failedLanguages: Array<{ language: string; error: string }> = []
  let attempted = false

  for (const language of translationLanguages) {
    try {
      const result = await syncBlogTranslation(blogId, language)
      attempted ||= result.attempted

      if (result.translated) translatedLanguages.push(language)
      if (result.skipped) skippedLanguages.push(language)
      if (result.inProgress) inProgressLanguages.push(language)
      if (result.controlled) controlledLanguages.push(language)
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
    inProgressLanguages,
    controlledLanguages,
    failedLanguages,
  }
}
