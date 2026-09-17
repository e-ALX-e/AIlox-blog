import { index, pgEnum, pgTable, serial, text, varchar } from 'drizzle-orm/pg-core'
import { dateTime } from '../columns'

export const friendLinkStateEnum = pgEnum('FriendLinkState', ['PENDING', 'APPROVED', 'REJECTED'])

export const friendLinks = pgTable(
  'FriendLink',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).notNull(),
    email: varchar('email', { length: 254 }),
    description: varchar('description', { length: 120 }).notNull(),
    avatarUrl: text('avatarUrl').notNull(),
    siteUrl: text('siteUrl').notNull(),
    state: friendLinkStateEnum('state').default('PENDING').notNull(),
    createdAt: dateTime('createdAt').defaultNow().notNull(),
    updatedAt: dateTime('updatedAt').notNull(),
  },
  table => [
    index('FriendLink_state_createdAt_idx').on(table.state, table.createdAt),
    index('FriendLink_state_updatedAt_idx').on(table.state, table.updatedAt),
  ],
)
