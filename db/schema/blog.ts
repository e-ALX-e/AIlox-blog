import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'
import { dateTime } from '../columns'

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
