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

type MarkdownSegment =
  | { kind: 'translate'; text: string }
  | { kind: 'verbatim'; text: string }

type TranslationApiJson = {
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

const MAX_ATTEMPTS = 3
const TOTAL_REQUEST_BUDGET_MS = 20 * 60 * 1000
const MAX_SINGLE_ATTEMPT_MS = 10 * 60 * 1000
const MAX_TRANSLATABLE_CHUNK_CHARS = 4_500

const RETRYABLE_STATUS = new Set([
  408,
  425,
  429,
  500,
  502,
  503,
  504,
  520,
  522,
  523,
  524,
])

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

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return

  if (signal.reason instanceof Error) {
    throw signal.reason
  }

  throw new Error('Translation task was interrupted.')
}

function sleep(ms: number, signal?: AbortSignal) {
  if (signal == null) {
    return new Promise<void>(resolve => setTimeout(resolve, ms))
  }

  return new Promise<void>((resolve, reject) => {
    throwIfAborted(signal)

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new Error('Translation task was interrupted.'),
      )
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
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

async function fetchTranslationApi(
  url: string,
  init: RequestInit,
  externalSignal?: AbortSignal,
) {
  const startedAt = Date.now()
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    throwIfAborted(externalSignal)

    const elapsed = Date.now() - startedAt
    const remainingBudget = TOTAL_REQUEST_BUDGET_MS - elapsed

    if (remainingBudget <= 2500) break

    try {
      const timeoutSignal = AbortSignal.timeout(
        Math.min(MAX_SINGLE_ATTEMPT_MS, remainingBudget),
      )
      const signal =
        externalSignal == null
          ? timeoutSignal
          : AbortSignal.any([externalSignal, timeoutSignal])

      const response = await fetch(url, {
        ...init,
        signal,
      })

      if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS) {
        return response
      }

      const delayMs = getRetryDelayMs(response, attempt)
      const budgetAfterResponse =
        TOTAL_REQUEST_BUDGET_MS - (Date.now() - startedAt)

      if (budgetAfterResponse <= delayMs + 2500) {
        return response
      }

      await response.body?.cancel().catch(() => undefined)
      await sleep(delayMs, externalSignal)
    } catch (error) {
      if (externalSignal?.aborted) {
        throwIfAborted(externalSignal)
      }

      lastError = error

      if (attempt === MAX_ATTEMPTS) break

      const delayMs = 700 * 2 ** (attempt - 1)
      const budgetAfterError =
        TOTAL_REQUEST_BUDGET_MS - (Date.now() - startedAt)

      if (budgetAfterError <= delayMs + 2500) break

      await sleep(delayMs, externalSignal)
    }
  }

  const reason =
    lastError instanceof Error
      ? lastError.message
      : String(lastError ?? 'timeout')

  throw new Error(
    `Translation API connection failed after retries: ${reason}`,
  )
}

function splitLargeTextBlock(text: string, maxChars: number) {
  if (text.length <= maxChars) return [text]

  const lines = text.split('\n')
  const chunks: string[] = []
  let current = ''

  for (const line of lines) {
    const candidate = current.length === 0 ? line : `${current}\n${line}`

    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current.length > 0) {
      chunks.push(current)
      current = ''
    }

    if (line.length <= maxChars) {
      current = line
      continue
    }

    for (let offset = 0; offset < line.length; offset += maxChars) {
      chunks.push(line.slice(offset, offset + maxChars))
    }
  }

  if (current.length > 0) chunks.push(current)

  return chunks
}

function splitMarkdownSegments(markdown: string): MarkdownSegment[] {
  const lines = markdown.split('\n')
  const rawSegments: MarkdownSegment[] = []
  let buffer: string[] = []
  let fenceBuffer: string[] = []
  let inFence = false
  let fenceMarker = ''

  const flushTranslate = () => {
    if (buffer.length === 0) return

    const text = buffer.join('\n')
    buffer = []

    if (text.length === 0) {
      rawSegments.push({ kind: 'verbatim', text })
      return
    }

    for (const chunk of splitLargeTextBlock(
      text,
      MAX_TRANSLATABLE_CHUNK_CHARS,
    )) {
      rawSegments.push({ kind: 'translate', text: chunk })
    }
  }

  const flushFence = () => {
    if (fenceBuffer.length === 0) return
    rawSegments.push({ kind: 'verbatim', text: fenceBuffer.join('\n') })
    fenceBuffer = []
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/)

    if (!inFence && fenceMatch != null) {
      flushTranslate()
      inFence = true
      fenceMarker = fenceMatch[1][0]
      fenceBuffer.push(line)
      continue
    }

    if (inFence) {
      fenceBuffer.push(line)

      if (fenceMatch != null && fenceMatch[1][0] === fenceMarker) {
        inFence = false
        fenceMarker = ''
        flushFence()
      }

      continue
    }

    buffer.push(line)

    if (
      line.trim() === '' &&
      buffer.join('\n').length >= MAX_TRANSLATABLE_CHUNK_CHARS * 0.65
    ) {
      flushTranslate()
    }
  }

  if (inFence) flushFence()
  flushTranslate()

  const merged: MarkdownSegment[] = []

  for (const segment of rawSegments) {
    const previous = merged.at(-1)

    if (
      segment.kind === 'translate' &&
      previous?.kind === 'translate' &&
      previous.text.length + 2 + segment.text.length <=
        MAX_TRANSLATABLE_CHUNK_CHARS
    ) {
      previous.text = `${previous.text}\n\n${segment.text}`
      continue
    }

    merged.push(segment)
  }

  return merged
}

function getUsage(json: TranslationApiJson): Usage {
  const promptTokens =
    json.usage?.prompt_tokens ?? json.usage?.input_tokens ?? 0
  const completionTokens =
    json.usage?.completion_tokens ?? json.usage?.output_tokens ?? 0
  const totalTokens =
    json.usage?.total_tokens ?? promptTokens + completionTokens

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  }
}

async function translateChunk(input: {
  baseUrl: string
  apiKey: string
  model: string
  title: string
  content: string
  targetLanguageName: string
  part: number
  totalParts: number
  signal?: AbortSignal
}) {
  const response = await fetchTranslationApi(
    getChatCompletionsUrl(input.baseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You are a technical Markdown translator. Translate the supplied Chinese Markdown into ${input.targetLanguageName}.

This is part ${input.part} of ${input.totalParts} of one article. Do not add part numbers, separators, summaries, introductions, or conclusions.

Rules:
- Preserve the Markdown structure exactly as much as possible.
- Translate natural-language headings, paragraphs, table text, list text, blockquotes, and image alt text.
- Do not translate inline code, shell commands, source code, environment variable names, identifiers, URLs, domains, IP addresses, file paths, or image URLs.
- Fenced code blocks have already been removed from this request and will be restored verbatim.
- Preserve custom image size suffixes such as |50%, |80%, |600px exactly.
- Keep table pipes, list markers, heading markers, links, and Markdown syntax intact.
- Do not add explanations or commentary.
- Return exactly this format:
<<<TITLE>>>
translated article title only
<<<CONTENT>>>
translated Markdown chunk only`,
          },
          {
            role: 'user',
            content: `ARTICLE TITLE:\n${input.title}\n\nMARKDOWN CHUNK:\n${input.content}`,
          },
        ],
      }),
    },
    input.signal,
  )

  const json = (await response.json().catch(() => null)) as
    | TranslationApiJson
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

  return {
    parsed: parseTranslatedResponse(translatedText, input.title),
    usage: getUsage(json ?? {}),
  }
}

export async function translateMarkdown(input: {
  title: string
  content: string
  targetLanguage: TranslationLanguage
  signal?: AbortSignal
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

  throwIfAborted(input.signal)

  const targetLanguageName =
    translationLanguageName[input.targetLanguage]
  const segments = splitMarkdownSegments(input.content)
  const translatableSegments = segments.filter(
    segment => segment.kind === 'translate' && segment.text.trim().length > 0,
  )
  const totalParts = Math.max(translatableSegments.length, 1)
  let translatedTitle = input.title
  let part = 0
  const translatedSegments: string[] = []
  const usage: Usage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  }

  for (const segment of segments) {
    throwIfAborted(input.signal)

    if (segment.kind === 'verbatim' || segment.text.trim().length === 0) {
      translatedSegments.push(segment.text)
      continue
    }

    part += 1

    try {
      const result = await translateChunk({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        title: input.title,
        content: segment.text,
        targetLanguageName,
        part,
        totalParts,
        signal: input.signal,
      })

      if (part === 1) {
        translatedTitle = result.parsed.title
      }

      translatedSegments.push(result.parsed.content)
      usage.promptTokens += result.usage.promptTokens
      usage.completionTokens += result.usage.completionTokens
      usage.totalTokens += result.usage.totalTokens
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)

      throw new Error(
        `Translation chunk ${part}/${totalParts} failed: ${message}`,
        { cause: error },
      )
    }
  }

  if (translatableSegments.length === 0) {
    const titleOnly = await translateChunk({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      title: input.title,
      content: '',
      targetLanguageName,
      part: 1,
      totalParts: 1,
      signal: input.signal,
    })

    translatedTitle = titleOnly.parsed.title
    usage.promptTokens += titleOnly.usage.promptTokens
    usage.completionTokens += titleOnly.usage.completionTokens
    usage.totalTokens += titleOnly.usage.totalTokens
  }

  return {
    title: translatedTitle,
    content: translatedSegments.join('\n'),
    model: config.model,
    usage,
  }
}
