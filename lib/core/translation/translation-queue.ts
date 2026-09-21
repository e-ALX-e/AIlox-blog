import 'server-only'

import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/instance'
import {
  blogs,
  blogTranslations,
  translationTasks,
} from '@/db/schema'
import { translationLanguages } from '@/lib/i18n/config'
import { syncBlogTranslation } from './sync-blog-translations'

const ACTIVE_TASK_TTL_MS = 3 * 60 * 1000

type QueueWorkerState = {
  promise: Promise<void> | null
}

const globalQueueState = globalThis as typeof globalThis & {
  __ailoxiTranslationQueueWorker?: QueueWorkerState
}

const queueState =
  globalQueueState.__ailoxiTranslationQueueWorker ??
  (globalQueueState.__ailoxiTranslationQueueWorker = { promise: null })

export async function enqueuePendingTranslationTasks() {
  const publishedBlogs = await db
    .select({
      id: blogs.id,
      updatedAt: blogs.updatedAt,
    })
    .from(blogs)
    .where(eq(blogs.isPublished, true))
    .orderBy(blogs.id)

  if (publishedBlogs.length === 0) {
    return {
      queued: 0,
      alreadyProcessing: 0,
      upToDate: 0,
      total: 0,
    }
  }

  const blogIds = publishedBlogs.map(blog => blog.id)
  const [translations, existingTasks] = await Promise.all([
    db
      .select({
        blogId: blogTranslations.blogId,
        language: blogTranslations.language,
        sourceUpdatedAt: blogTranslations.sourceUpdatedAt,
      })
      .from(blogTranslations)
      .where(inArray(blogTranslations.blogId, blogIds)),
    db
      .select({
        id: translationTasks.id,
        blogId: translationTasks.blogId,
        language: translationTasks.language,
        sourceUpdatedAt: translationTasks.sourceUpdatedAt,
        status: translationTasks.status,
        updatedAt: translationTasks.updatedAt,
      })
      .from(translationTasks)
      .where(inArray(translationTasks.blogId, blogIds)),
  ])

  const translationByKey = new Map(
    translations.map(item => [`${item.blogId}:${item.language}`, item]),
  )
  const taskBySourceKey = new Map(
    existingTasks.map(item => [
      `${item.blogId}:${item.language}:${item.sourceUpdatedAt.getTime()}`,
      item,
    ]),
  )

  let queued = 0
  let alreadyProcessing = 0
  let upToDate = 0

  for (const blog of publishedBlogs) {
    for (const language of translationLanguages) {
      const translation = translationByKey.get(`${blog.id}:${language}`)

      if (
        translation != null &&
        translation.sourceUpdatedAt.getTime() >= blog.updatedAt.getTime()
      ) {
        upToDate += 1
        continue
      }

      const taskKey = `${blog.id}:${language}:${blog.updatedAt.getTime()}`
      const existingTask = taskBySourceKey.get(taskKey)
      const processingIsFresh =
        existingTask?.status === 'processing' &&
        Date.now() - existingTask.updatedAt.getTime() < ACTIVE_TASK_TTL_MS

      if (processingIsFresh) {
        alreadyProcessing += 1
        continue
      }

      const now = new Date()

      await db
        .insert(translationTasks)
        .values({
          blogId: blog.id,
          language,
          sourceUpdatedAt: blog.updatedAt,
          status: 'queued',
          attempts: existingTask?.attempts ?? 0,
          error: null,
          startedAt: null,
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
            status: 'queued',
            error: null,
            startedAt: null,
            finishedAt: null,
            updatedAt: now,
          },
        })

      queued += 1
    }
  }

  return {
    queued,
    alreadyProcessing,
    upToDate,
    total: publishedBlogs.length * translationLanguages.length,
  }
}

async function getNextQueuedTask() {
  return await db
    .select({
      id: translationTasks.id,
      blogId: translationTasks.blogId,
      language: translationTasks.language,
    })
    .from(translationTasks)
    .where(eq(translationTasks.status, 'queued'))
    .orderBy(asc(translationTasks.createdAt), asc(translationTasks.id))
    .limit(1)
    .then(rows => rows[0] ?? null)
}

async function processQueue() {
  while (true) {
    const task = await getNextQueuedTask()

    if (task == null) return

    try {
      await syncBlogTranslation(
        task.blogId,
        task.language as (typeof translationLanguages)[number],
      )
    } catch (error) {
      console.error('[translation] queued task failed', {
        taskId: task.id,
        blogId: task.blogId,
        language: task.language,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export function startTranslationQueueWorker() {
  if (queueState.promise != null) {
    return queueState.promise
  }

  queueState.promise = processQueue().finally(() => {
    queueState.promise = null
  })

  return queueState.promise
}

export function isTranslationQueueWorkerRunning() {
  return queueState.promise != null
}
