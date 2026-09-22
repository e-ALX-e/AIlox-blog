'use client'

import { Globe2, X } from 'lucide-react'
import { type HTMLMotionProps, motion } from 'motion/react'
import { type FC, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  languageHtmlLang,
  type Language,
} from '@/lib/i18n/config'
import { cn } from '@/lib/utils/common/shadcn'
import { useLanguage } from '@/ui/components/provider/main/language-provider'
import FluidOrb from '@/ui/shadcn/fluid-orb'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/shadcn/popover'
import { FloatingMenuActionButton } from './draggable-floating-menu/floating-menu-action-button'

const subscribePortal = (onStoreChange: () => void) => {
  const frame = requestAnimationFrame(onStoreChange)
  return () => cancelAnimationFrame(frame)
}

const getPortalSnapshot = () => document.body
const getServerPortalSnapshot = () => null

const copy: Record<
  Language,
  {
    title: string
    subtitle: string
    losAngeles: string
    china: string
    open: string
    close: string
  }
> = {
  zh: {
    title: '全球时间',
    subtitle: '当前世界时间',
    losAngeles: '洛杉矶',
    china: '中国',
    open: '打开全球时间',
    close: '关闭全球时间',
  },
  en: {
    title: 'World Time',
    subtitle: 'Current world time',
    losAngeles: 'Los Angeles',
    china: 'China',
    open: 'Open world time',
    close: 'Close world time',
  },
  'zh-tw': {
    title: '全球時間',
    subtitle: '目前世界時間',
    losAngeles: '洛杉磯',
    china: '中國',
    open: '打開全球時間',
    close: '關閉全球時間',
  },
  ja: {
    title: '世界時計',
    subtitle: '現在の世界時刻',
    losAngeles: 'ロサンゼルス',
    china: '中国',
    open: '世界時計を開く',
    close: '世界時計を閉じる',
  },
  ru: {
    title: 'Мировое время',
    subtitle: 'Текущее мировое время',
    losAngeles: 'Лос-Анджелес',
    china: 'Китай',
    open: 'Открыть мировое время',
    close: 'Закрыть мировое время',
  },
  de: {
    title: 'Weltzeit',
    subtitle: 'Aktuelle Weltzeit',
    losAngeles: 'Los Angeles',
    china: 'China',
    open: 'Weltzeit öffnen',
    close: 'Weltzeit schließen',
  },
}

function formatTime(now: Date, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
}

function formatDate(now: Date, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(now)
}

function formatZoneName(now: Date, timeZone: string, locale: string) {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(now)

  return parts.find(part => part.type === 'timeZoneName')?.value ?? timeZone
}

function WorldTimeRow({
  label,
  locale,
  now,
  timeZone,
}: {
  label: string
  locale: string
  now: Date
  timeZone: string
}) {
  return (
    <div className="rounded-xl border border-white/25 bg-white/10 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] dark:border-white/10 dark:bg-white/[0.045]">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="font-medium text-sm">{label}</span>
        <span className="shrink-0 font-mono text-[10px] text-foreground/45">
          {formatZoneName(now, timeZone, locale)}
        </span>
      </div>

      <div className="font-mono text-[26px] leading-none tracking-[-0.04em] tabular-nums">
        {formatTime(now, timeZone, locale)}
      </div>

      <div className="mt-2 text-[11px] text-foreground/50">
        {formatDate(now, timeZone, locale)}
      </div>
    </div>
  )
}

export const WorldTimeFloatingMenu: FC<HTMLMotionProps<'div'>> = ({
  className,
  onDragEnd,
  onDragStart,
  ...props
}) => {
  const { language } = useLanguage()
  const text = copy[language]
  const locale = languageHtmlLang[language]

  const [now, setNow] = useState(() => new Date())
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [orbAnimationPulse, setOrbAnimationPulse] = useState(0)

  const constraintsRef = useRef<HTMLDivElement>(null)
  const portal = useSyncExternalStore(
    subscribePortal,
    getPortalSnapshot,
    getServerPortalSnapshot,
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const handleOpenChange = (nextIsOpen: boolean) => {
    setIsOpen(nextIsOpen)
    setOrbAnimationPulse(value => value + 1)
  }

  if (portal == null) return null

  return createPortal(
    <>
      <div
        ref={constraintsRef}
        className="pointer-events-none fixed top-20 right-4 bottom-4 left-4 sm:right-5 sm:left-5"
      />

      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <motion.div
          drag={!isOpen}
          dragConstraints={constraintsRef}
          dragElastic={0.08}
          dragMomentum={false}
          dragTransition={{ bounceStiffness: 500, bounceDamping: 30 }}
          whileDrag={{ scale: 1.04 }}
          initial={{ scale: 0.2, y: 100, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 20,
            delay: 0.08,
          }}
          onDragStart={(event, info) => {
            setIsDragging(true)
            onDragStart?.(event, info)
          }}
          onDragEnd={(event, info) => {
            setIsDragging(false)
            setOrbAnimationPulse(value => value + 1)
            onDragEnd?.(event, info)
          }}
          className={cn(
            'fixed right-6 bottom-[92px] z-100 size-12 touch-none select-none sm:right-10 md:right-[72px]',
            !isOpen && 'cursor-grab active:cursor-grabbing',
            className,
          )}
          {...props}
        >
          <PopoverTrigger
            render={
              <FloatingMenuActionButton
                aria-label={isOpen ? text.close : text.open}
                className="size-12 cursor-pointer overflow-hidden border-violet-200/75 p-0 shadow-[0_8px_22px_rgba(139,92,246,0.32)] dark:border-violet-200/30 dark:shadow-[0_0_18px_rgba(167,139,250,0.2),0_10px_24px_rgba(0,0,0,0.42)]"
              />
            }
          >
            <FluidOrb
              size={48}
              color="#8b5cf6"
              animationPulse={orbAnimationPulse}
              isAnimating={isDragging}
              aria-hidden
            />
            <span className="absolute top-0 left-0 size-full animate-ye-ping-one-dot-one rounded-full ring-2 ring-violet-400/75 ring-offset-1 ring-offset-background dark:ring-violet-300/70 dark:ring-offset-zinc-950" />
          </PopoverTrigger>
        </motion.div>

        <PopoverContent
          side="top"
          sideOffset={12}
          animation="fade"
          className="w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-[22px] border border-white/35 bg-white/12 p-2 shadow-[0_20px_60px_rgba(67,56,202,0.18),inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-black/[0.035] backdrop-blur-[30px] backdrop-saturate-200 dark:border-white/12 dark:bg-zinc-950/28 dark:shadow-[0_22px_64px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.12)]"
        >
          <div className="flex h-11 items-center justify-between px-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-violet-300/30 bg-violet-400/10 text-violet-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:text-violet-300">
                <Globe2 aria-hidden className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="font-medium text-sm">{text.title}</h2>
                <p className="truncate text-[10px] text-foreground/45">
                  {text.subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label={text.close}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full text-foreground/45 transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-violet-400/60"
              onClick={() => handleOpenChange(false)}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>

          <div className="grid gap-2 p-1">
            <WorldTimeRow
              label={text.losAngeles}
              locale={locale}
              now={now}
              timeZone="America/Los_Angeles"
            />
            <WorldTimeRow
              label={text.china}
              locale={locale}
              now={now}
              timeZone="Asia/Shanghai"
            />
          </div>
        </PopoverContent>
      </Popover>
    </>,
    portal,
  )
}
