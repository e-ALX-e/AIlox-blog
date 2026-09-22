'use client'

import { ChevronLeft, ChevronRight, Globe2, X } from 'lucide-react'
import { AnimatePresence, type HTMLMotionProps, motion } from 'motion/react'
import { useTheme } from 'next-themes'
import { type FC, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useSound } from '@/hooks/common/use-sound'
import { uChatScrollButtonSound } from '@/lib/core/sound/u-chat-scroll-button'
import { languageHtmlLang, type Language } from '@/lib/i18n/config'
import { cn } from '@/lib/utils/common/shadcn'
import { useBackgroundMusicActions, useIsPlaying } from '@/store/use-background-music-store'
import {
  useLanguage,
  useTranslations,
} from '@/ui/components/provider/main/language-provider'
import FluidOrb from '@/ui/shadcn/fluid-orb'
import { MoonIcon } from '@/ui/shadcn/moon'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/shadcn/popover'
import { SunIcon } from '@/ui/shadcn/sun'
import { Switch } from '@/ui/shadcn/switch'
import { VolumeIcon } from '@/ui/shadcn/volume'
import { VolumeOffIcon } from '@/ui/shadcn/volume-off'
import { FloatingMenuActionButton } from './floating-menu-action-button'
import { SkyBackgroundControls } from './sky-background-controls'

const subscribePortal = (onStoreChange: () => void) => {
  const frame = requestAnimationFrame(onStoreChange)
  return () => cancelAnimationFrame(frame)
}

const getPortalSnapshot = () => document.body
const getServerPortalSnapshot = () => null

const worldTimeCopy: Record<
  Language,
  {
    title: string
    subtitle: string
    losAngeles: string
    china: string
    previous: string
    next: string
  }
> = {
  zh: {
    title: '全球时间',
    subtitle: '当前世界时间',
    losAngeles: '洛杉矶',
    china: '中国',
    previous: '上一页',
    next: '下一页',
  },
  en: {
    title: 'World Time',
    subtitle: 'Current world time',
    losAngeles: 'Los Angeles',
    china: 'China',
    previous: 'Previous page',
    next: 'Next page',
  },
  'zh-tw': {
    title: '全球時間',
    subtitle: '目前世界時間',
    losAngeles: '洛杉磯',
    china: '中國',
    previous: '上一頁',
    next: '下一頁',
  },
  ja: {
    title: '世界時計',
    subtitle: '現在の世界時刻',
    losAngeles: 'ロサンゼルス',
    china: '中国',
    previous: '前のページ',
    next: '次のページ',
  },
  ru: {
    title: 'Мировое время',
    subtitle: 'Текущее мировое время',
    losAngeles: 'Лос-Анджелес',
    china: 'Китай',
    previous: 'Предыдущая страница',
    next: 'Следующая страница',
  },
  de: {
    title: 'Weltzeit',
    subtitle: 'Aktuelle Weltzeit',
    losAngeles: 'Los Angeles',
    china: 'China',
    previous: 'Vorherige Seite',
    next: 'Nächste Seite',
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
    <div className="rounded-xl border border-border/60 bg-foreground/[0.025] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] dark:border-white/10 dark:bg-white/[0.045]">
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

// TODO: 固定底部时吸附效果
// TODO: 类似 ipad cursor ?
export const DraggableFloatingMenu: FC<HTMLMotionProps<'div'>> = ({
  className,
  onDragEnd,
  onDragStart,
  ...props
}) => {
  const translations = useTranslations()
  const { language } = useLanguage()
  const worldTime = worldTimeCopy[language]
  const locale = languageHtmlLang[language]
  const { setTheme, resolvedTheme } = useTheme()

  const isPlaying = useIsPlaying()
  const { play, pause } = useBackgroundMusicActions()

  const [playClickSoft] = useSound(uChatScrollButtonSound)
  const [isOpen, setIsOpen] = useState(false)
  const [page, setPage] = useState<0 | 1>(0)
  const [now, setNow] = useState(() => new Date())
  const [isDragging, setIsDragging] = useState(false)
  const [orbAnimationPulse, setOrbAnimationPulse] = useState(0)
  const constraintsRef = useRef<HTMLDivElement>(null)
  const portal = useSyncExternalStore(subscribePortal, getPortalSnapshot, getServerPortalSnapshot)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const playSoundEffect = () => {
    playClickSoft()
  }

  const handleMusicChange = (shouldPlay: boolean) => {
    if (shouldPlay) {
      play()
      playSoundEffect()
      return
    }

    pause()
  }

  const handleThemeChange = (nextTheme: 'light' | 'dark') => {
    if (resolvedTheme === nextTheme) return

    setTheme(nextTheme)
    playSoundEffect()
  }

  const handleOpenChange = (nextIsOpen: boolean) => {
    setIsOpen(nextIsOpen)
    setOrbAnimationPulse(value => value + 1)

    if (!nextIsOpen) {
      setPage(0)
    }
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
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
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
            'fixed bottom-[100px] left-1/2 z-100 -ml-6 size-12 touch-none select-none',
            !isOpen && 'cursor-grab active:cursor-grabbing',
            className,
          )}
          {...props}
        >
          <PopoverTrigger
            render={
              <FloatingMenuActionButton
                aria-label={
                  isOpen ? translations.common.closeQuickMenu : translations.common.openQuickMenu
                }
                className="size-12 cursor-pointer overflow-hidden border-sky-200/75 p-0 shadow-[0_8px_22px_rgba(59,130,246,0.32)] dark:border-sky-200/30 dark:shadow-[0_0_18px_rgba(96,165,250,0.2),0_10px_24px_rgba(0,0,0,0.42)]"
              />
            }
          >
            <FluidOrb
              size={48}
              color="#3b82f6"
              animationPulse={orbAnimationPulse}
              isAnimating={isDragging}
              aria-hidden
            />
            <span className="absolute top-0 left-0 size-full animate-ye-ping-one-dot-one rounded-full ring-2 ring-sky-400/75 ring-offset-1 ring-offset-background dark:ring-sky-300/70 dark:ring-offset-zinc-950" />
          </PopoverTrigger>
        </motion.div>

        <PopoverContent
          side="top"
          sideOffset={12}
          animation="fade"
          className="max-h-[min(38rem,calc(100dvh-7rem))] w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-lg border-border/60 bg-background p-2 shadow-lg dark:border-white/12 dark:bg-zinc-950 dark:shadow-[0_20px_48px_rgba(0,0,0,0.38)]"
        >
          <div className="flex h-9 items-center justify-between gap-2 px-2">
            <div className="flex min-w-0 items-center gap-2">
              {page === 1 ? (
                <Globe2 aria-hidden className="size-4 shrink-0 text-violet-500 dark:text-violet-300" />
              ) : null}
              <h2 className="truncate font-medium text-sm">
                {page === 0 ? translations.common.quickSettings : worldTime.title}
              </h2>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label={worldTime.previous}
                disabled={page === 0}
                onClick={() => setPage(0)}
                className="flex size-7 cursor-pointer items-center justify-center rounded-full text-foreground/45 transition-colors hover:bg-foreground/8 hover:text-foreground disabled:cursor-default disabled:opacity-25"
              >
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label={worldTime.next}
                disabled={page === 1}
                onClick={() => setPage(1)}
                className="flex size-7 cursor-pointer items-center justify-center rounded-full text-foreground/45 transition-colors hover:bg-foreground/8 hover:text-foreground disabled:cursor-default disabled:opacity-25"
              >
                <ChevronRight aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label={translations.common.closeQuickMenu}
                className="flex size-7 cursor-pointer items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-theme-ring"
                onClick={() => handleOpenChange(false)}
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          </div>

          <div className="relative min-h-[13rem] overflow-hidden">
            <AnimatePresence initial={false} mode="wait">
              {page === 0 ? (
                <motion.div
                  key="quick-settings"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="divide-y divide-border/60"
                >
                  <div className="flex min-h-12 items-center justify-between gap-4 px-2 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {isPlaying ? (
                        <VolumeIcon aria-hidden className="size-4.5 shrink-0" size={18} />
                      ) : (
                        <VolumeOffIcon aria-hidden className="size-4.5 shrink-0" size={18} />
                      )}
                      <span className="truncate text-sm">{translations.common.backgroundMusic}</span>
                    </div>
                    <Switch
                      checked={isPlaying}
                      onCheckedChange={handleMusicChange}
                      aria-label={
                        isPlaying ? translations.common.pauseMusic : translations.common.playMusic
                      }
                      className="cursor-pointer"
                    />
                  </div>

                  <SkyBackgroundControls />

                  <div className="flex min-h-12 items-center justify-between gap-4 px-2 py-2">
                    <span className="shrink-0 text-sm">{translations.common.appearance}</span>
                    <div
                      role="group"
                      aria-label={translations.common.appearance}
                      className="relative grid grid-cols-2 rounded-full bg-foreground/6 p-0.5 dark:bg-white/10"
                    >
                      <motion.span
                        aria-hidden
                        className="absolute top-0.5 right-1/2 bottom-0.5 left-0.5 rounded-full bg-background shadow-sm dark:bg-white/18 dark:shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
                        initial={false}
                        animate={{ x: resolvedTheme === 'dark' ? '100%' : '0%' }}
                        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
                      />
                      <button
                        type="button"
                        aria-pressed={resolvedTheme === 'light'}
                        aria-label={translations.common.switchToLightTheme}
                        className={cn(
                          'relative z-10 flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-theme-ring',
                          resolvedTheme === 'light'
                            ? 'text-foreground dark:text-white'
                            : 'text-foreground/50 hover:text-foreground/80 dark:text-zinc-400 dark:hover:text-white',
                        )}
                        onClick={() => handleThemeChange('light')}
                      >
                        <SunIcon aria-hidden className="size-3.5" size={14} />
                        {translations.common.lightTheme}
                      </button>
                      <button
                        type="button"
                        aria-pressed={resolvedTheme === 'dark'}
                        aria-label={translations.common.switchToDarkTheme}
                        className={cn(
                          'relative z-10 flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-theme-ring',
                          resolvedTheme === 'dark'
                            ? 'text-foreground dark:text-white'
                            : 'text-foreground/50 hover:text-foreground/80 dark:text-zinc-400 dark:hover:text-white',
                        )}
                        onClick={() => handleThemeChange('dark')}
                      >
                        <MoonIcon aria-hidden className="size-3.5" size={14} />
                        {translations.common.darkTheme}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="world-time"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="grid gap-2 px-1 py-1"
                >
                  <div className="px-2 pb-1 text-[10px] text-foreground/45">
                    {worldTime.subtitle}
                  </div>
                  <WorldTimeRow
                    label={worldTime.losAngeles}
                    locale={locale}
                    now={now}
                    timeZone="America/Los_Angeles"
                  />
                  <WorldTimeRow
                    label={worldTime.china}
                    locale={locale}
                    now={now}
                    timeZone="Asia/Shanghai"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex h-7 items-center justify-center gap-1.5">
            <button
              type="button"
              aria-label={translations.common.quickSettings}
              aria-current={page === 0 ? 'page' : undefined}
              onClick={() => setPage(0)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                page === 0 ? 'w-5 bg-foreground/65' : 'w-1.5 bg-foreground/20 hover:bg-foreground/35',
              )}
            />
            <button
              type="button"
              aria-label={worldTime.title}
              aria-current={page === 1 ? 'page' : undefined}
              onClick={() => setPage(1)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                page === 1 ? 'w-5 bg-violet-500/75' : 'w-1.5 bg-foreground/20 hover:bg-foreground/35',
              )}
            />
          </div>
        </PopoverContent>
      </Popover>
    </>,
    portal,
  )
}
