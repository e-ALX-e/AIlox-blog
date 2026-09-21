import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs, blogTranslations, translationTasks } from '@/db/schema'
import { BadRequestError } from '@/lib/common/errors/request'
import { noPermission } from '@/lib/core/auth/guard'
import { syncBlogTranslation } from '@/lib/core/translation/sync-blog-translations'
import { translationLanguages } from '@/lib/i18n/config'
import { readJsonBody } from '@/lib/infra/http/read-json-body'
import { withResponse } from '@/lib/infra/http/with-response'
import {
  getPublicTranslationModelConfig,
  getTranslationUsageStats,
  saveTranslationModelConfig,
} from '@/lib/infra/translation/config'
import { syncTranslationSchema, updateTranslationConfigSchema } from './schema'

const ACTIVE_TASK_TTL_MS = 3 * 60 * 1000

function hasPostgresErrorCode(error: unknown, expectedCode: string) {
  let current: unknown = error

  for (let depth = 0; depth < 6 && current != null; depth += 1) {
    if (typeof current !== 'object') return false

    const candidate = current as { code?: unknown; cause?: unknown }

    if (candidate.code === expectedCode) return true
    current = candidate.cause
  }

  return false
}

export const GET = withResponse(async () => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const [config, usage, publishedBlogs] = await Promise.all([
    getPublicTranslationModelConfig(),
    getTranslationUsageStats(),
    db
      .select({
        id: blogs.id,
        title: blogs.title,
        updatedAt: blogs.updatedAt,
      })
      .from(blogs)
      .where(eq(blogs.isPublished, true))
      .orderBy(blogs.id),
  ])

  const blogIds = publishedBlogs.map(blog => blog.id)
  let existingTranslations: Array<{
    blogId: number
    language: string
    sourceUpdatedAt: Date
  }> = []
  let taskRows: Array<{
    id: number
    blogId: number
    language: string
    sourceUpdatedAt: Date
    status: string
    attempts: number
    error: string | null
    startedAt: Date | null
    finishedAt: Date | null
    updatedAt: Date
  }> = []

  if (blogIds.length > 0) {
    try {
      ;[existingTranslations, taskRows] = await Promise.all([
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
            attempts: translationTasks.attempts,
            error: translationTasks.error,
            startedAt: translationTasks.startedAt,
            finishedAt: translationTasks.finishedAt,
            updatedAt: translationTasks.updatedAt,
          })
          .from(translationTasks)
          .where(inArray(translationTasks.blogId, blogIds))
          .orderBy(desc(translationTasks.updatedAt))
          .limit(100),
      ])
    } catch (error) {
      if (hasPostgresErrorCode(error, '42P01')) {
        throw new BadRequestError(
          '翻译任务表尚未创建。请在服务器执行 docker compose --profile tools run --rm db-init，然后重启 app。',
        )
      }

      throw error
    }
  }

  const translationByKey = new Map(
    existingTranslations.map(translation => [
      `${translation.blogId}:${translation.language}`,
      translation,
    ]),
  )
  const blogById = new Map(publishedBlogs.map(blog => [blog.id, blog]))
  const taskByCurrentSourceKey = new Map<string, (typeof taskRows)[number]>()

  for (const task of taskRows) {
    const blog = blogById.get(task.blogId)
    if (blog == null) continue

    if (task.sourceUpdatedAt.getTime() !== blog.updatedAt.getTime()) continue

    const key = `${task.blogId}:${task.language}`
    if (!taskByCurrentSourceKey.has(key)) {
      taskByCurrentSourceKey.set(key, task)
    }
  }

  const pendingJobs = publishedBlogs.flatMap(blog =>
    translationLanguages.flatMap(language => {
      const key = `${blog.id}:${language}`
      const translation = translationByKey.get(key)

      if (
        translation != null &&
        new Date(translation.sourceUpdatedAt).getTime() >= blog.updatedAt.getTime()
      ) {
        return []
      }

      const task = taskByCurrentSourceKey.get(key)
      const processingIsStale =
        task?.status === 'processing' &&
        Date.now() - task.updatedAt.getTime() >= ACTIVE_TASK_TTL_MS
      const status =
        task == null
          ? 'queued'
          : processingIsStale
            ? 'failed'
            : task.status === 'succeeded' || task.status === 'skipped'
              ? 'queued'
              : task.status

      return [
        {
          blogId: blog.id,
          blogTitle: blog.title,
          language,
          status,
          attempts: task?.attempts ?? 0,
          error: processingIsStale
            ? '上一次任务已中断或超时，可以重新同步。'
            : task?.error ?? null,
          updatedAt: task?.updatedAt ?? null,
        },
      ]
    }),
  )

  const totalTranslationSlots = publishedBlogs.length * translationLanguages.length
  const taskSummary = {
    queued: pendingJobs.filter(job => job.status === 'queued').length,
    processing: pendingJobs.filter(job => job.status === 'processing').length,
    failed: pendingJobs.filter(job => job.status === 'failed').length,
    upToDate: totalTranslationSlots - pendingJobs.length,
  }

  const recentTasks = taskRows.slice(0, 30).map(task => ({
    id: task.id,
    blogId: task.blogId,
    blogTitle: blogById.get(task.blogId)?.title ?? `#${task.blogId}`,
    language: task.language,
    status: task.status,
    attempts: task.attempts,
    error: task.error,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    updatedAt: task.updatedAt,
  }))

  return {
    config,
    usage,
    pendingJobs,
    taskSummary,
    recentTasks,
    skippedUpToDateCount: taskSummary.upToDate,
    totalTranslationSlots,
  }
})

export const PATCH = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const body = await readJsonBody(request)
  const parsed = updateTranslationConfigSchema.safeParse(body)

  if (!parsed.success) {
    throw new BadRequestError('Invalid translation configuration.', {
      data: parsed.error.flatten(),
    })
  }

  const current = await getPublicTranslationModelConfig()

  if (parsed.data.enabled && !current.hasApiKey && !parsed.data.apiKey?.trim()) {
    throw new BadRequestError('启用翻译前必须填写 API Key。')
  }

  await saveTranslationModelConfig(parsed.data)

  return {
    message: 'Saved.',
    config: await getPublicTranslationModelConfig(),
  }
})

export const POST = withResponse(async request => {
  if (await noPermission()) {
    throw new BadRequestError('Insufficient permissions.')
  }

  const config = await getPublicTranslationModelConfig()

  if (!config.enabled || !config.hasApiKey) {
    throw new BadRequestError('请先配置并启用翻译模型。')
  }

  const body = await readJsonBody(request)
  const parsed = syncTranslationSchema.safeParse(body)

  if (!parsed.success) {
    throw new BadRequestError('Invalid translation job.', {
      data: parsed.error.flatten(),
    })
  }

  try {
    const result = await syncBlogTranslation(parsed.data.blogId, parsed.data.language)

    if (!result.attempted && !result.translated && !result.skipped && !result.inProgress) {
      throw new BadRequestError('文章不存在、未发布或翻译模型未启用。')
    }

    return {
      message: result.inProgress
        ? 'Translation is already processing.'
        : result.skipped
          ? 'Translation is already up to date.'
          : 'Translation completed.',
      result,
      usage: await getTranslationUsageStats(),
    }
  } catch (error) {
    if (error instanceof BadRequestError) throw error

    const message = error instanceof Error ? error.message : String(error)
    console.error('[translation] job failed', {
      blogId: parsed.data.blogId,
      language: parsed.data.language,
      error: message,
    })

    throw new BadRequestError(
      `模型翻译失败（${parsed.data.language}）：${message}`,
    )
  }
})
