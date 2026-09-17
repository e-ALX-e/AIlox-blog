import {
  boolean,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  varchar,
} from 'drizzle-orm/pg-core'
import { dateTime } from '../columns'
import { user } from './auth'

export const siteCommentTargetTypeEnum = pgEnum('SiteCommentTargetType', ['BLOG'])

export const siteCommentStateEnum = pgEnum('SiteCommentState', ['PENDING', 'APPROVED', 'REJECTED'])

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
