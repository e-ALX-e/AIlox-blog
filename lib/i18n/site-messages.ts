import { messages as baseMessages } from './messages'

/** Site-specific section names; do not rewrite article content or other languages. */
export const chineseBlogLabels = { zh: '闲书', 'zh-tw': '閒書' } as const

export const messages = {
  ...baseMessages,
  zh: {
    ...baseMessages.zh,
    header: { ...baseMessages.zh.header, routes: { ...baseMessages.zh.header.routes, blog: chineseBlogLabels.zh } },
  },
  'zh-tw': {
    ...baseMessages['zh-tw'],
    header: { ...baseMessages['zh-tw'].header, routes: { ...baseMessages['zh-tw'].header.routes, blog: chineseBlogLabels['zh-tw'] } },
  },
}
