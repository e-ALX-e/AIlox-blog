import { desc, eq } from 'drizzle-orm'
import { db } from '@/db/instance'
import { blogs } from '@/db/schema'
import { ArticleList } from './article-list'

export default async function BlogListPage() {
  const records = await db.query.blogs.findMany({
    where: eq(blogs.isPublished, true),
    orderBy: desc(blogs.createdAt),
    columns: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      tagLinks: {
        columns: {},
        with: {
          tag: true,
        },
      },
    },
  })
  const blogList = records.map(({ tagLinks, ...blog }) => ({
    ...blog,
    tags: tagLinks.map(link => link.tag),
  }))

  return <ArticleList items={blogList} />
}
