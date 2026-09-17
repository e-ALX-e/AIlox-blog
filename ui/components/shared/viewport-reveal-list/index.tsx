'use client'

import type { ReactNode } from 'react'
import { motion, useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useLanguage } from '@/ui/components/provider/main/language-provider'

const revealInterval = 100
const revealAmount = 0.2

export function ViewportRevealList({ children }: { children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const revealedItems = useRef(new WeakSet<Element>())
  const shouldReduceMotion = useReducedMotion()
  const { isLanguageChanging } = useLanguage()
  const shouldAnimate = !shouldReduceMotion && !isLanguageChanging

  useEffect(() => {
    const items = Array.from(
      scope.current.querySelectorAll<HTMLElement>('[data-viewport-reveal-item]'),
      (element, index) => ({
        element,
        content: element.firstElementChild as HTMLElement,
        index,
      }),
    )

    if (items.length === 0) return

    if (!shouldAnimate) {
      for (const item of items) {
        revealedItems.current.add(item.element)
        item.content.dataset.revealed = ''
      }
      animate(
        items.map(item => item.content),
        { opacity: 1, y: 0 },
        { duration: 0 },
      )
      return
    }

    const itemsByElement = new Map<Element, (typeof items)[number]>(
      items.map(item => [item.element, item]),
    )
    const pendingItems: (typeof items)[number][] = []
    let timer: number | null = null

    function revealNext() {
      timer = null
      let nextItem = pendingItems.shift()
      while (nextItem !== undefined && !nextItem.element.isConnected) {
        nextItem = pendingItems.shift()
      }
      if (nextItem === undefined) return

      const item = nextItem
      revealedItems.current.add(item.element)
      observer.unobserve(item.element)
      animate(
        item.content,
        { opacity: 1, y: [30, -8, 0] },
        {
          duration: 0.8,
          ease: 'easeInOut',
          onComplete: () => {
            item.content.dataset.revealed = ''
          },
        },
      )
      timer = window.setTimeout(revealNext, revealInterval)
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const item = itemsByElement.get(entry.target)
          if (item === undefined || revealedItems.current.has(item.element)) continue

          const pendingIndex = pendingItems.indexOf(item)
          if (!entry.isIntersecting || entry.intersectionRatio < revealAmount) {
            if (pendingIndex !== -1) pendingItems.splice(pendingIndex, 1)
            continue
          }
          if (pendingIndex !== -1) continue

          // Insert in DOM order once, rather than sorting on every timer tick.
          const nextIndex = pendingItems.findIndex(pending => pending.index > item.index)
          if (nextIndex === -1) pendingItems.push(item)
          else pendingItems.splice(nextIndex, 0, item)
        }
        if (timer === null && pendingItems.length > 0) {
          timer = window.setTimeout(revealNext, 0)
        }
      },
      {
        root: scope.current.closest('[data-main-scroll-container]'),
        threshold: revealAmount,
      },
    )

    for (const item of items) {
      if (!revealedItems.current.has(item.element)) observer.observe(item.element)
    }

    return () => {
      observer.disconnect()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [animate, scope, shouldAnimate])

  return (
    <div ref={scope} className="contents">
      {children}
    </div>
  )
}

export function ViewportRevealItem({
  as,
  children,
  className,
}: {
  as: 'div' | 'h3' | 'li'
  children: ReactNode
  className?: string
}) {
  const Component = as
  const Content = as === 'h3' ? motion.span : motion.div

  return (
    <Component data-viewport-reveal-item className={className}>
      <Content
        inherit={false}
        initial={{ opacity: 0, y: 40 }}
        className="pointer-events-none block w-full data-[revealed]:pointer-events-auto"
      >
        {children}
      </Content>
    </Component>
  )
}
