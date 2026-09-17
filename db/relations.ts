import { relations } from 'drizzle-orm'
import {
  account,
  blogs,
  blogTags,
  blogToBlogTag,
  session,
  siteComments,
  user,
  walletAddress,
} from './schema'

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  walletAddresses: many(walletAddress),
  siteComments: many(siteComments),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const walletAddressRelations = relations(walletAddress, ({ one }) => ({
  user: one(user, {
    fields: [walletAddress.userId],
    references: [user.id],
  }),
}))

export const blogsRelations = relations(blogs, ({ many }) => ({
  tagLinks: many(blogToBlogTag),
}))

export const blogTagsRelations = relations(blogTags, ({ many }) => ({
  blogLinks: many(blogToBlogTag),
}))

export const blogToBlogTagRelations = relations(blogToBlogTag, ({ one }) => ({
  blog: one(blogs, {
    fields: [blogToBlogTag.blogId],
    references: [blogs.id],
  }),
  tag: one(blogTags, {
    fields: [blogToBlogTag.tagId],
    references: [blogTags.id],
  }),
}))

export const siteCommentsRelations = relations(siteComments, ({ many, one }) => ({
  user: one(user, {
    fields: [siteComments.userId],
    references: [user.id],
  }),
  parent: one(siteComments, {
    fields: [siteComments.parentId],
    references: [siteComments.id],
    relationName: 'SiteCommentReplies',
  }),
  replies: many(siteComments, {
    relationName: 'SiteCommentReplies',
  }),
}))
