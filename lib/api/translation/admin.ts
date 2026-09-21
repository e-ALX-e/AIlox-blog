import type { TranslationLanguage } from '@/lib/i18n/config'
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

export type TranslationJob = {
  blogId: number
  language: TranslationLanguage
}

export type TranslationAdminState = {
  config: {
    enabled: boolean
    baseUrl: string
    model: string
    hasApiKey: boolean
  }
  usage: TranslationUsageStats
  pendingJobs: TranslationJob[]
  skippedUpToDateCount: number
  totalTranslationSlots: number
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

export async function syncTranslation(params: TranslationJob) {
  return await apiRequest<{
    message: string
    result: {
      attempted: boolean
      translated: boolean
      skipped: boolean
      language: TranslationLanguage
    }
    usage: TranslationUsageStats
  }>({
    url: 'admin/translation',
    method: 'POST',
    json: params,
    timeout: 110_000,
  })
}
