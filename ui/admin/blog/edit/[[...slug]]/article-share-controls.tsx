'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/ui/shadcn/button'
import { Input } from '@/ui/shadcn/input'

// Only non-secret metadata is returned by the listing API.
type Share = { id: string; note: string; createdAt: string; expiresAt: string;
  revokedAt: string | null; status: 'active' | 'expired' | 'revoked' | 'invalidated' }
const statusLabel: Record<Share['status'], string> = {
  active: '有效', expired: '已过期', revoked: '已撤销', invalidated: '暗号已变更，已失效',
}
const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })

export function ArticleShareControls({ articleId, disabled = false }: { articleId: number; disabled?: boolean }) {
  const [shares, setShares] = useState<Share[]>([])
  const [note, setNote] = useState('')
  const [hours, setHours] = useState(168)
  const [language, setLanguage] = useState('zh')
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [created, setCreated] = useState<{ id: string; url: string } | null>(null)
  const generation = useRef(0)
  const busy = useRef(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const version = generation.current
    setLoading(true)
    setReady(false)
    try {
      const response = await fetch(`/api/admin/blog-shares?blogId=${articleId}`, { cache: 'no-store', signal })
      const data = await response.json()
      if (signal?.aborted || version !== generation.current) return
      if (!response.ok) throw new Error(data.message ?? '无法读取分享。')
      setShares(data.shares)
      setReady(data.enabled === true && data.isPublished === true)
      if (!data.isPublished) setMessage('请先发布文章，再创建分享。')
      else if (!data.enabled) setMessage('请先开启并保存暗号保护。')
    } catch (error) {
      if (!signal?.aborted && version === generation.current) setMessage(error instanceof Error ? error.message : '读取失败。')
    } finally {
      if (!signal?.aborted && version === generation.current) setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    generation.current++
    const controller = new AbortController()
    setShares([]); setCreated(null); setMessage('')
    void refresh(controller.signal)
    return () => { controller.abort(); generation.current++ }
  }, [refresh])

  const create = async () => {
    if (busy.current || disabled || !ready) return
    const version = generation.current
    busy.current = true; setPending(true); setMessage(''); setCreated(null)
    try {
      const response = await fetch('/api/admin/blog-shares', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ blogId: articleId, expiresInHours: hours, note, language }),
      })
      const data = await response.json()
      if (version !== generation.current) return
      if (!response.ok) throw new Error(data.message ?? '无法创建分享。')
      setCreated({ id: data.share.id, url: data.url })
      setShares(previous => [data.share, ...previous])
      setNote('')
      setMessage('分享已创建。完整链接只显示这一次，请复制保存。')
    } catch (error) {
      if (version === generation.current) setMessage(error instanceof Error ? error.message : '创建失败，请刷新列表检查后重试。')
    } finally {
      busy.current = false
      if (version === generation.current) setPending(false)
    }
  }

  const revoke = async (id: string) => {
    if (busy.current || disabled) return
    const version = generation.current
    busy.current = true; setPending(true); setMessage('')
    try {
      const response = await fetch('/api/admin/blog-shares', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ blogId: articleId, id }),
      })
      const data = await response.json()
      if (version !== generation.current) return
      if (!response.ok) throw new Error(data.message ?? '撤销失败。')
      setShares(previous => previous.map(share => share.id === id ? { ...share, status: 'revoked' } : share))
      setCreated(previous => previous?.id === id ? null : previous)
      setMessage('分享已撤销；使用该分享获得的访问凭据将在下次服务端请求时失效。')
    } catch (error) {
      if (version === generation.current) setMessage(error instanceof Error ? error.message : '撤销失败。')
    } finally {
      busy.current = false
      if (version === generation.current) setPending(false)
    }
  }

  const blocked = disabled || loading || pending
  return (
    <section aria-label="免暗号分享" className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">免暗号分享（仅管理员可创建）</h3>
        <Button type="button" variant="outline" size="sm" disabled={blocked} onClick={() => { setMessage(''); void refresh() }}>
          刷新列表
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        创建独立分享令牌，无需重新填写文章暗号。读者打开链接即可阅读；不授予后台、编辑或创建分享的权限。
      </p>
      {disabled ? <p className="text-sm">请先保存上方的暗号设置。</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm" htmlFor="share-note">备注（可选）
          <Input id="share-note" value={note} maxLength={80} disabled={blocked}
            onChange={event => setNote(event.target.value)} placeholder="例如：发给招聘方" />
        </label>
        <label className="space-y-1 text-sm" htmlFor="share-expiry">有效期
          <select id="share-expiry" value={hours} onChange={event => setHours(Number(event.target.value))}
            disabled={blocked} className="h-9 w-full rounded-md border bg-background px-3">
            <option value={1}>1 小时</option><option value={24}>1 天</option>
            <option value={168}>7 天</option><option value={720}>30 天</option>
          </select>
        </label>
        <label className="space-y-1 text-sm" htmlFor="share-language">打开语言
          <select id="share-language" value={language} onChange={event => setLanguage(event.target.value)}
            disabled={blocked} className="h-9 w-full rounded-md border bg-background px-3">
            <option value="zh">简体中文</option><option value="en">English</option>
            <option value="zh-tw">繁體中文</option><option value="ja">日本語</option>
            <option value="ru">Русский</option><option value="de">Deutsch</option>
          </select>
        </label>
      </div>
      <Button type="button" disabled={blocked || !ready} onClick={() => void create()}>
        {pending ? '处理中…' : loading ? '读取分享中…' : '创建免暗号分享'}
      </Button>
      {created ? (
        <div className="space-y-2 rounded-md border p-3">
          <label htmlFor="created-share-url" className="block text-sm">分享链接（只显示一次）</label>
          <textarea id="created-share-url" readOnly rows={3} value={created.url}
            onFocus={event => event.target.select()} className="w-full resize-none break-all rounded-md border bg-background p-2 font-mono text-xs" />
          <Button type="button" variant="outline" onClick={async () => {
            try { await navigator.clipboard.writeText(created.url); setMessage('分享链接已复制。') }
            catch { setMessage('请选中链接手动复制。') }
          }}>复制分享链接</Button>
        </div>
      ) : null}
      <p role="status" className="text-sm">{message}</p>
      {shares.length > 0 ? (
        <div className="max-h-80 overflow-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b"><th className="p-2">备注</th><th className="p-2">状态 / 到期时间</th><th className="p-2">操作</th></tr></thead>
            <tbody>{shares.map(share => (
              <tr key={share.id} className="border-b last:border-0">
                <td className="max-w-52 break-words p-2">{share.note || '未填写备注'}<div className="text-muted-foreground text-xs">{formatDate(share.createdAt)}</div></td>
                <td className="p-2">{statusLabel[share.status]}<div className="text-muted-foreground text-xs">{formatDate(share.expiresAt)}</div></td>
                <td className="p-2"><Button type="button" variant="outline" size="sm" disabled={blocked || share.status !== 'active'} onClick={() => void revoke(share.id)}>撤销</Button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : ready && !loading ? <p className="text-muted-foreground text-sm">暂无分享。</p> : null}
      <p className="text-muted-foreground text-xs">
        完整链接本身就是阅读凭据，可被转发，请只发给允许阅读的人。撤销不会收回已下载的内容；修改暗号会使旧分享失效。
      </p>
    </section>
  )
}
