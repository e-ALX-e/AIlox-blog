'use client'

import type { ComponentProps, FC } from 'react'
import { FriendLinkManager } from './friend-link-manager'

export const FriendLinkPage: FC<ComponentProps<'main'>> = () => {
  return (
    <main className="flex h-[calc(100dvh-5rem)] min-h-0 w-full flex-col gap-2 pb-4">
      <FriendLinkManager />
    </main>
  )
}
