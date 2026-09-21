'use client'

import { Loader2, RefreshCcw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sileo } from 'sileo'
import {
  getTranslationAdminState,
  syncTranslation,
  type TranslationAdminState,
  updateTranslationConfig,
} from '@/lib/api/translation/admin'
import {
  languageDisplayName,
  translationLanguages,
  type TranslationLanguage,
} from '@/lib/i18n/config'
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

type SyncFailure = {
  blogId: number
  language: TranslationLanguage
  error: string
}

export function AdminTranslationPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [usage, setUsage] = useState(emptyUsage)
  const [publishedBlogIds, setPublishedBlogIds] = useState<number[]>([])
  const [syncDone, setSyncDone] = useState(0)
  const [syncTotal, setSyncTotal] = useState(0)

  const loadState = async () => {
    const data = await getTranslationAdminState()
    setEnabled(data.config.enabled)
    setBaseUrl(data.config.baseUrl)
    setModel(data.config.model)
    setHasApiKey(data.config.hasApiKey)
    setUsage(data.usage)
    setPublishedBlogIds(data.publishedBlogIds)
    return data
  }

  useEffect(() => {
    let active = true

    void getTranslationAdminState()
      .then(data => {
        if (!active) return
        setEnabled(data.config.enabled)
        setBaseUrl(data.config.baseUrl)
        setModel(data.config.model)
        setHasApiKey(data.config.hasApiKey)
        setUsage(data.usage)
        setPublishedBlogIds(data.publishedBlogIds)
      })
      .catch(error => {
        sileo.error({ title: error instanceof Error ? error.message : '加载模型配置失败' })
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
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
    const jobs = publishedBlogIds.flatMap(blogId =>
      translationLanguages.map(language => ({ blogId, language })),
    )

    if (jobs.length === 0) {
      sileo.info({ title: '没有已发布文章需要翻译' })
      return
    }

    setIsSyncing(true)
    setSyncDone(0)
    setSyncTotal(jobs.length)

    const failures: SyncFailure[] = []
    let nextIndex = 0

    const worker = async () => {
      while (nextIndex < jobs.length) {
        const job = jobs[nextIndex]
        nextIndex += 1

        try {
          await syncTranslation(job)
        } catch (error) {
          failures.push({
            ...job,
            error: error instanceof Error ? error.message : String(error),
          })
        } finally {
          setSyncDone(value => value + 1)
        }
      }
    }

    try {
      // Keep each HTTP request short and use only two concurrent model calls.
      // This avoids a single Cloudflare request waiting for every article/language.
      await Promise.all([worker(), worker()])
      const freshState = await loadState()

      if (failures.length > 0) {
        const preview = failures
          .slice(0, 3)
          .map(
            item =>
              `#${item.blogId} ${languageDisplayName[item.language]}: ${item.error}`,
          )
          .join('；')

        sileo.error({
          title: `翻译完成，但有 ${failures.length} 个任务失败`,
          description: preview,
        })
      } else {
        sileo.success({
          title: '已重新翻译全部已发布文章',
          description: `完成 ${jobs.length} 个翻译任务，总 Token ${freshState.usage.totalTokens.toLocaleString()}`,
        })
      }
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
    syncTotal > 0 ? Math.min(100, Math.round((syncDone / syncTotal) * 100)) : 0

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
            <Input
              id="translation-base-url"
              value={baseUrl}
              onChange={event => setBaseUrl(event.target.value)}
              placeholder="https://api.deepseek.com/v1"
            />
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
            disabled={isSyncing || !enabled || !hasApiKey}
          >
            {isSyncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {isSyncing ? `翻译中 ${syncDone}/${syncTotal}` : '重新翻译全部已发布文章'}
          </Button>
        </div>

        {isSyncing ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-muted-foreground text-xs">
              <span>分批翻译中，每个请求只处理一篇文章的一种语言</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
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
