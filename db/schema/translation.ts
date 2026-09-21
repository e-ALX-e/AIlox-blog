import { boolean, integer, pgTable, primaryKey, serial, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { dateTime } from '../columns'
import { blogs } from './blog'

export const translationModelConfig = pgTable('TranslationModelConfig', {
  id: integer('id').primaryKey(),
  enabled: boolean('enabled').default(false).notNull(),
  baseUrl: varchar('baseUrl', { length: 500 }).default('').notNull(),
  model: varchar('model', { length: 200 }).default('').notNull(),
  apiKeyEncrypted: text('apiKeyEncrypted'),
  createdAt: dateTime('createdAt').defaultNow().notNull(),
  updatedAt: dateTime('updatedAt').defaultNow().notNull(),
})

export const blogTranslations = pgTable(
  'BlogTranslation',
  {
    blogId: integer('blogId')
      .notNull()
      .references(() => blogs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    language: varchar('language', { length: 16 }).notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    content: text('content').notNull(),
    sourceUpdatedAt: dateTime('sourceUpdatedAt').notNull(),
    translatedAt: dateTime('translatedAt').defaultNow().notNull(),
  },
  table => [
    primaryKey({
      columns: [table.blogId, table.language],
      name: 'BlogTranslation_blogId_language_pkey',
    }),
  ],
)

export const translationUsage = pgTable('TranslationUsage', {
  id: serial('id').primaryKey(),
  blogId: integer('blogId').references(() => blogs.id, {
    onDelete: 'set null',
    onUpdate: 'cascade',
  }),
  language: varchar('language', { length: 16 }).notNull(),
  model: varchar('model', { length: 200 }).notNull(),
  promptTokens: integer('promptTokens').default(0).notNull(),
  completionTokens: integer('completionTokens').default(0).notNull(),
  totalTokens: integer('totalTokens').default(0).notNull(),
  createdAt: dateTime('createdAt').defaultNow().notNull(),
})


export const translationTasks = pgTable(
  'TranslationTask',
  {
    id: serial('id').primaryKey(),
    blogId: integer('blogId')
      .notNull()
      .references(() => blogs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    language: varchar('language', { length: 16 }).notNull(),
    sourceUpdatedAt: dateTime('sourceUpdatedAt').notNull(),
    status: varchar('status', { length: 16 }).default('queued').notNull(),
    force: boolean('force').default(false).notNull(),
    attempts: integer('attempts').default(0).notNull(),
    error: text('error'),
    startedAt: dateTime('startedAt'),
    finishedAt: dateTime('finishedAt'),
    createdAt: dateTime('createdAt').defaultNow().notNull(),
    updatedAt: dateTime('updatedAt').defaultNow().notNull(),
  },
  table => [
    uniqueIndex('TranslationTask_blog_language_source_key').on(
      table.blogId,
      table.language,
      table.sourceUpdatedAt,
    ),
  ],
)
