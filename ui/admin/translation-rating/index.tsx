'use client'

import { Loader2, Star, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { sileo } from 'sileo'
import {
  getTranslationRatingState,
  type TranslationRatingState,
  updateTranslationRating,
} from '@/lib/api/translation/rating'
import { languageDisplayName, type TranslationLanguage } from '@/lib/i18n/config'
import { cn } from '@/lib/utils/common/shadcn'

function cellKey(blogId: number, language: string) {
  return `${blogId}:${language}`
}

export function AdminTranslationRatingPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [blogs, setBlogs] = useState<TranslationRatingState['blogs']>([])
  const [languages, setLanguages] = useState<TranslationLanguage[]>([])
  const [availableTranslations, setAvailableTranslations] = useState<Set<string>>(new Set())
  const [ratings, setRatings] = useState<Map<string, number>>(new Map())
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true

    void getTranslationRatingState()
      .then(data => {
        if (!active) return

        setBlogs(data.blogs)
        setLanguages(data.languages)
        setAvailableTranslations(
          new Set(
            data.availableTranslations.map(item =>
              cellKey(item.blogId, item.language),
            ),
          ),
        )
        setRatings(
          new Map(
            data.ratings.map(item => [
              cellKey(item.blogId, item.language),
              item.score,
            ]),
          ),
        )
      })
      .catch(error => {
        sileo.error({
          title: error instanceof Error ? error.message : '加载翻译评分失败',
        })
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const ratedCount = useMemo(() => ratings.size, [ratings])
  const availableCount = useMemo(
    () => availableTranslations.size,
    [availableTranslations],
  )

  const saveRating = async (
    blogId: number,
    language: TranslationLanguage,
    score: number | null,
  ) => {
    const key = cellKey(blogId, language)

    setSavingCells(previous => new Set(previous).add(key))

    try {
      await updateTranslationRating({
        blogId,
        language,
        score,
      })

      setRatings(previous => {
        const next = new Map(previous)

        if (score == null) next.delete(key)
        else next.set(key, score)

        return next
      })
    } catch (error) {
      sileo.error({
        title: error instanceof Error ? error.message : '保存评分失败',
      })
    } finally {
      setSavingCells(previous => {
        const next = new Set(previous)
        next.delete(key)
        return next
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-[calc(100vw-3rem)] flex-col gap-5 py-4 pb-12">
      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-semibold text-xl">翻译评分</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              横向为博客，纵向为目标语言。满意度默认留空，由管理员按 1–5 星评分；未生成译文的单元格不可评分。
            </p>
          </div>

          <div className="text-muted-foreground text-xs">
            已评分 {ratedCount} / {availableCount}
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-xl border bg-card shadow-xs">
        <div className="max-h-[calc(100vh-14rem)] overflow-auto">
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 min-w-40 border-r border-b bg-card px-4 py-3 text-left font-medium">
                  语言 \ 博客
                </th>
                {blogs.map(blog => (
                  <th
                    key={blog.id}
                    className="sticky top-0 z-20 min-w-52 max-w-52 border-r border-b bg-card px-4 py-3 text-left font-medium last:border-r-0"
                  >
                    <span className="block truncate" title={blog.title}>
                      #{blog.id} {blog.title}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {languages.map(language => (
                <tr key={language}>
                  <th className="sticky left-0 z-10 border-r border-b bg-card px-4 py-3 text-left font-medium last:border-b-0">
                    <span className="whitespace-nowrap">
                      {languageDisplayName[language]}
                    </span>
                  </th>

                  {blogs.map(blog => {
                    const key = cellKey(blog.id, language)
                    const available = availableTranslations.has(key)
                    const score = ratings.get(key) ?? null
                    const isSaving = savingCells.has(key)

                    return (
                      <td
                        key={blog.id}
                        className="min-w-52 border-r border-b px-3 py-3 align-middle last:border-r-0"
                      >
                        {!available ? (
                          <span className="text-muted-foreground/60 text-xs">
                            未生成
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <div
                              className="flex items-center"
                              aria-label={
                                score == null
                                  ? '未评分'
                                  : `当前评分 ${score} 星`
                              }
                            >
                              {[1, 2, 3, 4, 5].map(value => (
                                <button
                                  key={value}
                                  type="button"
                                  disabled={isSaving}
                                  title={`${value} 星`}
                                  aria-label={`评分 ${value} 星`}
                                  onClick={() =>
                                    void saveRating(blog.id, language, value)
                                  }
                                  className="rounded-sm p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
                                >
                                  <Star
                                    className={cn(
                                      'size-4 transition-colors',
                                      score != null && value <= score
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-zinc-300 hover:text-amber-300 dark:text-zinc-700',
                                    )}
                                  />
                                </button>
                              ))}
                            </div>

                            {score != null ? (
                              <button
                                type="button"
                                disabled={isSaving}
                                title="清空评分"
                                aria-label="清空评分"
                                onClick={() =>
                                  void saveRating(blog.id, language, null)
                                }
                                className="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                              >
                                {isSaving ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <X className="size-3.5" />
                                )}
                              </button>
                            ) : isSaving ? (
                              <Loader2 className="ml-1 size-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <span className="ml-1 text-muted-foreground text-[10px]">
                                未评分
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {languages.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={Math.max(blogs.length + 1, 1)}
                  >
                    暂无可评分语言。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
