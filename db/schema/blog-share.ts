import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { dateTime } from '../columns'
import { blogAccess } from './blog-access'

// A share is a separately revocable capability, never the article's access phrase.
// Removing protection deletes its shares; re-enabling never revives old links.
export const blogShares = pgTable('BlogShare', {
  id: uuid('id').primaryKey(),
  blogId: integer('blogId').notNull().references(() => blogAccess.blogId, { onDelete: 'cascade' }),
  tokenHash: text('tokenHash').notNull(),
  accessVersion: text('accessVersion').notNull(),
  note: text('note').notNull().default(''),
  createdBy: text('createdBy').notNull(),
  createdAt: dateTime('createdAt').defaultNow().notNull(),
  expiresAt: dateTime('expiresAt').notNull(),
  revokedAt: dateTime('revokedAt'),
}, table => [index('BlogShare_blogId_idx').on(table.blogId)])
