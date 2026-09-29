'use client'

import { Popover } from '@base-ui/react/popover'
import { Globe2, Layers, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '@/ui/components/provider/main/language-provider'
import FluidOrb from '@/ui/shadcn/fluid-orb'
import { FloatingMenuActionButton } from './floating-menu-action-button'
import { type FloatingMenuControl, type FloatingMenuKind, menuLabels } from './menu-labels'
import styles from './panel.module.css'
import { usePanelStyle } from './use-panel-style'

const subscribePortal = (notify: () => void) => {
  const frame = requestAnimationFrame(notify)
  return () => cancelAnimationFrame(frame)
}
const getPortalSnapshot = () => document.body
const getServerPortalSnapshot = () => null
const compactQuery = '(max-width: 480px)'
const subscribeCompact = (notify: () => void) => {
  const media = window.matchMedia(compactQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const getCompactSnapshot = () => window.matchMedia(compactQuery).matches
const getServerCompactSnapshot = () => true

/** Common appearance and drag behavior, with one independent trigger per feature. */
export function FloatingMenuShell({
  kind, title, openLabel, closeLabel, open, onOpenChange, children,
}: FloatingMenuControl & {
  kind: FloatingMenuKind
  title: string
  openLabel: string
  closeLabel: string
  children: ReactNode
}) {
  const { language } = useLanguage()
  const labels = menuLabels[language]
  const [panelStyle, setPanelStyle] = usePanelStyle()
  const reducedMotion = useReducedMotion()
  const compact = useSyncExternalStore(subscribeCompact, getCompactSnapshot, getServerCompactSnapshot)
  const [isDragging, setIsDragging] = useState(false)
  const [orbAnimationPulse, setOrbAnimationPulse] = useState(0)
  const constraintsRef = useRef<HTMLDivElement>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const portal = useSyncExternalStore(subscribePortal, getPortalSnapshot, getServerPortalSnapshot)

  if (portal == null) return null

  return createPortal(
    <>
      <div ref={constraintsRef} className={styles.dragBounds} aria-hidden="true" />
      <Popover.Root open={open} onOpenChange={next => {
        if (next && suppressClick.current) return
        setOrbAnimationPulse(value => value + 1)
        onOpenChange(next)
      }}>
        <motion.div
          data-floating-menu={kind}
          className={styles.orb}
          drag={!open}
          dragConstraints={constraintsRef}
          dragElastic={0.08}
          dragMomentum={false}
          dragTransition={{ bounceStiffness: 500, bounceDamping: 30 }}
          whileDrag={reducedMotion ? undefined : { scale: 1.04 }}
          initial={reducedMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          onPointerDownCapture={event => {
            pointerStart.current = { x: event.clientX, y: event.clientY }
            suppressClick.current = false
          }}
          onPointerMoveCapture={event => {
            if (!open && pointerStart.current && Math.hypot(
              event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y,
            ) > 6) suppressClick.current = true
          }}
          onPointerUpCapture={() => { pointerStart.current = null }}
          onPointerCancelCapture={() => { pointerStart.current = null }}
          onKeyDownCapture={event => {
            if (event.key === 'Enter' || event.key === ' ') suppressClick.current = false
          }}
          onClickCapture={event => {
            // A drag is not a click; keyboard activation (detail=0) still works.
            if (suppressClick.current && event.detail !== 0) {
              event.preventDefault()
              event.stopPropagation()
            }
            suppressClick.current = false
          }}
          onDragStart={() => { suppressClick.current = true; setIsDragging(true) }}
          onDragEnd={() => {
            setIsDragging(false)
            setOrbAnimationPulse(value => value + 1)
          }}
        >
          <Popover.Trigger render={
            <FloatingMenuActionButton
              aria-label={open ? closeLabel : openLabel}
              title={title}
              className={styles.orbButton}
            />
          }>
            <FluidOrb size={48} color={kind === 'time' ? '#8b5cf6' : '#3b82f6'}
              animationPulse={reducedMotion ? 0 : orbAnimationPulse}
              isAnimating={!reducedMotion && isDragging} aria-hidden />
            <span aria-hidden className={styles.orbRing} />
          </Popover.Trigger>
        </motion.div>

        <Popover.Portal>
          <Popover.Positioner side={compact ? 'top' : 'left'} align="end" sideOffset={12} collisionPadding={16}
            className={styles.positioner}>
            <Popover.Popup data-surface={panelStyle} data-menu={kind} className={styles.panel}>
              <div className={styles.header}>
                <div className="flex min-w-0 items-center gap-2">
                  {kind === 'time' ? <Globe2 aria-hidden className="size-4 shrink-0 text-violet-500 dark:text-violet-300" /> : null}
                  <Popover.Title className="truncate font-medium text-sm">{title}</Popover.Title>
                </div>
                <Popover.Close aria-label={closeLabel} className={styles.closeButton}>
                  <span aria-hidden>×</span>
                </Popover.Close>
              </div>
              <div role="group" aria-label={labels.panelStyle} className={styles.styleBar}>
                <button type="button" aria-pressed={panelStyle === 'standard'}
                  onClick={() => setPanelStyle('standard')} className={styles.styleButton}>
                  <Layers aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">{labels.standard}</span>
                </button>
                <button type="button" aria-pressed={panelStyle === 'glass'}
                  onClick={() => setPanelStyle('glass')} className={styles.styleButton}>
                  <Sparkles aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">{labels.liquidGlass}</span>
                </button>
              </div>
              <div className={styles.viewport}>
                <div className={styles.page}>{children}</div>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>, portal,
  )
}
