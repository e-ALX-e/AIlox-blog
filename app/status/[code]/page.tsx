import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { statusPages } from '@/lib/common/status-pages'
import StatusPage from '@/ui/components/status-page'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function StatusPreview({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!/^\d{3}$/.test(code) || !statusPages[Number(code)]) notFound()
  return <StatusPage code={Number(code)} />
}
