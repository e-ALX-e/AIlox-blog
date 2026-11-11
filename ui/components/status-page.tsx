'use client'

import { BookOpen } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { resolveStatusPage, statusIllustrations } from '@/lib/common/status-pages'
import { defaultLanguage, isLanguage, type Language } from '@/lib/i18n/config'
import styles from './status-page.module.css'

const messages: Record<
  Language,
  { home: string; retry: string; missing: string; failed: string; ready: string }
> = {
  zh: { home: '回到博客', retry: '再试一次', missing: '', failed: '', ready: '' },
  'zh-tw': {
    home: '回到部落格',
    retry: '再試一次',
    missing: '連結可能有誤，或者頁面已經移走了。回到部落格找找吧。',
    failed: '這次請求未能完成，請稍後重試。',
    ready: '操作已完成，可以繼續閱讀文章。',
  },
  en: {
    home: 'Back to blog',
    retry: 'Try again',
    missing:
      'This page may have moved, or the link may be incorrect. Return to the blog to keep reading.',
    failed: 'This request could not be completed. Please try again in a moment.',
    ready: 'All set. You can return to the blog and keep reading.',
  },
  ja: {
    home: 'ブログに戻る',
    retry: '再試行',
    missing:
      'ページが移動したか、リンクが間違っている可能性があります。ブログに戻ってご確認ください。',
    failed: 'リクエストを完了できませんでした。しばらくしてから再度お試しください。',
    ready: '操作が完了しました。ブログに戻って記事をお読みください。',
  },
  ru: {
    home: 'Вернуться в блог',
    retry: 'Повторить',
    missing:
      'Возможно, страница перемещена или ссылка неверна. Вернитесь в блог, чтобы продолжить чтение.',
    failed: 'Не удалось выполнить запрос. Повторите попытку чуть позже.',
    ready: 'Готово. Вы можете вернуться в блог и продолжить чтение.',
  },
  de: {
    home: 'Zurück zum Blog',
    retry: 'Erneut versuchen',
    missing:
      'Die Seite wurde möglicherweise verschoben oder der Link ist falsch. Kehre zum Blog zurück, um weiterzulesen.',
    failed: 'Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es später erneut.',
    ready: 'Alles erledigt. Du kannst zum Blog zurückkehren und weiterlesen.',
  },
}

export default function StatusPage({ code, onRetry }: { code: number; onRetry?: () => void }) {
  const pathname = usePathname()
  const segment = pathname?.split('/')[1]
  const language = isLanguage(segment) ? segment : defaultLanguage
  const text = messages[language]
  const page = resolveStatusPage(code)
  const art = statusIllustrations[page.illustration]!
  const home = `/${language}`
  const title = language === 'zh' ? page.title : page.label
  const description =
    language !== 'zh'
      ? code === 404
        ? text.missing
        : code === 200
          ? text.ready
          : text.failed
      : page.description

  return (
    <div className={styles.page}>
      <title>{`${page.code} · ${title} · Ailoxi`}</title>
      <header className={styles.header}>
        <a className={styles.brand} href={home}>
          <BookOpen size={28} strokeWidth={1.5} aria-hidden="true" />
          <span>Ailoxi</span>
        </a>
      </header>
      <main className={styles.content} aria-labelledby="status-title">
        <section className={styles.copy}>
          <p className={styles.code}>{page.code}</p>
          <p className={styles.label} lang="en">
            {page.label}
          </p>
          <h1 id="status-title" className={styles.title}>
            {title}
          </h1>
          <p className={styles.description}>{description}</p>
          <nav
            className={styles.actions}
            aria-label={language === 'zh' ? '页面操作' : 'Page actions'}
          >
            {onRetry ? (
              <button
                className={`${styles.button} ${styles.primary}`}
                type="button"
                onClick={onRetry}
              >
                {text.retry}
              </button>
            ) : null}
            <a className={`${styles.button} ${onRetry ? '' : styles.primary}`} href={home}>
              {text.home}
            </a>
          </nav>
        </section>
        <div className={styles.art}>
          <svg
            className={styles.illustration}
            viewBox={art.viewBox}
            role="img"
            aria-label={language === 'zh' ? page.alt : `${page.label} illustration`}
            focusable="false"
          >
            <image
              href={`/status-illustrations/${page.illustration}.png`}
              width={art.width}
              height={art.height}
            />
          </svg>
        </div>
      </main>
      <footer className={styles.footer}>
        {language === 'zh' ? '黯留星 · 记录与分享' : 'Ailoxi · Notes and stories'}
      </footer>
    </div>
  )
}
