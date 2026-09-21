import 'server-only'

import type { TranslationLanguage } from '@/lib/i18n/config'
import { translationLanguageName } from '@/lib/i18n/config'
import { getTranslationModelConfig } from './config'

type Usage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type TranslationResult = {
  title: string
  content: string
  model: string
  usage: Usage
}

const MAX_ATTEMPTS = 3
const TOTAL_REQUEST_BUDGET_MS = 95_000
const MAX_SINGLE_ATTEMPT_MS = 60_000
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 520, 522, 523, 524])

function getChatCompletionsUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, '')

  if (/\/chat\/completions$/i.test(normalized)) {
    return normalized
  }

  return `${normalized}/chat/completions`
}

function parseTranslatedResponse(text: string, fallbackTitle: string) {
  const titleMarker = '<<<TITLE>>>'
  const contentMarker = '<<<CONTENT>>>'
  const titleIndex = text.indexOf(titleMarker)
  const contentIndex = text.indexOf(contentMarker)

  if (titleIndex >= 0 && contentIndex > titleIndex) {
    const title = text
      .slice(titleIndex + titleMarker.length, contentIndex)
      .trim()
      .replace(/^#+\s*/, '')
    const content = text.slice(contentIndex + contentMarker.length).trim()

    return {
      title: title.length > 0 ? title : fallbackTitle,
      content,
    }
  }

  const normalized = text.trim()
  const headingMatch = normalized.match(/^#\s+(.+)$/m)

  return {
    title: headingMatch?.[1]?.trim() || fallbackTitle,
    content: normalized,
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get('retry-after')

  if (retryAfter != null) {
    const seconds = Number(retryAfter)

    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 5000)
    }

    const retryAt = Date.parse(retryAfter)

    if (Number.isFinite(retryAt)) {
      return Math.min(Math.max(retryAt - Date.now(), 0), 5000)
    }
  }

  return 700 * 2 ** (attempt - 1)
}

async function fetchTranslationApi(url: string, init: RequestInit) {
  const startedAt = Date.now()
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const elapsed = Date.now() - startedAt
    const remainingBudget = TOTAL_REQUEST_BUDGET_MS - elapsed

    if (remainingBudget <= 2500) break

    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(Math.min(MAX_SINGLE_ATTEMPT_MS, remainingBudget)),
      })

      if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS) {
        return response
      }

      const delayMs = getRetryDelayMs(response, attempt)
      const budgetAfterResponse = TOTAL_REQUEST_BUDGET_MS - (Date.now() - startedAt)

      if (budgetAfterResponse <= delayMs + 2500) {
        return response
      }

      await response.body?.cancel().catch(() => undefined)
      await sleep(delayMs)
    } catch (error) {
      lastError = error

      if (attempt === MAX_ATTEMPTS) break

      const delayMs = 700 * 2 ** (attempt - 1)
      const budgetAfterError = TOTAL_REQUEST_BUDGET_MS - (Date.now() - startedAt)

      if (budgetAfterError <= delayMs + 2500) break

      await sleep(delayMs)
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError ?? 'timeout')
  throw new Error(`Translation API connection failed after retries: ${reason}`)
}

export async function translateMarkdown(input: {
  title: string
  content: string
  targetLanguage: TranslationLanguage
}): Promise<TranslationResult> {
  const config = await getTranslationModelConfig()

  if (
    !config.enabled ||
    config.apiKey == null ||
    config.baseUrl.trim().length === 0 ||
    config.model.trim().length === 0
  ) {
    throw new Error('AI translation model is not configured or enabled.')
  }

  const targetLanguageName = translationLanguageName[input.targetLanguage]
  const response = await fetchTranslationApi(getChatCompletionsUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      Connection: 'keep-alive',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are a technical Markdown translator. Translate the supplied Chinese blog article into ${targetLanguageName}.

Rules:
- Preserve the Markdown structure exactly as much as possible.
- Translate natural-language headings, paragraphs, table text, list text, blockquotes, and image alt text.
- Do not translate fenced code blocks, inline code, shell commands, source code, environment variable names, identifiers, URLs, domains, IP addresses, file paths, or image URLs.
- Preserve custom image size suffixes such as |50%, |80%, |600px exactly.
- Do not add explanations or commentary.
- Return exactly this format:
<<<TITLE>>>
translated title only
<<<CONTENT>>>
translated complete Markdown body`,
        },
        {
          role: 'user',
          content: `TITLE:\n${input.title}\n\nMARKDOWN:\n${input.content}`,
        },
      ],
    }),
  })

  const json = (await response.json().catch(() => null)) as
    | {
        choices?: Array<{ message?: { content?: string } }>
        usage?: {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          input_tokens?: number
          output_tokens?: number
        }
        error?: { message?: string }
        message?: string
      }
    | null

  if (!response.ok) {
    throw new Error(
      json?.error?.message ||
        json?.message ||
        `Translation API request failed: ${response.status}`,
    )
  }

  const translatedText = json?.choices?.[0]?.message?.content?.trim()

  if (translatedText == null || translatedText.length === 0) {
    throw new Error('Translation API returned an empty response.')
  }

  const parsed = parseTranslatedResponse(translatedText, input.title)
  const promptTokens = json?.usage?.prompt_tokens ?? json?.usage?.input_tokens ?? 0
  const completionTokens = json?.usage?.completion_tokens ?? json?.usage?.output_tokens ?? 0
  const totalTokens = json?.usage?.total_tokens ?? promptTokens + completionTokens

  return {
    ...parsed,
    model: config.model,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
  }
}
