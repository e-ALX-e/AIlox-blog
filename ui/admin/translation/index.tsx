'use client'

import {
  Eye,
  EyeOff,
  Loader2,
  Pause,
  Play,
  RefreshCcw,
  Save,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { sileo } from 'sileo'
import {
  controlTranslationTasks,
  getTranslationAdminState,
  retranslateBlogLanguages,
  runTranslationQueue,
  type TranslationAdminState,
  type TranslationJob,
  updateTranslationConfig,
} from '@/lib/api/translation/admin'
import {
  languageDisplayName,
  translationLanguages,
  type TranslationLanguage,
} from '@/lib/i18n/config'
import { cn } from '@/lib/utils/common/shadcn'
import { Button } from '@/ui/shadcn/button'
import { Input } from '@/ui/shadcn/input'
import { Label } from '@/ui/shadcn/label'
import { Switch } from '@/ui/shadcn/switch'

const emptyUsage: TranslationAdminState['usage'] = {
  calls: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  byLanguage: [],
}

const emptyTaskSummary: TranslationAdminState['taskSummary'] = {
  queued: 0,
  processing: 0,
  paused: 0,
  failed: 0,
  canceled: 0,
  upToDate: 0,
}

const taskStatusText: Record<string, string> = {
  queued: '待执行',
  processing: '处理中',
  paused: '已暂停',
  failed: '失败',
  canceled: '已取消',
  succeeded: '成功',
  skipped: '已跳过',
}

const taskStatusClassName: Record<string, string> = {
  queued: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  processing: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  paused: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  failed: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300',
  canceled: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  succeeded: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
  skipped: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
}

function formatTaskTime(value: Date | string | null) {
  if (value == null) return '-'

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function canPause(job: TranslationJob) {
  return job.status === 'queued' || job.status === 'processing'
}

function canResume(job: TranslationJob) {
  return job.status === 'paused' || job.status === 'failed' || job.status === 'canceled'
}

function canCancel(job: TranslationJob) {
  return (
    job.status === 'queued' ||
    job.status === 'processing' ||
    job.status === 'paused' ||
    job.status === 'failed'
  )
}

export function AdminTranslationPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isControlling, setIsControlling] = useState(false)
  const [isRetranslating, setIsRetranslating] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [showBaseUrl, setShowBaseUrl] = useState(false)
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [usage, setUsage] = useState(emptyUsage)
  const [pendingJobs, setPendingJobs] = useState<TranslationJob[]>([])
  const [taskSummary, setTaskSummary] = useState(emptyTaskSummary)
  const [recentTasks, setRecentTasks] = useState<TranslationAdminState['recentTasks']>([])
  const [publishedBlogs, setPublishedBlogs] = useState<TranslationAdminState['publishedBlogs']>([])
  const [selectedBlogIds, setSelectedBlogIds] = useState<Set<number>>(new Set())
  const [selectedLanguages, setSelectedLanguages] = useState<Set<TranslationLanguage>>(
    new Set(['en']),
  )
  const [queueWorkerRunning, setQueueWorkerRunning] = useState(false)
  const [skippedUpToDateCount, setSkippedUpToDateCount] = useState(0)
  const [totalTranslationSlots, setTotalTranslationSlots] = useState(0)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())

  const queuedJobs = pendingJobs.filter(job => job.status === 'queued')
  const selectedJobs = pendingJobs.filter(job => selectedTaskIds.has(job.taskId))
  const allSelected =
    pendingJobs.length > 0 && selectedTaskIds.size === pendingJobs.length

  const applyState = (data: TranslationAdminState) => {
    setEnabled(data.config.enabled)
    setBaseUrl(data.config.baseUrl)
    setModel(data.config.model)
    setHasApiKey(data.config.hasApiKey)
    setUsage(data.usage)
    setPendingJobs(data.pendingJobs)
    setTaskSummary(data.taskSummary)
    setRecentTasks(data.recentTasks)
    setPublishedBlogs(data.publishedBlogs)
    setSelectedBlogIds(previous => {
      if (previous.size > 0) {
        const availableIds = new Set(data.publishedBlogs.map(blog => blog.id))
        return new Set([...previous].filter(id => availableIds.has(id)))
      }

      return data.publishedBlogs[0] != null
        ? new Set([data.publishedBlogs[0].id])
        : new Set()
    })
    setQueueWorkerRunning(data.queueWorkerRunning)
    setSkippedUpToDateCount(data.skippedUpToDateCount)
    setTotalTranslationSlots(data.totalTranslationSlots)

    const availableIds = new Set(data.pendingJobs.map(job => job.taskId))
    setSelectedTaskIds(previous => {
      const next = new Set([...previous].filter(id => availableIds.has(id)))
      return next
    })
  }

  const loadState = async () => {
    const data = await getTranslationAdminState()
    applyState(data)
    return data
  }

  useEffect(() => {
    let active = true

    void getTranslationAdminState()
      .then(data => {
        if (active) applyState(data)
      })
      .catch(error => {
        sileo.error({ title: error instanceof Error ? error.message : '加载模型配置失败' })
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    const timer = window.setInterval(() => {
      if (!active) return

      void getTranslationAdminState()
        .then(data => {
          if (active) applyState(data)
        })
        .catch(() => undefined)
    }, 3000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const saveConfig = async () => {
    setIsSaving(true)

    try {
      const response = await updateTranslationConfig({
        enabled,
        baseUrl,
        model,
        ...(apiKey.trim().length > 0 ? { apiKey: apiKey.trim() } : {}),
      })

      setHasApiKey(response.config.hasApiKey)
      setApiKey('')
      sileo.success({ title: '模型配置已保存' })
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : '保存失败' })
    } finally {
      setIsSaving(false)
    }
  }

  const startQueue = async () => {
    if (queuedJobs.length === 0) {
      sileo.info({ title: '当前没有待执行任务' })
      return
    }

    setIsStarting(true)

    try {
      const response = await runTranslationQueue()
      await loadState()
      sileo.success({
        title: '翻译队列已启动',
        description: `待执行 ${response.queue.queued} 个；后台会串行处理。`,
      })
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : '启动翻译队列失败',
      })
    } finally {
      setIsStarting(false)
    }
  }

  const controlTasks = async (
    action: 'pause' | 'resume' | 'cancel',
    taskIds: number[],
  ) => {
    if (taskIds.length === 0) return

    setIsControlling(true)

    try {
      const response = await controlTranslationTasks({ action, taskIds })
      await loadState()

      const actionLabel =
        action === 'pause' ? '暂停' : action === 'resume' ? '继续' : '取消'

      sileo.success({
        title: `已${actionLabel} ${response.changedTaskIds.length} 个任务`,
      })
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : '任务操作失败',
      })
    } finally {
      setIsControlling(false)
    }
  }

  const toggleRetranslateBlog = (blogId: number) => {
    setSelectedBlogIds(previous => {
      const next = new Set(previous)

      if (next.has(blogId)) next.delete(blogId)
      else next.add(blogId)

      return next
    })
  }

  const toggleRetranslateLanguage = (language: TranslationLanguage) => {
    setSelectedLanguages(previous => {
      const next = new Set(previous)

      if (next.has(language)) next.delete(language)
      else next.add(language)

      return next
    })
  }

  const retranslateSelected = async () => {
    const blogIds = [...selectedBlogIds]
    const languages = [...selectedLanguages]

    if (blogIds.length === 0) {
      sileo.info({ title: '请至少选择一篇博客' })
      return
    }

    if (languages.length === 0) {
      sileo.info({ title: '请至少选择一种目标语言' })
      return
    }

    setIsRetranslating(true)

    try {
      const response = await retranslateBlogLanguages({
        blogIds,
        languages,
      })
      await loadState()

      sileo.success({
        title: '已加入重新翻译队列',
        description:
          response.failures.length === 0
            ? `已创建 ${response.tasks.length} 个重新翻译任务`
            : `成功 ${response.tasks.length} 个，失败 ${response.failures.length} 个`,
      })
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : '重新翻译任务创建失败',
      })
    } finally {
      setIsRetranslating(false)
    }
  }

  const toggleTask = (taskId: number) => {
    setSelectedTaskIds(previous => {
      const next = new Set(previous)

      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)

      return next
    })
  }

  const toggleAll = () => {
    setSelectedTaskIds(
      allSelected ? new Set() : new Set(pendingJobs.map(job => job.taskId)),
    )
  }

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  const progressPercent =
    totalTranslationSlots > 0
      ? Math.min(100, Math.round((taskSummary.upToDate / totalTranslationSlots) * 100))
      : 100

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-4 pb-12">
      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-semibold text-xl">AI 翻译模型</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              支持 OpenAI Compatible 的第三方模型接口。API Key 会加密后保存到数据库，后台不会回显明文。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="translation-enabled">自动翻译</Label>
            <Switch
              id="translation-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="translation-base-url">API Base URL</Label>
            <div className="relative">
              <Input
                id="translation-base-url"
                type={showBaseUrl ? 'text' : 'password'}
                value={baseUrl}
                onChange={event => setBaseUrl(event.target.value)}
                placeholder="https://api.deepseek.com/v1"
                className="pr-10"
              />
              <button
                type="button"
                aria-label={showBaseUrl ? '隐藏 API Base URL' : '显示 API Base URL'}
                aria-pressed={showBaseUrl}
                onClick={() => setShowBaseUrl(value => !value)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showBaseUrl ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
            <p className="text-muted-foreground text-xs">
              例如 DeepSeek、OpenAI、OpenRouter、硅基流动等兼容 Chat Completions 的地址。
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="translation-model">模型名称</Label>
            <Input
              id="translation-model"
              value={model}
              onChange={event => setModel(event.target.value)}
              placeholder="deepseek-chat"
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="translation-api-key">API Key</Label>
            <Input
              id="translation-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder={hasApiKey ? '已保存 API Key；留空则保持不变' : '请输入 API Key'}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void saveConfig()} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            保存模型配置
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void startQueue()}
            disabled={
              isStarting ||
              !enabled ||
              !hasApiKey ||
              queueWorkerRunning ||
              taskSummary.processing > 0 ||
              queuedJobs.length === 0
            }
          >
            {isStarting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {queueWorkerRunning || taskSummary.processing > 0
              ? `后台运行中 · 待执行 ${taskSummary.queued}`
              : queuedJobs.length > 0
                ? `启动待执行队列（${queuedJobs.length}）`
                : '当前无待执行任务'}
          </Button>
        </div>

        <div className="mt-3 text-muted-foreground text-xs">
          共 {totalTranslationSlots} 个语言版本 · 已是最新 {taskSummary.upToDate} ·
          待执行 {taskSummary.queued} · 处理中 {taskSummary.processing} ·
          已暂停 {taskSummary.paused} · 失败 {taskSummary.failed} · 已取消 {taskSummary.canceled}
        </div>

        {queueWorkerRunning || taskSummary.processing > 0 ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-muted-foreground text-xs">
              <span>服务器后台串行翻译中，可以离开页面；任务可随时暂停或取消</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="mb-4">
          <h2 className="font-semibold text-lg">指定语言重新翻译</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            以简体中文博客原文作为唯一基准，支持博客和目标语言多选/全选。中文原文中已有的英文技术词、产品名、缩写等默认保持英文，只有确有必要时才翻译。
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-background/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label>博客</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelectedBlogIds(new Set(publishedBlogs.map(blog => blog.id)))
                  }
                  disabled={publishedBlogs.length === 0}
                >
                  全选
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedBlogIds(new Set())}
                  disabled={selectedBlogIds.size === 0}
                >
                  清空
                </Button>
              </div>
            </div>

            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {publishedBlogs.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground text-sm">
                  暂无已发布博客
                </p>
              ) : (
                publishedBlogs.map(blog => (
                  <label
                    key={blog.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBlogIds.has(blog.id)}
                      onChange={() => toggleRetranslateBlog(blog.id)}
                      className="mt-0.5 size-4 accent-black dark:accent-white"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm" title={blog.title}>
                      #{blog.id} {blog.title}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-background/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label>目标语言</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelectedLanguages(new Set(translationLanguages))
                  }
                >
                  全选
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLanguages(new Set())}
                  disabled={selectedLanguages.size === 0}
                >
                  清空
                </Button>
              </div>
            </div>

            <div className="grid gap-1 sm:grid-cols-2">
              {translationLanguages.map(language => (
                <label
                  key={language}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    checked={selectedLanguages.has(language)}
                    onChange={() => toggleRetranslateLanguage(language)}
                    className="size-4 accent-black dark:accent-white"
                  />
                  <span className="text-sm">{languageDisplayName[language]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            已选 {selectedBlogIds.size} 篇博客 × {selectedLanguages.size} 种语言 ={' '}
            {selectedBlogIds.size * selectedLanguages.size} 个任务
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={() => void retranslateSelected()}
            disabled={
              isRetranslating ||
              !hasApiKey ||
              baseUrl.trim().length === 0 ||
              model.trim().length === 0 ||
              selectedBlogIds.size === 0 ||
              selectedLanguages.size === 0
            }
          >
            {isRetranslating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            批量重新翻译
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="mb-4">
          <h2 className="font-semibold text-lg">翻译任务队列</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            每 3 秒自动刷新。支持单个任务和选中任务的批量暂停、继续、取消；处理中任务会立即中断模型请求。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="待执行" value={taskSummary.queued.toLocaleString()} />
          <StatCard label="处理中" value={taskSummary.processing.toLocaleString()} />
          <StatCard label="已暂停" value={taskSummary.paused.toLocaleString()} />
          <StatCard label="失败" value={taskSummary.failed.toLocaleString()} />
          <StatCard label="已取消" value={taskSummary.canceled.toLocaleString()} />
          <StatCard label="已是最新" value={taskSummary.upToDate.toLocaleString()} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleAll}
            disabled={pendingJobs.length === 0}
          >
            {allSelected ? '取消全选' : '全选待处理'}
          </Button>

          <span className="mr-2 text-muted-foreground text-xs">
            已选 {selectedJobs.length} 个
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              isControlling ||
              !selectedJobs.some(canPause)
            }
            onClick={() =>
              void controlTasks(
                'pause',
                selectedJobs.filter(canPause).map(job => job.taskId),
              )
            }
          >
            <Pause className="size-4" />
            批量暂停
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              isControlling ||
              !selectedJobs.some(canResume)
            }
            onClick={() =>
              void controlTasks(
                'resume',
                selectedJobs.filter(canResume).map(job => job.taskId),
              )
            }
          >
            <Play className="size-4" />
            批量继续
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              isControlling ||
              !selectedJobs.some(canCancel)
            }
            onClick={() =>
              void controlTasks(
                'cancel',
                selectedJobs.filter(canCancel).map(job => job.taskId),
              )
            }
          >
            <XCircle className="size-4" />
            批量取消
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="选择全部待处理任务"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-4 accent-black dark:accent-white"
                  />
                </th>
                <th className="px-4 py-2 font-medium">文章</th>
                <th className="px-4 py-2 font-medium">语言</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">尝试</th>
                <th className="px-4 py-2 font-medium">最近更新</th>
                <th className="px-4 py-2 font-medium">错误</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingJobs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={8}>
                    当前没有待处理任务，所有语言版本都已是最新。
                  </td>
                </tr>
              ) : (
                pendingJobs.map(job => (
                  <tr key={job.taskId} className="border-t align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`选择任务 #${job.taskId}`}
                        checked={selectedTaskIds.has(job.taskId)}
                        onChange={() => toggleTask(job.taskId)}
                        className="size-4 accent-black dark:accent-white"
                      />
                    </td>
                    <td className="max-w-64 px-4 py-2">
                      <span className="block truncate" title={job.blogTitle}>
                        #{job.blogId} {job.blogTitle}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {languageDisplayName[job.language]}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs',
                          taskStatusClassName[job.status],
                        )}
                      >
                        {taskStatusText[job.status]}
                      </span>
                      {job.force ? (
                        <span className="ml-1 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-violet-600 text-xs dark:bg-violet-950/50 dark:text-violet-300">
                          强制重译
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 font-mono">{job.attempts}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground text-xs">
                      {formatTaskTime(job.updatedAt)}
                    </td>
                    <td className="max-w-72 px-4 py-2 text-red-500 text-xs">
                      <span className="block line-clamp-2" title={job.error ?? ''}>
                        {job.error ?? '-'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <div className="flex gap-1">
                        {canPause(job) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isControlling}
                            onClick={() => void controlTasks('pause', [job.taskId])}
                          >
                            <Pause className="size-3.5" />
                            暂停
                          </Button>
                        ) : null}

                        {canResume(job) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isControlling}
                            onClick={() => void controlTasks('resume', [job.taskId])}
                          >
                            <Play className="size-3.5" />
                            继续
                          </Button>
                        ) : null}

                        {canCancel(job) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isControlling}
                            onClick={() => void controlTasks('cancel', [job.taskId])}
                          >
                            <XCircle className="size-3.5" />
                            取消
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {recentTasks.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-2 font-medium text-sm">最近任务</h3>
            <div className="space-y-1.5">
              {recentTasks.slice(0, 10).map(task => (
                <div
                  key={task.id}
                  className="flex min-w-0 items-center gap-3 rounded-lg border bg-background/50 px-3 py-2 text-xs"
                >
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5',
                      taskStatusClassName[task.status] ?? taskStatusClassName.queued,
                    )}
                  >
                    {taskStatusText[task.status] ?? task.status}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    #{task.blogId} {task.blogTitle} · {languageDisplayName[task.language]}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    第 {task.attempts} 次 · {formatTaskTime(task.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="mb-4">
          <h2 className="font-semibold text-lg">Token 消耗统计</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            每次自动翻译成功后记录模型返回的 prompt / completion / total token。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="调用次数" value={usage.calls.toLocaleString()} />
          <StatCard label="输入 Token" value={usage.promptTokens.toLocaleString()} />
          <StatCard label="输出 Token" value={usage.completionTokens.toLocaleString()} />
          <StatCard label="总 Token" value={usage.totalTokens.toLocaleString()} />
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 font-medium">语言</th>
                <th className="px-4 py-2 font-medium">次数</th>
                <th className="px-4 py-2 font-medium">输入</th>
                <th className="px-4 py-2 font-medium">输出</th>
                <th className="px-4 py-2 font-medium">总计</th>
              </tr>
            </thead>
            <tbody>
              {usage.byLanguage.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-center text-muted-foreground" colSpan={5}>
                    暂无翻译调用记录
                  </td>
                </tr>
              ) : (
                usage.byLanguage.map(item => (
                  <tr key={item.language} className="border-t">
                    <td className="px-4 py-2">
                      {languageDisplayName[item.language as keyof typeof languageDisplayName] ??
                        item.language}
                    </td>
                    <td className="px-4 py-2">{item.calls.toLocaleString()}</td>
                    <td className="px-4 py-2">{item.promptTokens.toLocaleString()}</td>
                    <td className="px-4 py-2">{item.completionTokens.toLocaleString()}</td>
                    <td className="px-4 py-2 font-medium">{item.totalTokens.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold font-mono text-xl">{value}</p>
    </div>
  )
}
