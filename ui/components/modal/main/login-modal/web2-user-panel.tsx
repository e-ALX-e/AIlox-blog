import Image from 'next/image'
import avatar from '@/config/img/Ailoxi.png'
import { useSession } from '@/lib/core/auth/client'
import { isAdminLoggedIn } from '@/lib/core/auth/utils'
import { AdminDashboardLink } from './admin-dashboard-link'
import { LogoutButton } from './logout-button'

export const Web2UserPanel = () => {
  const { data: session } = useSession()
  const userImage = session?.user?.image?.trim()
  const userName = session?.user?.name?.trim()
  const userEmail = session?.user?.email?.trim()
  const isSessionAdmin = isAdminLoggedIn({ data: session })
  const hasUserImage = isSessionAdmin || (userImage != null && userImage.length > 0)

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-2">
      <div className="flex flex-col items-center gap-2">
        {hasUserImage && userName != null ? (
          <Image
            src={isSessionAdmin ? avatar : userImage!}
            alt={userName}
            width={64}
            height={64}
            className="size-16 rounded-full object-cover shadow-sm"
            unoptimized={!isSessionAdmin}
          />
        ) : null}
        <div className="space-y-1 text-wrap text-center">
          <p className="font-medium text-lg">{userName}</p>
          {userEmail != null && userEmail.length > 0 ? (
            <p className="text-muted-foreground text-sm">{userEmail}</p>
          ) : null}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        {isSessionAdmin ? <AdminDashboardLink /> : null}
        <LogoutButton />
      </div>
    </div>
  )
}
