import type { Language } from '@/lib/i18n/config'

export type FloatingMenuKind = 'settings' | 'time'
export type FloatingMenuControl = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MenuLabels = {
  title: string
  subtitle: string
  losAngeles: string
  china: string
  panelStyle: string
  standard: string
  liquidGlass: string
  close: string
}

export const menuLabels: Record<Language, MenuLabels> = {
  zh: {
    title: '全球时间', subtitle: '当前世界时间', losAngeles: '洛杉矶', china: '中国',
    panelStyle: '面板风格', standard: '标准', liquidGlass: '液态玻璃', close: '关闭全球时间',
  },
  en: {
    title: 'World Time', subtitle: 'Current world time', losAngeles: 'Los Angeles', china: 'China',
    panelStyle: 'Panel style', standard: 'Standard', liquidGlass: 'Liquid Glass', close: 'Close world time',
  },
  'zh-tw': {
    title: '全球時間', subtitle: '目前世界時間', losAngeles: '洛杉磯', china: '中國',
    panelStyle: '面板風格', standard: '標準', liquidGlass: '液態玻璃', close: '關閉全球時間',
  },
  ja: {
    title: '世界時計', subtitle: '現在の世界時刻', losAngeles: 'ロサンゼルス', china: '中国',
    panelStyle: 'パネルのスタイル', standard: '標準', liquidGlass: 'リキッドガラス', close: '世界時計を閉じる',
  },
  ru: {
    title: 'Мировое время', subtitle: 'Текущее мировое время', losAngeles: 'Лос-Анджелес', china: 'Китай',
    panelStyle: 'Стиль панели', standard: 'Обычный', liquidGlass: 'Liquid Glass', close: 'Закрыть мировое время',
  },
  de: {
    title: 'Weltzeit', subtitle: 'Aktuelle Weltzeit', losAngeles: 'Los Angeles', china: 'China',
    panelStyle: 'Panel-Stil', standard: 'Standard', liquidGlass: 'Liquid Glass', close: 'Weltzeit schließen',
  },
}
