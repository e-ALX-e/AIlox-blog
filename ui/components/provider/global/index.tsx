'use client'

import dynamic from 'next/dynamic'
import { ThemeProvider, useTheme } from 'next-themes'
import { Toaster } from 'sileo'
import { useIsHydrated } from '@/hooks/common/use-is-hydrated'

const Analytics = dynamic(() => import('@vercel/analytics/react').then(m => m.Analytics), {
  ssr: false,
})

const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then(m => m.SpeedInsights),
  {
    ssr: false,
  },
)

function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme()
  const mounted = useIsHydrated()

  if (!mounted || (resolvedTheme !== 'light' && resolvedTheme !== 'dark')) return null

  return <Toaster position="top-left" theme={resolvedTheme} />
}

export default function GlobalProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
        {children}
        <ThemeAwareToaster />
      </ThemeProvider>
      <Analytics mode="production" />
      <SpeedInsights />
    </>
  )
}
