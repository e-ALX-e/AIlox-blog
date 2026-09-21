import type { Friend } from './types'
import Link from 'next/link'
import { cn } from '@/lib/utils/common/shadcn'
import { useTranslations } from '@/ui/components/provider/main/language-provider'
import { ViewportRevealItem } from '@/ui/components/shared/viewport-reveal-list'
import { FriendAvatarImage } from './friend-avatar-image'

export function FriendCard({ friend, index }: { friend: Friend; index: number }) {
  const isRightAligned = index % 2 === 1
  const translations = useTranslations()

  return (
    <ViewportRevealItem
      as="li"
      className={cn('flex w-[80%] md:w-[60%]', isRightAligned && 'self-end')}
    >
      <Link
        href={friend.siteUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={translations.friends.visitSite(friend.name)}
        className={cn(
          'relative flex h-[72px] w-full items-center gap-2 rounded-xl border border-[#00000011] bg-theme-background/80 px-3 py-1.5 text-left text-zinc-900 transition-colors hover:border-theme-accent focus-visible:outline-2 focus-visible:outline-theme-ring md:h-20 md:gap-3 md:px-4 md:py-2 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-theme-accent',
          isRightAligned && 'flex-row-reverse text-right',
        )}
      >
        <FriendAvatarImage avatarUrl={friend.avatarUrl} name={friend.name} />

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-sm text-zinc-900 md:text-base dark:text-zinc-100">
            {friend.name}
          </span>

          <span className="group/description relative mt-1 block">
            <span className="block truncate text-[11px] text-zinc-500 leading-4 md:text-xs md:leading-5 dark:text-zinc-400">
              {friend.description}
            </span>

            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute top-full z-30 mt-2 w-max max-w-[min(22rem,calc(100vw-3rem))] rounded-lg border border-black/10 bg-white/95 px-3 py-2 text-left text-xs text-zinc-700 leading-5 whitespace-normal opacity-0 shadow-lg backdrop-blur-md transition-[opacity,transform] duration-150 group-hover/description:translate-y-0 group-hover/description:opacity-100 dark:border-white/10 dark:bg-zinc-900/95 dark:text-zinc-200',
                isRightAligned ? 'right-0 translate-y-1' : 'left-0 translate-y-1',
              )}
            >
              {friend.description}
            </span>
          </span>
        </span>
      </Link>
    </ViewportRevealItem>
  )
}
