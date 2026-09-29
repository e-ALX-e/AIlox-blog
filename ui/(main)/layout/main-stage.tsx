'use client'

import { type ReactNode, useState } from 'react'
import { useIsBackgroundOnly } from '@/store/use-sky-background-store'
import { Background } from './background'
import { SkyBackgroundSync } from './background/sky-background-sync'
import { DraggableFloatingMenu } from './draggable-floating-menu'
import type { FloatingMenuKind } from './draggable-floating-menu/menu-labels'
import { WorldTimeFloatingMenu } from './draggable-floating-menu/world-time-floating-menu'

export function MainStage({ children }: { children: ReactNode }) {
  const isBackgroundOnly = useIsBackgroundOnly()
  const [openMenu, setOpenMenu] = useState<FloatingMenuKind | null>(null)
  const changeMenu = (kind: FloatingMenuKind, open: boolean) => {
    // A delayed dismiss from the previous popup must not close the newly opened one.
    setOpenMenu(current => open ? kind : current === kind ? null : current)
  }

  return (
    <div
      data-background-only={isBackgroundOnly ? '' : undefined}
      className="site-main-stage relative isolate flex h-dvh max-w-screen overflow-hidden p-3 text-black transition-colors duration-300 ease-out sm:p-5 dark:text-white"
    >
      <SkyBackgroundSync />
      {children}
      <Background />
      <DraggableFloatingMenu open={openMenu === 'settings'} onOpenChange={open => changeMenu('settings', open)} />
      <WorldTimeFloatingMenu open={openMenu === 'time'} onOpenChange={open => changeMenu('time', open)} />
    </div>
  )
}
