export const languages = ['zh', 'en', 'zh-tw', 'ja', 'ru', 'de'] as const

export type Language = (typeof languages)[number]

export const defaultLanguage: Language = 'zh'

export const languageHtmlLang: Record<Language, string> = {
  zh: 'zh-CN',
  en: 'en',
  'zh-tw': 'zh-TW',
  ja: 'ja',
  ru: 'ru',
  de: 'de',
}

export const languageShortLabel: Record<Language, string> = {
  zh: '简',
  en: 'EN',
  'zh-tw': '繁',
  ja: '日',
  ru: 'RU',
  de: 'DE',
}

export const languageDisplayName: Record<Language, string> = {
  zh: '简体中文',
  en: 'English',
  'zh-tw': '繁體中文',
  ja: '日本語',
  ru: 'Русский',
  de: 'Deutsch',
}

export const translationLanguages = ['en', 'zh-tw', 'ja', 'ru', 'de'] as const

export type TranslationLanguage = (typeof translationLanguages)[number]

export const translationLanguageName: Record<TranslationLanguage, string> = {
  en: 'English',
  'zh-tw': 'Traditional Chinese (Taiwan)',
  ja: 'Japanese',
  ru: 'Russian',
  de: 'German',
}

export function isLanguage(value: string | undefined): value is Language {
  return languages.some(language => language === value)
}

export function isTranslationLanguage(
  value: string | undefined,
): value is TranslationLanguage {
  return translationLanguages.some(language => language === value)
}
