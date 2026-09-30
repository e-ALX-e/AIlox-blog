'use client'

import { useState } from 'react'
import { ArticleAccessControls } from '@/ui/admin/blog/edit/[[...slug]]/article-access-controls'

type Section = 'protection' | 'sharing'
export function ArticleAccessManager({ articleId }: { articleId: number }) {
  const [section, setSection] = useState<Section>('protection')
  const [dirty, setDirty] = useState(false)
  return (
    <div className="space-y-5">
      <div role="group" aria-label="选择管理内容" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={section === 'protection'} onClick={() => setSection('protection')}
          className="rounded-lg border px-5 py-2.5 text-sm aria-pressed:bg-foreground aria-pressed:text-background">暗号保护</button>
        <button type="button" aria-pressed={section === 'sharing'} onClick={() => setSection('sharing')}
          className="rounded-lg border px-5 py-2.5 text-sm aria-pressed:bg-foreground aria-pressed:text-background">免暗号分享</button>
      </div>
      {dirty ? <p role="status" className="text-sm text-muted-foreground">暗号设置有未保存的修改。切换分区不会清空输入，请保存后再离开页面。</p> : null}
      <ArticleAccessControls articleId={articleId} section={section} onDirtyChange={setDirty} />
    </div>
  )
}
