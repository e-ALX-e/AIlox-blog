'use client'

import { useSyncExternalStore } from 'react'

export type PanelStyle = 'standard' | 'glass'

const storageKey = 'ailoxi:quick-menu:panel-style'
const changeEvent = 'ailoxi:quick-menu:panel-style-change'
let transientStyle: PanelStyle | null = null

function getSnapshot(): PanelStyle {
  // Keep the switch usable even when the browser blocks localStorage.
  if (transientStyle != null) return transientStyle

  try {
    return window.localStorage.getItem(storageKey) === 'glass' ? 'glass' : 'standard'
  } catch {
    return 'standard'
  }
}

function getServerSnapshot(): PanelStyle {
  return 'standard'
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      transientStyle = null
      onChange()
    }
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(changeEvent, onChange)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(changeEvent, onChange)
  }
}

function setPanelStyle(style: PanelStyle) {
  try {
    window.localStorage.setItem(storageKey, style)
    transientStyle = null
  } catch {
    transientStyle = style
  }

  // The native storage event only fires in other tabs.
  window.dispatchEvent(new Event(changeEvent))
}

export function usePanelStyle() {
  const style = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [style, setPanelStyle] as const
}
