'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/ui/shadcn/button'
import { Input } from '@/ui/shadcn/input'
import { Switch } from '@/ui/shadcn/switch'

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
  const [shareCode, setShareCode] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const version = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    version.current++
    setLoaded(false)
    setLoading(articleId != null)
    setSaving(false)
    setSharing(false)
    setEnabled(false)
    setStored(false)
    setAdminBypass(false)
    setStoredBypass(false)
    setCode('')
    setShareCode('')
    setShareUrl('')
    setMessage('')
    setShareMessage('')
    if (articleId != null) {
      void fetch(`/api/admin/blog-access?blogId=${articleId}`, { cache: 'no-store', signal: controller.signal })
        .then(async response => {
          const data = await response.json()
          if (!response.ok) throw new Error(data.message ?? '无法读取暗号设置。')
          if (controller.signal.aborted) return
          setEnabled(data.enabled === true)
          setStored(data.enabled === true)
          setAdminBypass(data.adminBypass === true)
          setStoredBypass(data.adminBypass === true)
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
  const busy = saving || sharing
  const save = async () => {
    if (!loaded || articleId == null || busy) return
    if (enabled && !stored && code.length === 0) {
      setMessage('首次开启时请填写暗号。')
      return
    }
    const requestVersion = version.current
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/blog-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogId: articleId, enabled, adminBypass, ...(enabled && code !== '' ? { code } : {}) }),
        cache: 'no-store',
      })
      const data = await response.json()
      if (requestVersion !== version.current) return
      if (!response.ok) throw new Error(data.message ?? '保存失败。')
      setStored(data.enabled === true)
      setEnabled(data.enabled === true)
      setAdminBypass(data.adminBypass === true)
      setStoredBypass(data.adminBypass === true)
      if (!data.enabled) setShareCode('')
      else if (code !== '') setShareCode(code)
      setShareUrl('')
      setShareMessage('')
      setCode('')
      setMessage(!data.enabled ? '暗号保护已关闭。' : data.adminBypass
        ? '已保存：标题公开；管理员免暗号，其他读者须解锁正文。'
        : '已保存：标题公开；包括管理员在内，前台阅读正文都须解锁。')
    } catch (error) {
      if (requestVersion === version.current) setMessage(error instanceof Error ? error.message : '保存失败。')
    } finally {
      if (requestVersion === version.current) setSaving(false)
    }
  }

  const generateLink = async () => {
    if (!loaded || !stored || changed || busy || articleId == null) return
    const requestVersion = version.current
    setSharing(true)
    setShareUrl('')
    setShareMessage('')
    try {
      const response = await fetch('/api/admin/blog-access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogId: articleId, code: shareCode }), cache: 'no-store',
      })
      const data = await response.json()
      if (requestVersion !== version.current) return
      if (!response.ok) throw new Error(data.message ?? '无法生成链接。')
      setShareUrl(data.url)
      setShareCode('')
      setShareMessage('已生成。此链接包含暗号，请只发给允许阅读的人。')
    } catch (error) {
      if (requestVersion === version.current) setShareMessage(error instanceof Error ? error.message : '生成失败。')
    } finally {
      if (requestVersion === version.current) setSharing(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="文章暗号">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="article-access-enabled" className="font-medium">需要暗号才能阅读</label>
        <Switch id="article-access-enabled" checked={enabled} disabled={!loaded || busy}
          onCheckedChange={value => { setEnabled(value); setShareUrl('') }} />
      </div>
      <p className="text-muted-foreground text-sm">
        标题始终公开；正文、其他语言译文和评论须先解锁。此设置单独保存，不影响文章内容。
      </p>
      {loaded ? <p className="text-sm" role="status">
        当前已保存：{stored ? '暗号保护已开启' : '暗号保护未开启'}
        {changed ? ' · 有未保存的修改' : ''}
      </p> : null}
      {articleId == null ? <p className="text-muted-foreground text-sm">新文章请先保存为草稿，再设置暗号，最后发布，避免正文短暂公开。</p> : (
        <>
          {enabled ? (
            <>
              <div className="space-y-2">
                <label htmlFor="article-access-code" className="text-sm">暗号</label>
                <Input id="article-access-code" type="password" autoComplete="new-password" maxLength={128}
                  value={code} onChange={event => { setCode(event.target.value); setShareUrl('') }} disabled={busy || loading}
                  placeholder={stored ? '已设置暗号，留空保持不变' : '请输入 4–128 个字符的暗号'} />
                <p className="text-muted-foreground text-xs">修改暗号后，读者之前的解锁凭据会失效。不会回显原暗号。</p>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="article-admin-bypass" className="text-sm font-medium">管理员免暗号验证</label>
                  <Switch id="article-admin-bypass" checked={adminBypass} disabled={!loaded || busy}
                    onCheckedChange={setAdminBypass} />
                </div>
                <p className="text-muted-foreground text-xs">
                  关闭后，管理员在前台也须输入暗号；后台编辑权限不受影响。每篇文章单独设置，保存后生效。
                </p>
                <p className="text-muted-foreground text-xs">
                  此前正确输入暗号产生的解锁记录仍在 12 小时内有效；测试未解锁效果请使用无痕窗口。
                </p>
              </div>
            </>
          ) : null}
          <Button type="button" variant="outline" onClick={() => void save()} disabled={!loaded || busy || loading}>
            {loading ? '读取设置中…' : saving ? '保存中…' : '保存暗号设置'}
          </Button>
          {loaded && stored && enabled ? (
            <details className="space-y-3 rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">带暗号的分享链接</summary>
              <p className="text-muted-foreground text-xs">
                输入当前已保存的暗号后生成链接，不会改动原暗号，也不会解锁此浏览器。
                任何获得链接的人都可阅读，请勿公开发布。
              </p>
              {changed ? <p className="text-muted-foreground text-xs">请先保存上方的暗号设置。</p> : null}
              <label htmlFor="article-share-code" className="block text-sm">链接暗号</label>
              <Input id="article-share-code" type="password" autoComplete="off" maxLength={128}
                value={shareCode} disabled={busy || changed}
                onChange={event => { setShareCode(event.target.value); setShareUrl(''); setShareMessage('') }}
                placeholder="输入当前已保存的暗号，仅用于生成链接" />
              <Button type="button" variant="outline" onClick={() => void generateLink()}
                disabled={busy || changed || shareCode.trim().length < 4}>
                {sharing ? '校验并生成中…' : '生成带暗号链接'}
              </Button>
              {shareUrl !== '' ? (
                <div className="space-y-2">
                  <label htmlFor="article-share-url" className="block text-sm">分享链接（包含暗号）</label>
                  <Input id="article-share-url" readOnly value={shareUrl} onFocus={event => event.target.select()} />
                  <Button type="button" variant="outline" onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl)
                      setShareMessage('链接已复制，请仅分享给允许阅读的人。')
                    } catch { setShareMessage('自动复制未获允许，请选中链接手动复制。') }
                  }}>复制带暗号链接</Button>
                </div>
              ) : null}
              <p className="text-muted-foreground text-xs">
                默认使用 #code=…；打开后自动校验并从地址栏移除暗号。复制普通文章链接不会附带暗号。
              </p>
              <p role="status" className="text-sm">{shareMessage}</p>
            </details>
          ) : null}
        </>
      )}
      <p role="status" className="text-sm">{message}</p>
    </section>
  )
}
