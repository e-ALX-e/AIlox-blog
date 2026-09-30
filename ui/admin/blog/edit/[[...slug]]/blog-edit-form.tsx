'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { articleAccessPath } from '@/lib/core/blog-access/admin-navigation'
import { BlogEditForm as BlogContentForm } from './blog-edit-form-fields'

export function BlogEditForm(props: ComponentProps<typeof BlogContentForm>) {
  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
        {props.article?.id != null ? (
          <Link href={articleAccessPath(props.article.id)} target="_blank" rel="noopener noreferrer"
            className="rounded-md border px-3 py-2 hover:bg-foreground/5">
            管理暗号与分享 ↗
          </Link>
        ) : <p className="text-muted-foreground">需要保护正文？先保存为草稿，再到「暗号与分享」设置暗号，最后发布。</p>}
      </div>
      <BlogContentForm {...props} />
    </div>
  )
}
