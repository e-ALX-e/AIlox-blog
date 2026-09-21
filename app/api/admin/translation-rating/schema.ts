import { z } from 'zod'
import { translationLanguages } from '@/lib/i18n/config'

export const updateTranslationRatingSchema = z.object({
  blogId: z.coerce.number().int().positive(),
  language: z.enum(translationLanguages),
  score: z.number().int().min(1).max(5).nullable(),
})
