import 'server-only'

import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/db/instance'
import {
  blogs,
  blogTranslations,
  translationTasks,
} from '@/db/schema'
import {
  translationLanguages,
  type TranslationLanguage,
} from '@/lib/i18n/config'
import { getTranslationModelConfig } from '@/lib/infra/translation/config'
import { syncBlogTranslation } from './sync-blog-translations'

const ACTIVE_TASK_TTL_MS = 3 * 60 * 1000

type QueueWorkerState = {
  promise: Promise<void> | null
  controllers: Map<number, AbortController>
}

const globalQueueState = globalThis as typeof globalThis & {
  __ailoxiTranslationQueueWorker?: QueueWorkerState
}

const queueState =
  globalQueueState.__ailoxiTranslationQueueWorker ??
  (globalQueueState.__ailoxiTranslationQueueWorker = {
    promise: null,
    controllers: new Map(),
  })

async function recoverStaleProcessingTasks() {
  const staleBefore = new Date(Date.now() - ACTIVE_TASK_TTL_MS)

  await db
    .update(translationTasks)
    .set({
      status: 'failed',
      error: '翻译任务执行器超过 3 分钟没有心跳，已判定为中断。可以继续执行。',
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(translationTasks.status, 'processing'),
        lt(translationTasks.updatedAt, staleBefore),
      ),
    )
}

async function ensureTasksForBlogs(blogIds?: number[]) {
  await recoverStaleProcessingTasks()

  const publishedBlogs = await db
    .select({
      id: blogs.id,
      updatedAt: blogs.updatedAt,
    })
    .from(blogs)
    .where(
      blogIds != null && blogIds.length > 0
        ? and(eq(blogs.isPublished, true), inArray(blogs.id, blogIds))
        : eq(blogs.isPublished, true),
    )
    .orderBy(blogs.id)

  if (publishedBlogs.length === 0) {
    return {
      queued: 0,
      alreadyProcessing: 0,
      paused: 0,
      canceled: 0,
      failed: 0,
      upToDate: 0,
      total: 0,
    }
  }

  const ids = publishedBlogs.map(blog => blog.id)
  const [translations, existingTasks] = await Promise.all([
    db
      .select({
        blogId: blogTranslations.blogId,
        language: blogTranslations.language,
        sourceUpdatedAt: blogTranslations.sourceUpdatedAt,
      })
      .from(blogTranslations)
      .where(inArray(blogTranslations.blogId, ids)),
    db
      .select({
        id: translationTasks.id,
        blogId: translationTasks.blogId,
        language: translationTasks.language,
        sourceUpdatedAt: translationTasks.sourceUpdatedAt,
        status: translationTasks.status,
        force: translationTasks.force,
        attempts: translationTasks.attempts,
        updatedAt: translationTasks.updatedAt,
      })
      .from(translationTasks)
      .where(inArray(translationTasks.blogId, ids)),
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
  let paused = 0
  let canceled = 0
  let failed = 0
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

      if (existingTask != null) {
        if (existingTask.status === 'processing') alreadyProcessing += 1
        else if (existingTask.status === 'paused') paused += 1
        else if (existingTask.status === 'canceled') canceled += 1
        else if (existingTask.status === 'failed') failed += 1
        else if (existingTask.status === 'queued') queued += 1
        else {
          await db
            .update(translationTasks)
            .set({
              status: 'queued',
              force: false,
              error: null,
              finishedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(translationTasks.id, existingTask.id))
          queued += 1
        }

        continue
      }

      await db.insert(translationTasks).values({
        blogId: blog.id,
        language,
        sourceUpdatedAt: blog.updatedAt,
        status: 'queued',
        force: false,
        attempts: 0,
        error: null,
        startedAt: null,
        finishedAt: null,
        updatedAt: new Date(),
      })

      queued += 1
    }
  }

  return {
    queued,
    alreadyProcessing,
    paused,
    canceled,
    failed,
    upToDate,
    total: publishedBlogs.length * translationLanguages.length,
  }
}

export async function enqueuePendingTranslationTasks() {
  return await ensureTasksForBlogs()
}

export async function enqueueBlogTranslationTasks(blogId: number) {
  return await ensureTasksForBlogs([blogId])
}

export async function enqueueForcedTranslationTask(
  blogId: number,
  language: TranslationLanguage,
) {
  const blog = await db
    .select({
      id: blogs.id,
      updatedAt: blogs.updatedAt,
    })
    .from(blogs)
    .where(and(eq(blogs.id, blogId), eq(blogs.isPublished, true)))
    .limit(1)
    .then(rows => rows[0])

  if (blog == null) {
    throw new Error('文章不存在或未发布。')
  }

  const existingTask = await db
    .select({
      id: translationTasks.id,
      status: translationTasks.status,
      attempts: translationTasks.attempts,
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

  if (existingTask?.status === 'processing') {
    throw new Error('该文章的这个语言正在翻译，请先等待完成或取消当前任务。')
  }

  const now = new Date()
  const [task] = await db
    .insert(translationTasks)
    .values({
      blogId: blog.id,
      language,
      sourceUpdatedAt: blog.updatedAt,
      status: 'queued',
      force: true,
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
        force: true,
        error: null,
        startedAt: null,
        finishedAt: null,
        updatedAt: now,
      },
    })
    .returning({
      id: translationTasks.id,
      blogId: translationTasks.blogId,
      language: translationTasks.language,
    })

  if (task == null) {
    throw new Error('无法创建重新翻译任务。')
  }

  return task
}

async function claimNextQueuedTask(forcedOnly = false) {
  while (true) {
    const task = await db
      .select({
        id: translationTasks.id,
        blogId: translationTasks.blogId,
        language: translationTasks.language,
        force: translationTasks.force,
      })
      .from(translationTasks)
      .where(
        forcedOnly
          ? and(
              eq(translationTasks.status, 'queued'),
              eq(translationTasks.force, true),
            )
          : eq(translationTasks.status, 'queued'),
      )
      .orderBy(asc(translationTasks.createdAt), asc(translationTasks.id))
      .limit(1)
      .then(rows => rows[0] ?? null)

    if (task == null) return null

    const now = new Date()
    const [claimed] = await db
      .update(translationTasks)
      .set({
        status: 'processing',
        attempts: sql`${translationTasks.attempts} + 1`,
        error: null,
        startedAt: now,
        finishedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(translationTasks.id, task.id),
          eq(translationTasks.status, 'queued'),
        ),
      )
      .returning({
        id: translationTasks.id,
        blogId: translationTasks.blogId,
        language: translationTasks.language,
        force: translationTasks.force,
      })

    if (claimed != null) return claimed
  }
}

async function processQueue() {
  const config = await getTranslationModelConfig()

  if (
    config.apiKey == null ||
    config.baseUrl.trim().length === 0 ||
    config.model.trim().length === 0
  ) {
    return
  }

  while (true) {
    // When automatic translation is disabled, only explicitly forced
    // retranslation jobs are allowed to run.
    const task = await claimNextQueuedTask(!config.enabled)

    if (task == null) return

    const controller = new AbortController()
    queueState.controllers.set(task.id, controller)

    // Do not rely only on the in-memory AbortController map. In production,
    // the admin control request and the queue worker can be handled by
    // different Next.js route runtimes. Poll the persisted task state so a
    // pause/cancel written to PostgreSQL reliably interrupts the active fetch.
    const controlWatcher = setInterval(() => {
      void db
        .select({ status: translationTasks.status })
        .from(translationTasks)
        .where(eq(translationTasks.id, task.id))
        .limit(1)
        .then(rows => {
          const status = rows[0]?.status

          if (
            (status === 'paused' || status === 'canceled') &&
            !controller.signal.aborted
          ) {
            controller.abort(
              new Error(
                status === 'paused'
                  ? 'Translation task paused by administrator.'
                  : 'Translation task canceled by administrator.',
              ),
            )
          }
        })
        .catch(() => undefined)
    }, 1000)

    try {
      await syncBlogTranslation(
        task.blogId,
        task.language as TranslationLanguage,
        {
          taskId: task.id,
          taskAlreadyClaimed: true,
          force: task.force,
          signal: controller.signal,
        },
      )
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('[translation] queued task failed', {
          taskId: task.id,
          blogId: task.blogId,
          language: task.language,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } finally {
      clearInterval(controlWatcher)
      queueState.controllers.delete(task.id)
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

function abortTask(taskId: number, reason: string) {
  const controller = queueState.controllers.get(taskId)

  if (controller != null && !controller.signal.aborted) {
    controller.abort(new Error(reason))
  }
}

function normalizeTaskIds(taskIds: number[]) {
  return [...new Set(taskIds.filter(id => Number.isInteger(id) && id > 0))]
}

export async function pauseTranslationTasks(taskIds: number[]) {
  const ids = normalizeTaskIds(taskIds)
  if (ids.length === 0) return []

  const now = new Date()
  const changed = await db
    .update(translationTasks)
    .set({
      status: 'paused',
      error: null,
      finishedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        inArray(translationTasks.id, ids),
        inArray(translationTasks.status, ['queued', 'processing']),
      ),
    )
    .returning({ id: translationTasks.id })

  for (const task of changed) {
    abortTask(task.id, 'Translation task paused by administrator.')
  }

  return changed.map(task => task.id)
}

export async function resumeTranslationTasks(taskIds: number[]) {
  const ids = normalizeTaskIds(taskIds)
  if (ids.length === 0) return []

  const now = new Date()
  const changed = await db
    .update(translationTasks)
    .set({
      status: 'queued',
      error: null,
      startedAt: null,
      finishedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        inArray(translationTasks.id, ids),
        inArray(translationTasks.status, ['paused', 'failed', 'canceled']),
      ),
    )
    .returning({ id: translationTasks.id })

  return changed.map(task => task.id)
}

export async function cancelTranslationTasks(taskIds: number[]) {
  const ids = normalizeTaskIds(taskIds)
  if (ids.length === 0) return []

  const now = new Date()
  const changed = await db
    .update(translationTasks)
    .set({
      status: 'canceled',
      error: null,
      finishedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        inArray(translationTasks.id, ids),
        inArray(translationTasks.status, [
          'queued',
          'processing',
          'paused',
          'failed',
        ]),
      ),
    )
    .returning({ id: translationTasks.id })

  for (const task of changed) {
    abortTask(task.id, 'Translation task canceled by administrator.')
  }

  return changed.map(task => task.id)
}
