import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { dateTime } from '../columns'
import { blogs } from './blog'

// Separate from Blog so existing article DTOs can never spread a code hash.
export const blogAccess = pgTable('BlogAccess', {
  blogId: integer('blogId').primaryKey().references(() => blogs.id, { onDelete: 'cascade' }),
  codeHash: text('codeHash').notNull(),
  updatedAt: dateTime('updatedAt').defaultNow().notNull(),
})

// A bounded, database-backed article-wide budget. Does not trust forwarded IPs.
export const blogUnlockBudget = pgTable('BlogUnlockBudget', {
  blogId: integer('blogId').primaryKey().references(() => blogs.id, { onDelete: 'cascade' }),
  attempts: integer('attempts').notNull().default(0),
  resetsAt: dateTime('resetsAt').notNull(),
})
