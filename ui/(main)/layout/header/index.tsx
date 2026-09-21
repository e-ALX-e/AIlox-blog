'use client'

import type { ComponentProps } from 'react'
import { Languages } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  isLanguage,
  languageDisplayName,
  languageShortLabel,
  languages,
} from '@/lib/i18n/config'
import { getRoutePathname } from '@/lib/i18n/get-route-pathname'
import { cn } from '@/lib/utils/common/shadcn'
import { useHasCompletedHomeLoading, useHomeLoadingActions } from '@/store/use-home-loading-store'
import { HandwritingWordmark } from '@/ui/(main)/layout/header/handwriting-wordmark'
import { useLanguage, useTranslations } from '@/ui/components/provider/main/language-provider'
import {
  WaveLink,
  waveLinkTriggerClassName,
  waveLinkUnderlineClassName,
} from '@/ui/components/shared/wave-link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/ui/shadcn/dropdown-menu'
import { navigationConfig } from './constant'
import { useScrollVisibility } from './hooks/use-scroll-visibility'
import { NavItem } from './nav-item'

const navigationEntranceDelay = 0.08
const navigationEntranceStagger = 0.07

function getHeaderAnimation({
  isHeaderVisible,
  isWaitingForHomeLoading,
  shouldReduceMotion,
}: {
  isHeaderVisible: boolean
  isWaitingForHomeLoading: boolean
  shouldReduceMotion: boolean | null
}): ComponentProps<typeof motion.header>['animate'] {
  if (isWaitingForHomeLoading) return { opacity: 0, scale: 0.98, y: -16 }
  if (isHeaderVisible) return { opacity: 1, scale: 1, y: 0 }

  return { opacity: 0, scale: 1, y: shouldReduceMotion ? 0 : '-140%' }
}

function getHeaderTransition({
  hasEntered,
  headerEntranceDelay,
  isHeaderVisible,
  isWaitingForHomeLoading,
  shouldReduceMotion,
}: {
  hasEntered: boolean
  headerEntranceDelay: number
  isHeaderVisible: boolean
  isWaitingForHomeLoading: boolean
  shouldReduceMotion: boolean | null
}): ComponentProps<typeof motion.header>['transition'] {
  if (shouldReduceMotion || isWaitingForHomeLoading) return { duration: 0 }

  if (!hasEntered) {
    return {
      delay: headerEntranceDelay,
      duration: 0.48,
      ease: [0.16, 1, 0.3, 1],
    }
  }

  if (isHeaderVisible) return { duration: 0.22, ease: [0.22, 1, 0.36, 1] }

  return { duration: 0.18, ease: [0.4, 0, 1, 1] }
}

export default function Header() {
  const pathname = usePathname()
  const isHeaderVisible = useScrollVisibility()
  const shouldReduceMotion = useReducedMotion()
  const hasCompletedHomeLoading = useHasCompletedHomeLoading()
  const { completeHomeLoading } = useHomeLoadingActions()
  const [hasEntered, setHasEntered] = useState(false)
  const [wordmarkAnimationKey, setWordmarkAnimationKey] = useState(0)
  const { language, changeLanguage } = useLanguage()
  const translations = useTranslations()
  const languageOffset = language === 'en' ? '100%' : '-100%'
  const languagePathPrefix = `/${language}`
  const currentPathname = getRoutePathname(pathname)
  const isWaitingForHomeLoading =
    currentPathname === '/' && !hasCompletedHomeLoading && !shouldReduceMotion
  const headerEntranceDelay = currentPathname === '/' ? 0.24 : 0
  const headerAnimation = getHeaderAnimation({
    isHeaderVisible,
    isWaitingForHomeLoading,
    shouldReduceMotion,
  })
  const headerTransition = getHeaderTransition({
    hasEntered,
    headerEntranceDelay,
    isHeaderVisible,
    isWaitingForHomeLoading,
    shouldReduceMotion,
  })

  useEffect(() => {
    if (currentPathname !== '/' && !hasCompletedHomeLoading) completeHomeLoading()
  }, [completeHomeLoading, currentPathname, hasCompletedHomeLoading])

  return (
    <motion.header
      aria-hidden={isWaitingForHomeLoading}
      className={cn(
        'sticky top-5 z-20 mx-auto mt-5 mb-4 h-10 w-[calc(100%-2rem)] max-w-[550px] overflow-hidden rounded-full bg-black font-header text-white shadow-[0_4px_10px_rgba(0,0,0,0.1)] transition-[background-color,box-shadow] duration-300 sm:h-12 dark:bg-white/15 dark:shadow-[0_10px_28px_rgba(0,0,0,0.24)] dark:backdrop-blur-xl',
        (!isHeaderVisible || isWaitingForHomeLoading) && 'pointer-events-none',
      )}
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: -16 }}
      animate={headerAnimation}
      inert={isWaitingForHomeLoading}
      onAnimationComplete={() => {
        if (!isWaitingForHomeLoading && !hasEntered) setHasEntered(true)
      }}
      transition={headerTransition}
    >
      <div className="grid h-full grid-cols-[5rem_1fr] items-center sm:grid-cols-[7rem_1fr]">
        <WaveLink
          href={languagePathPrefix}
          withWaveUnderline={false}
          className="flex h-full shrink-0 items-center whitespace-nowrap pl-4 leading-none sm:pl-5"
          aria-label={translations.header.homeLabel}
          onClick={() =>
            setWordmarkAnimationKey(animationKey => animationKey + 1)
          }
        >
          <HandwritingWordmark
            key={wordmarkAnimationKey}
            delay={wordmarkAnimationKey === 0 ? headerEntranceDelay : 0}
            isVisible={!isWaitingForHomeLoading}
          />
        </WaveLink>

        <nav
          aria-label={translations.header.navigationLabel}
          className="grid h-full grid-cols-4 items-center"
        >
          {navigationConfig.map((route, routeIndex) => {
            const isActive = route.type !== 'button' && route.pattern.test(currentPathname)
            const isLanguageRoute = route.path === '/language'
            const itemClassName = cn(
              'flex h-full items-center justify-center text-xs leading-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-[-4px] sm:text-lg',
              waveLinkTriggerClassName,
              route.type === 'button' && 'cursor-pointer',
              isActive ? 'font-bold text-white' : 'font-normal text-white/90 hover:text-white',
            )

            if (isLanguageRoute) {
              return (
                <DropdownMenu key={route.path}>
                  <DropdownMenuTrigger
                    aria-label={translations.header.switchLanguageLabel}
                    className={itemClassName}
                  >
                    <motion.span
                      className="inline-flex items-center gap-1"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                      animate={
                        shouldReduceMotion || !isWaitingForHomeLoading
                          ? { opacity: 1, y: 0 }
                          : { opacity: 0, y: -8 }
                      }
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : {
                              delay:
                                headerEntranceDelay +
                                navigationEntranceDelay +
                                routeIndex * navigationEntranceStagger,
                              duration: 0.36,
                              ease: [0.22, 1, 0.36, 1],
                            }
                      }
                    >
                      <Languages aria-hidden="true" className="size-3.5 shrink-0 sm:size-4" />
                      <span className="w-6 text-center">
                        {languageShortLabel[language]}
                      </span>
                    </motion.span>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    sideOffset={10}
                    className="relative min-w-44 overflow-hidden rounded-[22px] border border-white/30 bg-white/10 p-1.5 shadow-[0_18px_55px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.58),inset_0_-1px_0_rgba(255,255,255,0.08)] ring-1 ring-black/[0.035] backdrop-blur-[30px] backdrop-saturate-200 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_22%_8%,rgba(255,255,255,0.48),transparent_34%),linear-gradient(155deg,rgba(255,255,255,0.18),rgba(255,255,255,0.03)_48%,rgba(80,180,255,0.07))] before:content-[''] after:pointer-events-none after:absolute after:inset-[1px] after:rounded-[20px] after:border after:border-white/20 after:content-[''] dark:border-white/14 dark:bg-black/12 dark:ring-white/[0.03] dark:shadow-[0_18px_58px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.14)] dark:before:bg-[radial-gradient(circle_at_22%_8%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(155deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01)_52%,rgba(80,180,255,0.06))] dark:after:border-white/8"
                  >
                    <DropdownMenuRadioGroup
                      value={language}
                      onValueChange={value => {
                        if (isLanguage(value)) {
                          changeLanguage(value)
                        }
                      }}
                    >
                      {languages.map(locale => (
                        <DropdownMenuRadioItem
                          key={locale}
                          value={locale}
                          className="relative z-10 cursor-pointer rounded-xl border border-transparent bg-transparent text-zinc-800 transition-[background-color,border-color,box-shadow,transform] duration-200 focus:scale-[1.015] focus:border-white/25 focus:bg-white/16 focus:text-zinc-950 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_6px_18px_rgba(31,41,55,0.05)] data-checked:border-white/30 data-checked:bg-white/18 data-checked:shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_7px_20px_rgba(31,41,55,0.055)] dark:text-zinc-100 dark:focus:border-white/12 dark:focus:bg-white/8 dark:focus:text-white dark:data-checked:border-white/14 dark:data-checked:bg-white/9 dark:data-checked:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_7px_22px_rgba(0,0,0,0.16)]"
                        >
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                            <span>{languageDisplayName[locale]}</span>
                            <span className="font-mono text-[10px] text-muted-foreground uppercase">
                              {locale}
                            </span>
                          </span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            }

            return (
              <NavItem
                key={route.path}
                item={route}
                aria-current={isActive ? 'page' : undefined}
                aria-label={translations.header.routes[route.pathName]}
                className={itemClassName}
              >
                <motion.span
                  className={cn(
                    waveLinkUnderlineClassName,
                    'after:-bottom-1 after:bg-[color-mix(in_srgb,var(--theme-accent)_50%,white)]',
                    'inline-flex items-center',
                    isActive && 'after:[clip-path:inset(0)]',
                  )}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                  animate={
                    shouldReduceMotion || !isWaitingForHomeLoading
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: -8 }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : {
                          delay:
                            headerEntranceDelay +
                            navigationEntranceDelay +
                            routeIndex * navigationEntranceStagger,
                          duration: 0.36,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                >
                  <span className="grid h-[1.25em] overflow-hidden whitespace-nowrap leading-[1.25]">
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={language}
                        aria-hidden="true"
                        className="col-start-1 row-start-1 flex items-center justify-center"
                        initial={shouldReduceMotion ? false : { opacity: 0, y: languageOffset }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: languageOffset }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
                        }
                      >
                        {translations.header.routes[route.pathName]}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </motion.span>
              </NavItem>
            )
          })}
        </nav>
      </div>
    </motion.header>
  )
}
