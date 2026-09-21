import { apiRequest } from '@/lib/infra/http/ky'

export type TranslationUsageStats = {
  calls: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  byLanguage: Array<{
    language: string
    calls: number
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }>
}

export type TranslationAdminState = {
  config: {
    enabled: boolean
    baseUrl: string
    model: string
    hasApiKey: boolean
  }
  usage: TranslationUsageStats
}

export async function getTranslationAdminState() {
  return await apiRequest<TranslationAdminState>({
    url: 'admin/translation',
    method: 'GET',
  })
}

export async function updateTranslationConfig(params: {
  enabled: boolean
  baseUrl: string
  model: string
  apiKey?: string
}) {
  return await apiRequest<{
    message: string
    config: TranslationAdminState['config']
  }>({
    url: 'admin/translation',
    method: 'PATCH',
    json: params,
  })
}

export async function syncAllTranslations() {
  return await apiRequest<{
    message: string
    results: Array<unknown>
    failures: Array<{
      blogId: number
      language: string
      error: string
    }>
    translatedCount: number
    usage: TranslationUsageStats
  }>({
    url: 'admin/translation',
    method: 'POST',
    timeout: 300_000,
  })
}
