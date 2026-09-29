'use client'

import type { ComponentProps } from 'react'
import { ArticleAccessControls } from './article-access-controls'
import { BlogEditForm as BlogContentForm } from './blog-edit-form-fields'

export function BlogEditForm(props: ComponentProps<typeof BlogContentForm>) {
  return (
    <div className="w-full space-y-6">
      <ArticleAccessControls articleId={props.article?.id} />
      <BlogContentForm {...props} />
    </div>
  )
}
