import { AdminBlogEditPage } from '@/ui/admin/blog/edit/[[...slug]]'

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] | undefined }>
}) {
  const slug = (await params).slug?.[0] ?? null

  return <AdminBlogEditPage slug={slug} />
}
