import {
  boolean,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

const dateTime = (name: string) => timestamp(name, { mode: 'date', precision: 3 })

export const friendLinkStateEnum = pgEnum('FriendLinkState', ['PENDING', 'APPROVED', 'REJECTED'])

export const siteCommentTargetTypeEnum = pgEnum('SiteCommentTargetType', ['BLOG'])

export const siteCommentStateEnum = pgEnum('SiteCommentState', ['PENDING', 'APPROVED', 'REJECTED'])

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

export const blogs = pgTable(
  'Blog',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    title: varchar('title', { length: 50 }).notNull(),
    content: text('content').notNull(),
    isPublished: boolean('isPublished').default(true).notNull(),
    createdAt: dateTime('createdAt').defaultNow().notNull(),
    updatedAt: dateTime('updatedAt').notNull(),
  },
  table => [uniqueIndex('Blog_slug_key').on(table.slug)],
)

export const blogTags = pgTable(
  'BlogTag',
  {
    id: serial('id').primaryKey(),
    tagName: varchar('tagName', { length: 20 }).notNull(),
  },
  table => [uniqueIndex('BlogTag_tagName_key').on(table.tagName)],
)

export const blogToBlogTag = pgTable(
  '_BlogToBlogTag',
  {
    blogId: integer('A')
      .notNull()
      .references(() => blogs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tagId: integer('B')
      .notNull()
      .references(() => blogTags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  },
  table => [
    primaryKey({ columns: [table.blogId, table.tagId], name: '_BlogToBlogTag_AB_pkey' }),
    index('_BlogToBlogTag_B_index').on(table.tagId),
  ],
)

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

export const siteComments = pgTable(
  'SiteComment',
  {
    id: serial('id').primaryKey(),
    targetType: siteCommentTargetTypeEnum('targetType').notNull(),
    targetId: integer('targetId').notNull(),
    parentId: integer('parentId'),
    userId: text('userId').references(() => user.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    authorName: varchar('authorName', { length: 120 }).notNull(),
    authorImage: text('authorImage'),
    content: varchar('content', { length: 500 }).notNull(),
    isDeleted: boolean('isDeleted').default(false).notNull(),
    state: siteCommentStateEnum('state').default('PENDING').notNull(),
    createdAt: dateTime('createdAt').defaultNow().notNull(),
    updatedAt: dateTime('updatedAt').notNull(),
  },
  table => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'SiteComment_parentId_fkey',
    })
      .onDelete('set null')
      .onUpdate('cascade'),
    index('SiteComment_targetType_targetId_createdAt_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    index('SiteComment_parentId_createdAt_idx').on(table.parentId, table.createdAt),
    index('SiteComment_state_createdAt_idx').on(table.state, table.createdAt),
    index('SiteComment_userId_createdAt_idx').on(table.userId, table.createdAt),
  ],
)

export const siteCommentConfig = pgTable('SiteCommentConfig', {
  id: integer('id').default(1).primaryKey(),
  autoApproveEmailUsers: boolean('autoApproveEmailUsers').default(true).notNull(),
  autoApproveWalletUsers: boolean('autoApproveWalletUsers').default(false).notNull(),
  createdAt: dateTime('createdAt').defaultNow().notNull(),
  updatedAt: dateTime('updatedAt').notNull(),
})
