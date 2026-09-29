'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { readArticleAccessLink } from '@/lib/core/blog-access/share-link'
import type { Language } from '@/lib/i18n/config'

const copy: Record<Language, { prompt: string; label: string; submit: string; loading: string; wrong: string; wait: string; error: string; shareWrong: string }> = {
  zh: { prompt: '这篇文章需要暗号才能阅读。', label: '暗号', submit: '解锁文章', loading: '验证中…', wrong: '暗号不正确，请重试。', wait: '尝试次数较多，请十分钟后再试。', error: '暂时无法解锁，请稍后重试。', shareWrong: '分享链接无效、已过期或已撤销。请联系管理员，或输入文章暗号。' },
  'zh-tw': { prompt: '這篇文章需要暗號才能閱讀。', label: '暗號', submit: '解鎖文章', loading: '驗證中…', wrong: '暗號不正確，請重試。', wait: '嘗試次數較多，請十分鐘後再試。', error: '暫時無法解鎖，請稍後重試。', shareWrong: '分享連結無效、已過期或已撤銷。請聯絡管理員，或輸入文章暗號。' },
  en: { prompt: 'Enter the access phrase to read this article.', label: 'Access phrase', submit: 'Unlock article', loading: 'Checking…', wrong: 'Incorrect access phrase. Please try again.', wait: 'Too many attempts. Try again in ten minutes.', error: 'Unable to unlock right now. Please try again later.', shareWrong: 'This share link is invalid, expired or revoked. Contact the administrator or enter the access phrase.' },
  ja: { prompt: 'この記事を読むには合言葉を入力してください。', label: '合言葉', submit: '記事を開く', loading: '確認中…', wrong: '合言葉が違います。', wait: '試行回数が多すぎます。10分後にお試しください。', error: '現在は開けません。後でもう一度お試しください。', shareWrong: '共有リンクが無効、有効期限切れ、または取り消されています。管理者に連絡するか、合言葉を入力してください。' },
  ru: { prompt: 'Введите кодовую фразу, чтобы прочитать статью.', label: 'Кодовая фраза', submit: 'Открыть статью', loading: 'Проверка…', wrong: 'Неверная кодовая фраза.', wait: 'Слишком много попыток. Повторите через десять минут.', error: 'Не удалось открыть статью. Повторите позже.', shareWrong: 'Ссылка недействительна, просрочена или отозвана. Обратитесь к администратору или введите кодовую фразу.' },
  de: { prompt: 'Gib das Codewort ein, um den Artikel zu lesen.', label: 'Codewort', submit: 'Artikel öffnen', loading: 'Wird geprüft…', wrong: 'Das Codewort ist falsch.', wait: 'Zu viele Versuche. Bitte in zehn Minuten erneut versuchen.', error: 'Der Artikel kann gerade nicht geöffnet werden.', shareWrong: 'Dieser Freigabelink ist ungültig, abgelaufen oder widerrufen. Wende dich an den Administrator oder gib das Codewort ein.' },
}

export function ArticleCodeGate({ slug, title, language }: { slug: string; title: string; language: Language }) {
  const text = copy[language]
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const busy = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const unlock = useCallback(async (candidate: string | null, kind: 'code' | 'share' = 'code') => {
    if (busy.current) return
    const isShare = kind === 'share'
    if (candidate == null || (isShare ? candidate.length !== 84 : candidate.trim().length < 4 || candidate.length > 128)) {
      setMessage(isShare ? text.shareWrong : text.wrong)
      return
    }
    busy.current = true
    setPending(true)
    setMessage('')
    const pathname = window.location.pathname
    try {
      const response = await fetch(`/api/blog/${encodeURIComponent(slug)}/${isShare ? 'share' : 'unlock'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isShare ? { token: candidate } : { code: candidate }),
        cache: 'no-store', credentials: 'same-origin',
      })
      if (!mounted.current || window.location.pathname !== pathname) return
      if (!response.ok) {
        setMessage(response.status === 429 ? text.wait : response.status === 403
          ? isShare ? text.shareWrong : text.wrong : text.error)
        return
      }
      setCode('')
      router.refresh()
    } catch {
      if (mounted.current) setMessage(text.error)
    } finally {
      busy.current = false
      if (mounted.current) setPending(false)
    }
  }, [router, slug, text])

  useEffect(() => {
    const consume = () => {
      const supplied = readArticleAccessLink(window.location.href)
      if (supplied == null) return
      // Scrub before the POST; preserve the App Router's state in this history entry.
      window.history.replaceState(window.history.state, '', supplied.cleanUrl)
      void unlock(supplied.value, supplied.kind)
    }
    consume()
    window.addEventListener('hashchange', consume)
    window.addEventListener('popstate', consume)
    return () => {
      window.removeEventListener('hashchange', consume)
      window.removeEventListener('popstate', consume)
    }
  }, [unlock, searchParams])

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-6">
      <h1 className="mb-8 text-center font-semibold text-3xl">{title}</h1>
      <form className="mx-auto max-w-md space-y-4 rounded-xl border bg-background/90 p-6"
        aria-busy={pending}
        onSubmit={event => { event.preventDefault(); void unlock(code) }}>
        <p>{text.prompt}</p>
        <label htmlFor="article-unlock-code" className="block text-sm">{text.label}</label>
        <input id="article-unlock-code" type="password" autoComplete="off" required maxLength={128}
          value={code} onChange={event => setCode(event.target.value)} disabled={pending}
          className="h-10 w-full rounded-md border bg-background px-3 focus-visible:outline-2 focus-visible:outline-offset-2" />
        <button type="submit" disabled={pending || code.length === 0}
          className="h-10 w-full rounded-md bg-foreground px-4 text-background disabled:opacity-50">
          {pending ? text.loading : text.submit}
        </button>
        <p role="alert" className="text-sm text-red-500">{message}</p>
      </form>
    </section>
  )
}
