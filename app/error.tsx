'use client'

import StatusPage from '@/ui/components/status-page'

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <StatusPage code={500} onRetry={reset} />
}
