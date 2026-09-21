import 'server-only'

import { count, eq, sum } from 'drizzle-orm'
import { db } from '@/db/instance'
import { translationModelConfig, translationUsage } from '@/db/schema'
import { decryptTranslationSecret, encryptTranslationSecret } from './secret'

const CONFIG_ID = 1

export type TranslationModelConfigRecord = {
  enabled: boolean
  baseUrl: string
  model: string
  apiKey: string | null
}

export async function getTranslationModelConfig(): Promise<TranslationModelConfigRecord> {
  const record = await db
    .select()
    .from(translationModelConfig)
    .where(eq(translationModelConfig.id, CONFIG_ID))
    .limit(1)
    .then(rows => rows[0])

  if (record == null) {
    return {
      enabled: false,
      baseUrl: '',
      model: '',
      apiKey: null,
    }
  }

  return {
    enabled: record.enabled,
    baseUrl: record.baseUrl,
    model: record.model,
    apiKey:
      record.apiKeyEncrypted != null && record.apiKeyEncrypted.length > 0
        ? decryptTranslationSecret(record.apiKeyEncrypted)
        : null,
  }
}

export async function getPublicTranslationModelConfig() {
  const record = await db
    .select({
      enabled: translationModelConfig.enabled,
      baseUrl: translationModelConfig.baseUrl,
      model: translationModelConfig.model,
      apiKeyEncrypted: translationModelConfig.apiKeyEncrypted,
    })
    .from(translationModelConfig)
    .where(eq(translationModelConfig.id, CONFIG_ID))
    .limit(1)
    .then(rows => rows[0])

  return {
    enabled: record?.enabled ?? false,
    baseUrl: record?.baseUrl ?? '',
    model: record?.model ?? '',
    hasApiKey: (record?.apiKeyEncrypted?.length ?? 0) > 0,
  }
}

export async function saveTranslationModelConfig(input: {
  enabled: boolean
  baseUrl: string
  model: string
  apiKey?: string
}) {
  const existing = await db
    .select({
      apiKeyEncrypted: translationModelConfig.apiKeyEncrypted,
    })
    .from(translationModelConfig)
    .where(eq(translationModelConfig.id, CONFIG_ID))
    .limit(1)
    .then(rows => rows[0])

  const normalizedApiKey = input.apiKey?.trim()
  const apiKeyEncrypted =
    normalizedApiKey != null && normalizedApiKey.length > 0
      ? encryptTranslationSecret(normalizedApiKey)
      : existing?.apiKeyEncrypted ?? null

  await db
    .insert(translationModelConfig)
    .values({
      id: CONFIG_ID,
      enabled: input.enabled,
      baseUrl: input.baseUrl.trim().replace(/\/+$/, ''),
      model: input.model.trim(),
      apiKeyEncrypted,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: translationModelConfig.id,
      set: {
        enabled: input.enabled,
        baseUrl: input.baseUrl.trim().replace(/\/+$/, ''),
        model: input.model.trim(),
        apiKeyEncrypted,
        updatedAt: new Date(),
      },
    })
}

export async function getTranslationUsageStats() {
  const [summary] = await db
    .select({
      calls: count(),
      promptTokens: sum(translationUsage.promptTokens),
      completionTokens: sum(translationUsage.completionTokens),
      totalTokens: sum(translationUsage.totalTokens),
    })
    .from(translationUsage)

  const byLanguage = await db
    .select({
      language: translationUsage.language,
      calls: count(),
      promptTokens: sum(translationUsage.promptTokens),
      completionTokens: sum(translationUsage.completionTokens),
      totalTokens: sum(translationUsage.totalTokens),
    })
    .from(translationUsage)
    .groupBy(translationUsage.language)
    .orderBy(translationUsage.language)

  const toNumber = (value: unknown) => Number(value ?? 0)

  return {
    calls: toNumber(summary?.calls),
    promptTokens: toNumber(summary?.promptTokens),
    completionTokens: toNumber(summary?.completionTokens),
    totalTokens: toNumber(summary?.totalTokens),
    byLanguage: byLanguage.map(item => ({
      language: item.language,
      calls: toNumber(item.calls),
      promptTokens: toNumber(item.promptTokens),
      completionTokens: toNumber(item.completionTokens),
      totalTokens: toNumber(item.totalTokens),
    })),
  }
}
