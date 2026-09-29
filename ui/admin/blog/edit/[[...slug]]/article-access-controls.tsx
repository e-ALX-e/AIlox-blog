'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/ui/shadcn/button'
import { Input } from '@/ui/shadcn/input'
import { Switch } from '@/ui/shadcn/switch'

export function ArticleAccessControls({ articleId }: { articleId?: number }) {
  const [enabled, setEnabled] = useState(false)
  const [stored, setStored] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(articleId != null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (articleId == null) return
    const controller = new AbortController()
    setLoading(true)
    setLoaded(false)
    setCode('')
    setMessage('')
    void fetch(`/api/admin/blog-access?blogId=${articleId}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message ?? '无法读取暗号设置。')
        setEnabled(data.enabled === true)
        setStored(data.enabled === true)
        setLoaded(true)
      })
      .catch(error => {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '读取失败。')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [articleId])

  const save = async () => {
    if (!loaded || articleId == null || saving) return
    if (enabled && !stored && code.length === 0) {
      setMessage('首次开启时请填写暗号。')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/blog-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogId: articleId, enabled, ...(enabled && code !== '' ? { code } : {}) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message ?? '保存失败。')
      setStored(data.enabled === true)
      setCode('')
      setMessage(data.enabled ? '暗号已启用；标题公开，正文需要解锁。' : '暗号保护已关闭。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="文章暗号">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="article-access-enabled" className="font-medium">需要暗号才能阅读</label>
        <Switch id="article-access-enabled" checked={enabled} disabled={!loaded || saving}
          onCheckedChange={setEnabled} />
      </div>
      <p className="text-muted-foreground text-sm">
        标题始终公开；正文、其他语言译文和评论须先解锁。此设置单独保存，不影响文章内容。
      </p>
      {articleId == null ? <p className="text-muted-foreground text-sm">新文章请先保存为草稿，再设置暗号，最后发布，避免正文短暂公开。</p> : (
        <>
          {enabled ? (
            <div className="space-y-2">
              <label htmlFor="article-access-code" className="text-sm">暗号</label>
              <Input id="article-access-code" type="password" autoComplete="new-password" maxLength={128}
                value={code} onChange={event => setCode(event.target.value)} disabled={saving || loading}
                placeholder={stored ? '已设置暗号，留空保持不变' : '请输入 4–128 个字符的暗号'} />
              <p className="text-muted-foreground text-xs">修改暗号后，读者之前的解锁凭据会失效。不会回显原暗号。</p>
            </div>
          ) : null}
          <Button type="button" variant="outline" onClick={() => void save()} disabled={!loaded || saving || loading}>
            {loading ? '读取设置中…' : saving ? '保存中…' : '保存暗号设置'}
          </Button>
        </>
      )}
      <p role="status" className="text-sm">{message}</p>
    </section>
  )
}
