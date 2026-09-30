import type { Metadata } from 'next'
import Link from 'next/link'
import { getAdminAccessList } from '@/lib/core/blog-access/admin-list'
import { accessListHref, accessManagerPath, articleAccessPath, parseAccessListQuery, type AccessSearchParams } from '@/lib/core/blog-access/admin-navigation'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '暗号与分享', robots: { index: false, follow: false } }

export default async function Page({ searchParams }: { searchParams: Promise<AccessSearchParams> }) {
  const query = parseAccessListQuery(await searchParams)
  const { articles, total, page, pages } = await getAdminAccessList(query)

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">暗号与分享</h1>
        <p className="text-sm text-muted-foreground">在这里管理文章暗号、管理员免验证和免暗号分享。文章编辑页只负责内容编写，标题始终公开。</p>
      </header>
      <form action={accessManagerPath} method="get" className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
        <label htmlFor="access-search" className="min-w-0 flex-1 basis-64 space-y-2 text-sm">
          <span className="block">查找文章</span>
          <input key={query.q} id="access-search" name="q" type="search" maxLength={100} defaultValue={query.q}
            placeholder="搜索标题或 slug" className="h-10 w-full rounded-md border bg-background px-3" />
        </label>
        <label htmlFor="access-filter" className="space-y-2 text-sm">
          <span className="block">筛选</span>
          <select key={query.filter} id="access-filter" name="filter" defaultValue={query.filter} className="h-10 rounded-md border bg-background px-3">
            <option value="all">全部文章</option><option value="protected">已设暗号</option>
            <option value="public">公开阅读</option><option value="draft">草稿</option>
          </select>
        </label>
        <button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm text-background">搜索</button>
        <Link href={accessManagerPath} className="flex h-10 items-center rounded-md border px-4 text-sm">重置</Link>
      </form>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground" role="status">共 {total} 篇文章</p>
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">文章访问保护和分享管理列表</caption>
            <thead className="border-b bg-foreground/[0.03]"><tr>
              <th scope="col" className="px-4 py-3">文章</th><th scope="col" className="px-4 py-3">发布状态</th>
              <th scope="col" className="px-4 py-3">阅读权限</th><th scope="col" className="px-4 py-3">操作</th>
            </tr></thead>
            <tbody>{articles.map(article => (
              <tr key={article.id} className="border-b last:border-0">
                <td className="max-w-lg break-words px-4 py-4">
                  <Link href={articleAccessPath(article.id)} className="font-medium hover:underline">{article.title}</Link>
                  <p className="mt-1 break-all text-xs text-muted-foreground">#{article.id} · {article.slug}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-4">{article.isPublished ? '已发布' : '草稿'}</td>
                <td className="px-4 py-4">
                  {article.protectedId != null ? '需要暗号' : article.isPublished ? '公开阅读' : '未设暗号'}
                  {article.protectedId != null && article.adminBypass === true ? <p className="mt-1 text-xs text-muted-foreground">管理员免验证</p> : null}
                </td>
                <td className="px-4 py-4"><div className="flex flex-wrap gap-3">
                  <Link href={articleAccessPath(article.id)} className="whitespace-nowrap underline underline-offset-4">管理暗号与分享</Link>
                  <Link href={`/admin/blog/edit/${encodeURIComponent(article.slug)}`} className="whitespace-nowrap text-muted-foreground hover:underline">编辑内容</Link>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
          {articles.length === 0 ? <p className="px-4 py-12 text-center text-sm text-muted-foreground">没有找到文章。可以调整筛选，或先在文章编辑页保存一篇草稿。</p> : null}
        </div>
        <nav aria-label="文章分页" className="flex items-center justify-end gap-4 text-sm">
          {page > 1 ? <Link href={accessListHref(query, page - 1)} className="rounded-md border px-3 py-2">上一页</Link> : null}
          <span>第 {page} / {pages} 页</span>
          {page < pages ? <Link href={accessListHref(query, page + 1)} className="rounded-md border px-3 py-2">下一页</Link> : null}
        </nav>
      </div>
    </div>
  )
}
