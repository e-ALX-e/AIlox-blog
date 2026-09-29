'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/ui/shadcn/button'
import { Input } from '@/ui/shadcn/input'
import { Switch } from '@/ui/shadcn/switch'
import { ArticleShareControls } from './article-share-controls'

export function ArticleAccessControls({ articleId }: { articleId?: number }) {
  const [enabled, setEnabled] = useState(false)
  const [stored, setStored] = useState(false)
  const [adminBypass, setAdminBypass] = useState(false)
  const [storedBypass, setStoredBypass] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(articleId != null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const version = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    version.current++
    setLoaded(false); setLoading(articleId != null); setSaving(false)
    setEnabled(false); setStored(false); setAdminBypass(false); setStoredBypass(false)
    setCode(''); setMessage('')
    if (articleId != null) {
      void fetch(`/api/admin/blog-access?blogId=${articleId}`, { cache: 'no-store', signal: controller.signal })
        .then(async response => {
          const data = await response.json()
          if (!response.ok) throw new Error(data.message ?? '无法读取暗号设置。')
          if (controller.signal.aborted) return
          setEnabled(data.enabled === true); setStored(data.enabled === true)
          setAdminBypass(data.adminBypass === true); setStoredBypass(data.adminBypass === true)
          setLoaded(true)
        })
        .catch(error => {
          if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '读取失败。')
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }
    return () => { controller.abort(); version.current++ }
  }, [articleId])

  const changed = enabled !== stored || (enabled && (adminBypass !== storedBypass || code !== ''))
  const save = async () => {
    if (!loaded || articleId == null || saving) return
    if (enabled && !stored && code.length === 0) { setMessage('首次开启时请填写暗号。'); return }
    const requestVersion = version.current
    setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/admin/blog-access', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ blogId: articleId, enabled, adminBypass, ...(enabled && code !== '' ? { code } : {}) }),
      })
      const data = await response.json()
      if (requestVersion !== version.current) return
      if (!response.ok) throw new Error(data.message ?? '保存失败。')
      setStored(data.enabled === true); setEnabled(data.enabled === true)
      setAdminBypass(data.adminBypass === true); setStoredBypass(data.adminBypass === true)
      setCode(''); setRevision(value => value + 1)
      setMessage(!data.enabled ? '暗号保护已关闭。' : data.adminBypass
        ? '已保存：标题公开；管理员免暗号，其他读者须解锁正文。'
        : '已保存：标题公开；前台正文需要暗号或有效的管理员分享。')
    } catch (error) {
      if (requestVersion === version.current) setMessage(error instanceof Error ? error.message : '保存失败。')
    } finally {
      if (requestVersion === version.current) setSaving(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="文章暗号">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="article-access-enabled" className="font-medium">需要暗号才能阅读</label>
        <Switch id="article-access-enabled" checked={enabled} disabled={!loaded || saving} onCheckedChange={setEnabled} />
      </div>
      <p className="text-muted-foreground text-sm">
        标题始终公开；正文、其他语言译文和评论须先解锁。此设置单独保存，不影响文章内容。
      </p>
      {loaded ? <p className="text-sm" role="status">
        当前已保存：{stored ? '暗号保护已开启' : '暗号保护未开启'}{changed ? ' · 有未保存的修改' : ''}
      </p> : null}
      {articleId == null ? <p className="text-muted-foreground text-sm">新文章请先保存为草稿，再设置暗号，最后发布，避免正文短暂公开。</p> : (
        <>
          {enabled ? (
            <>
              <div className="space-y-2">
                <label htmlFor="article-access-code" className="text-sm">暗号</label>
                <Input id="article-access-code" type="password" autoComplete="new-password" maxLength={128}
                  value={code} onChange={event => setCode(event.target.value)} disabled={saving || loading}
                  placeholder={stored ? '已设置暗号，留空保持不变' : '请输入 4–128 个字符的暗号'} />
                <p className="text-muted-foreground text-xs">修改暗号会使旧解锁凭据和旧免暗号分享失效。不会回显原暗号。</p>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="article-admin-bypass" className="text-sm font-medium">管理员免暗号验证</label>
                  <Switch id="article-admin-bypass" checked={adminBypass} disabled={!loaded || saving} onCheckedChange={setAdminBypass} />
                </div>
                <p className="text-muted-foreground text-xs">关闭后，管理员前台阅读也须解锁；后台编辑和创建分享权限不受影响。每篇文章单独设置，保存后生效。</p>
                <p className="text-muted-foreground text-xs">此前的有效解锁记录仍可使用；测试未解锁效果请使用无痕窗口。</p>
              </div>
            </>
          ) : null}
          <Button type="button" variant="outline" onClick={() => void save()} disabled={!loaded || saving || loading}>
            {loading ? '读取设置中…' : saving ? '保存中…' : '保存暗号设置'}
          </Button>
          {loaded && stored && enabled ? (
            <ArticleShareControls key={`${articleId}:${revision}`} articleId={articleId} disabled={changed || saving} />
          ) : null}
        </>
      )}
      <p role="status" className="text-sm">{message}</p>
    </section>
  )
}
