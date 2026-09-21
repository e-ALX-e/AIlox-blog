import type { TranslationLanguage } from '@/lib/i18n/config'
import { apiRequest } from '@/lib/infra/http/ky'

export type TranslationRatingState = {
  blogs: Array<{
    id: number
    title: string
  }>
  languages: TranslationLanguage[]
  availableTranslations: Array<{
    blogId: number
    language: TranslationLanguage
  }>
  ratings: Array<{
    blogId: number
    language: TranslationLanguage
    score: number
    updatedAt: Date | string
  }>
}

export async function getTranslationRatingState() {
  return await apiRequest<TranslationRatingState>({
    url: 'admin/translation-rating',
    method: 'GET',
  })
}

export async function updateTranslationRating(params: {
  blogId: number
  language: TranslationLanguage
  score: number | null
}) {
  return await apiRequest<{
    message: string
    rating: TranslationRatingState['ratings'][number] | null
  }>({
    url: 'admin/translation-rating',
    method: 'PATCH',
    json: params,
  })
}
