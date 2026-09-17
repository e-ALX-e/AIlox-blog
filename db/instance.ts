import 'server-only'

import { drizzle } from 'drizzle-orm/node-postgres'
import { serverEnv } from '@/config/env/server-env'
import {
  accountRelations,
  blogsRelations,
  blogTagsRelations,
  blogToBlogTagRelations,
  sessionRelations,
  siteCommentsRelations,
  userRelations,
  walletAddressRelations,
} from './relations'
import * as schema from './schema'

const normalizeConnectionString = (connectionString: string) => {
  const url = new URL(connectionString)
  const sslmode = url.searchParams.get('sslmode')?.toLowerCase()

  if (sslmode === 'prefer' || sslmode === 'require' || sslmode === 'verify-ca') {
    url.searchParams.set('sslmode', 'verify-full')
    return url.toString()
  }

  return connectionString
}

export const db = drizzle(normalizeConnectionString(serverEnv.DATABASE_URL), {
  schema: {
    ...schema,
    accountRelations,
    blogsRelations,
    blogTagsRelations,
    blogToBlogTagRelations,
    sessionRelations,
    siteCommentsRelations,
    userRelations,
    walletAddressRelations,
  },
})
