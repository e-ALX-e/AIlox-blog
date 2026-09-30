/** Non-secret URL helpers shared by the editor, list and access manager. */
export const accessManagerPath = '/admin/blog-access'
export const accessListPageSize = 20
export type AccessListFilter = 'all' | 'protected' | 'public' | 'draft'
export type AccessListQuery = { q: string; filter: AccessListFilter; page: number }
export type AccessSearchParams = Record<string, string | string[] | undefined>

export function parseArticleId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return null
  const id = Number(value)
  return id <= 2147483647 ? id : null
}

export function articleAccessPath(id: number): string {
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new Error('文章编号无效。')
  return `${accessManagerPath}/${id}`
}

export function parseAccessListQuery(params: AccessSearchParams): AccessListQuery {
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : ''
  const filter = params.filter === 'protected' || params.filter === 'public' || params.filter === 'draft'
    ? params.filter : 'all'
  const requestedPage = typeof params.page === 'string' && /^[1-9]\d{0,5}$/.test(params.page)
    ? Number(params.page) : 1
  return { q, filter, page: requestedPage }
}

export function accessListHref(query: AccessListQuery, page: number): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.filter !== 'all') params.set('filter', query.filter)
  if (page > 1) params.set('page', String(page))
  const suffix = params.toString()
  return suffix ? `${accessManagerPath}?${suffix}` : accessManagerPath
}

/** Treat user-entered LIKE wildcards as literal characters. Values remain bound parameters. */
export function accessSearchPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, '\\$&')}%`
}
