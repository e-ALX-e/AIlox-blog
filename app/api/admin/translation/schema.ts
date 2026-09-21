import { z } from 'zod'

export const updateTranslationConfigSchema = z
  .object({
    enabled: z.boolean(),
    baseUrl: z.string().trim(),
    model: z.string().trim(),
    apiKey: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (!value.enabled) return

    if (value.baseUrl.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message: '启用翻译前必须填写 API Base URL。',
      })
    } else if (!z.url().safeParse(value.baseUrl).success) {
      context.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message: 'API Base URL 格式不正确。',
      })
    }

    if (value.model.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['model'],
        message: '启用翻译前必须填写模型名称。',
      })
    }
  })
