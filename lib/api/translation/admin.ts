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
  blogTitle: string
  language: TranslationLanguage
  status: 'queued' | 'processing' | 'failed'
  attempts: number
  error: string | null
  updatedAt: Date | string | null
}

export type TranslationTaskRecord = {
  id: number
  blogId: number
  blogTitle: string
  language: TranslationLanguage
  status: string
  attempts: number
  error: string | null
  startedAt: Date | string | null
  finishedAt: Date | string | null
  updatedAt: Date | string
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
  taskSummary: {
    queued: number
    processing: number
    failed: number
    upToDate: number
  }
  recentTasks: TranslationTaskRecord[]
  queueWorkerRunning: boolean
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

export async function syncTranslation(params: {
  blogId: number
  language: TranslationLanguage
}) {
  return await apiRequest<{
    message: string
    result: {
      attempted: boolean
      translated: boolean
      skipped: boolean
      inProgress: boolean
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


export async function runTranslationQueue() {
  return await apiRequest<{
    message: string
    queue: {
      queued: number
      alreadyProcessing: number
      upToDate: number
      total: number
    }
  }>({
    url: 'admin/translation/run',
    method: 'POST',
  })
}
