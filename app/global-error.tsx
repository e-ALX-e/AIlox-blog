'use client'

import { useEffect } from 'react'
import StatusPage from '@/ui/components/status-page'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    try {
      const theme = localStorage.getItem('theme')
      document.documentElement.classList.toggle(
        'dark',
        theme === 'dark' ||
          ((!theme || theme === 'system') && matchMedia('(prefers-color-scheme: dark)').matches),
      )
    } catch {
      /* Keep the fallback available when browser storage is unavailable. */
    }
  }, [])

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body style={{ margin: 0, fontFamily: 'system-ui, "Microsoft YaHei", sans-serif' }}>
        <StatusPage code={500} onRetry={reset} />
      </body>
    </html>
  )
}
