'use client'

import { Eye, EyeOff, Loader2, RefreshCcw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sileo } from 'sileo'
import {
  getTranslationAdminState,
  runTranslationQueue,
  type TranslationAdminState,
  type TranslationJob,
  updateTranslationConfig,
} from '@/lib/api/translation/admin'
import { languageDisplayName } from '@/lib/i18n/config'
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
  failed: 0,
  upToDate: 0,
}

const taskStatusText: Record<string, string> = {
  queued: '待执行',
  processing: '处理中',
  failed: '失败',
  succeeded: '成功',
  skipped: '已跳过',
}

const taskStatusClassName: Record<string, string> = {
  queued: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  processing: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  failed: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300',
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

export function AdminTranslationPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
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
  const [queueWorkerRunning, setQueueWorkerRunning] = useState(false)
  const [skippedUpToDateCount, setSkippedUpToDateCount] = useState(0)
  const [totalTranslationSlots, setTotalTranslationSlots] = useState(0)

  const runnableJobs = pendingJobs.filter(job => job.status !== 'processing')

  const applyState = (data: TranslationAdminState) => {
    setEnabled(data.config.enabled)
    setBaseUrl(data.config.baseUrl)
    setModel(data.config.model)
    setHasApiKey(data.config.hasApiKey)
    setUsage(data.usage)
    setPendingJobs(data.pendingJobs)
    setTaskSummary(data.taskSummary)
    setRecentTasks(data.recentTasks)
    setQueueWorkerRunning(data.queueWorkerRunning)
    setSkippedUpToDateCount(data.skippedUpToDateCount)
    setTotalTranslationSlots(data.totalTranslationSlots)
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
        if (!active) return
        applyState(data)
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
        .catch(() => {
          // Keep the current dashboard state when a background refresh fails.
        })
    }, 4000)

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

  const syncAll = async () => {
    if (queueWorkerRunning || taskSummary.processing > 0) {
      sileo.info({
        title: '翻译队列正在运行',
        description: '后台会继续处理剩余任务，可以离开此页面，无需重复提交。',
      })
      return
    }

    if (runnableJobs.length === 0) {
      sileo.success({
        title: '所有翻译均为最新',
        description: `已确认 ${skippedUpToDateCount} 个语言版本没有变化`,
      })
      return
    }

    setIsSyncing(true)

    try {
      const response = await runTranslationQueue()
      await loadState()

      sileo.success({
        title: '翻译队列已启动',
        description: `新排队 ${response.queue.queued} 个，已是最新 ${response.queue.upToDate} 个。任务会在服务器后台串行执行。`,
      })
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : '启动翻译队列失败',
      })
    } finally {
      setIsSyncing(false)
    }
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-4 pb-12">
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
            onClick={() => void syncAll()}
            disabled={
              isSyncing ||
              !enabled ||
              !hasApiKey ||
              queueWorkerRunning ||
              taskSummary.processing > 0 ||
              runnableJobs.length === 0
            }
          >
            {isSyncing || queueWorkerRunning || taskSummary.processing > 0 ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {isSyncing
              ? '正在启动队列...'
              : queueWorkerRunning || taskSummary.processing > 0
                ? `后台处理中（${taskSummary.processing}）`
                : runnableJobs.length > 0
                  ? `启动待更新队列（${runnableJobs.length}）`
                  : '翻译已是最新'}
          </Button>
        </div>

        <div className="mt-3 text-muted-foreground text-xs">
          共 {totalTranslationSlots} 个语言版本 · 已是最新 {taskSummary.upToDate} 个 ·
          待执行 {taskSummary.queued} 个 · 处理中 {taskSummary.processing} 个 · 失败 {taskSummary.failed} 个
        </div>

        {queueWorkerRunning || taskSummary.processing > 0 ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-muted-foreground text-xs">
              <span>服务器后台串行翻译中，可以安全离开页面；临时 5xx / 429 会自动重试</span>
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
          <h2 className="font-semibold text-lg">翻译任务队列</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            每 4 秒自动刷新。队列在服务器后台执行，即使离开页面也会继续；运行期间会锁定按钮，避免重复请求。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="待执行" value={taskSummary.queued.toLocaleString()} />
          <StatCard label="处理中" value={taskSummary.processing.toLocaleString()} />
          <StatCard label="失败" value={taskSummary.failed.toLocaleString()} />
          <StatCard label="已是最新" value={taskSummary.upToDate.toLocaleString()} />
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 font-medium">文章</th>
                <th className="px-4 py-2 font-medium">语言</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">尝试</th>
                <th className="px-4 py-2 font-medium">最近更新</th>
                <th className="px-4 py-2 font-medium">错误</th>
              </tr>
            </thead>
            <tbody>
              {pendingJobs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                    当前没有待处理任务，所有语言版本都已是最新。
                  </td>
                </tr>
              ) : (
                pendingJobs.map(job => (
                  <tr key={`${job.blogId}:${job.language}`} className="border-t align-top">
                    <td className="max-w-64 px-4 py-2">
                      <span className="block truncate" title={job.blogTitle}>
                        #{job.blogId} {job.blogTitle}
                      </span>
                    </td>
                    <td className="px-4 py-2">{languageDisplayName[job.language]}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs',
                          taskStatusClassName[job.status],
                        )}
                      >
                        {taskStatusText[job.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono">{job.attempts}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground text-xs">
                      {formatTaskTime(job.updatedAt)}
                    </td>
                    <td className="max-w-80 px-4 py-2 text-red-500 text-xs">
                      <span className="block line-clamp-2" title={job.error ?? ''}>
                        {job.error ?? '-'}
                      </span>
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
            每次自动翻译完成后记录模型返回的 prompt / completion / total token。
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
