import { boolean, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { dateTime } from '../columns'

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('emailVerified').default(false).notNull(),
    image: text('image'),
    createdAt: dateTime('createdAt').defaultNow().notNull(),
    updatedAt: dateTime('updatedAt').notNull(),
  },
  table => [uniqueIndex('user_email_key').on(table.email)],
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: dateTime('expiresAt').notNull(),
    token: text('token').notNull(),
    createdAt: dateTime('createdAt').defaultNow().notNull(),
    updatedAt: dateTime('updatedAt').notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  },
  table => [uniqueIndex('session_token_key').on(table.token)],
)

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: dateTime('accessTokenExpiresAt'),
  refreshTokenExpiresAt: dateTime('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: dateTime('createdAt').defaultNow().notNull(),
  updatedAt: dateTime('updatedAt').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: dateTime('expiresAt').notNull(),
  createdAt: dateTime('createdAt').defaultNow().notNull(),
  updatedAt: dateTime('updatedAt').notNull(),
})

export const walletAddress = pgTable('walletAddress', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  address: text('address').notNull(),
  chainId: integer('chainId').notNull(),
  isPrimary: boolean('isPrimary').default(false).notNull(),
  createdAt: dateTime('createdAt').defaultNow().notNull(),
})
