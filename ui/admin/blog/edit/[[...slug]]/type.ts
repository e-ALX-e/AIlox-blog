import { z } from 'zod'

const regex = {
  slug: /^[a-z0-9-]+$/,
  pureNumbers: /\d+/g,
}

export const articleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: '长度不能少于1个字符' })
    .max(50, { message: '标题超出大小限制' }),
  slug: z
    .string()
    .trim()
    .regex(regex.slug, {
      message: '只允许输入数字、小写字母和中横线',
    })
    .min(1, { message: '长度不能少于1个字符' }),
  isPublished: z.boolean(),
  relatedTagNames: z.array(z.string()).max(3, { message: '最多只能选择 3 个标签' }),
  content: z.string(),
})

export type ArticleDTO = z.infer<typeof articleSchema>
