'use client'

import { useEffect, useMemo, useState } from 'react'
import { languageHtmlLang } from '@/lib/i18n/config'
import { cn } from '@/lib/utils/common/shadcn'
import { useLanguage } from '@/ui/components/provider/main/language-provider'
import { FloatingMenuShell } from './floating-menu-shell'
import { type FloatingMenuControl, menuLabels } from './menu-labels'
import styles from './panel.module.css'

export function createWorldTimeFormatters(locale: string, timeZone: string) {
  return {
    time: new Intl.DateTimeFormat(locale, {
      timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }),
    date: new Intl.DateTimeFormat(locale, {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    }),
    zone: new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' }),
  }
}

function WorldTimeRow({ label, locale, now, timeZone }: {
  label: string
  locale: string
  now: Date
  timeZone: string
}) {
  const formatters = useMemo(() => createWorldTimeFormatters(locale, timeZone), [locale, timeZone])
  const zoneName = formatters.zone.formatToParts(now).find(part => part.type === 'timeZoneName')?.value ?? timeZone
  return (
    <div className={cn(styles.clockCard,
      'rounded-xl border border-border/60 bg-foreground/[0.025] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] dark:border-white/10 dark:bg-white/[0.045]')}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="font-medium text-sm">{label}</span>
        <span className="shrink-0 font-mono text-[10px] text-foreground/45">{zoneName}</span>
      </div>
      <time dateTime={now.toISOString()} className="block font-mono text-[26px] leading-none tracking-[-0.04em] tabular-nums">
        {formatters.time.format(now)}
      </time>
      <div className="mt-2 text-[11px] text-foreground/50">{formatters.date.format(now)}</div>
    </div>
  )
}

/** Purple orb: the clock is separate from settings and does no work while closed. */
export function WorldTimeFloatingMenu({ open, onOpenChange }: FloatingMenuControl) {
  const { language } = useLanguage()
  const text = menuLabels[language]
  const locale = languageHtmlLang[language]
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!open) return
    let timer: number | undefined
    let frame: number | undefined
    const stop = () => {
      window.clearInterval(timer)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      timer = undefined
      frame = undefined
    }
    const sync = () => {
      stop()
      if (document.visibilityState === 'hidden') return
      frame = window.requestAnimationFrame(() => setNow(new Date()))
      timer = window.setInterval(() => setNow(new Date()), 1000)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [open])

  return (
    <FloatingMenuShell kind="time" title={text.title} openLabel={text.title} closeLabel={text.close}
      open={open} onOpenChange={onOpenChange}>
      <div className="grid gap-3 px-1 py-3">
        <p className="px-2 pb-1 text-[10px] text-foreground/45">{text.subtitle}</p>
        <WorldTimeRow label={text.china} locale={locale} now={now} timeZone="Asia/Shanghai" />
        <WorldTimeRow label={text.losAngeles} locale={locale} now={now} timeZone="America/Los_Angeles" />
      </div>
    </FloatingMenuShell>
  )
}
