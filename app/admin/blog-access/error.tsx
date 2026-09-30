'use client'

export default function AccessManagerError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto my-8 w-full max-w-3xl space-y-4 rounded-xl border p-6" role="alert">
      <h1 className="text-xl font-semibold">暂时无法读取暗号与分享</h1>
      <p className="text-sm text-muted-foreground">请稍后重试。首次升级暗号或分享功能时，需要先完成对应数据库结构更新；读取失败不会解除文章保护。</p>
      <button type="button" onClick={reset} className="rounded-md border px-4 py-2 text-sm">重新读取</button>
    </section>
  )
}
