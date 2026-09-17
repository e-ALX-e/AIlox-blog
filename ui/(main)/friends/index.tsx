import type { Friend } from './types'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/instance'
import { friendLinks } from '@/db/schema'
import { MainEmptyState } from '@/ui/components/shared/main-empty-state'
import { MainScrollBlur } from '@/ui/components/shared/main-scroll-blur'
import { FriendApplyButton } from './friend-apply-button'
import { FriendsList } from './friends-list'

export async function FriendsPage() {
  const friends: Friend[] = await db
    .select({
      id: friendLinks.id,
      name: friendLinks.name,
      description: friendLinks.description,
      avatarUrl: friendLinks.avatarUrl,
      siteUrl: friendLinks.siteUrl,
    })
    .from(friendLinks)
    .where(eq(friendLinks.state, 'APPROVED'))
    .orderBy(sql`random()`)

  return (
    <>
      <section className="mx-auto flex w-full max-w-2xl flex-col px-1 py-4 sm:px-4">
        <div className="mb-6 flex justify-center">
          <FriendApplyButton />
        </div>

        {friends.length > 0 ? (
          <FriendsList friends={friends} />
        ) : (
          <MainEmptyState className="m-auto py-24 text-zinc-600 dark:text-zinc-400" />
        )}
      </section>
      <MainScrollBlur />
    </>
  )
}
