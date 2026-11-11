export type StatusAction = 'home' | 'login' | 'retry'

export interface StatusPage {
  code: number
  label: string
  title: string
  description: string
  illustration: number
  alt: string
  action: StatusAction
}

export const statusPages: Record<number, StatusPage> = {
  200: {
    code: 200,
    label: 'OK',
    title: '一切就绪',
    description: '操作已完成，可以回到博客继续阅读文章',
    illustration: 200,
    alt: '开心地捧着一碗米饭的蓝发小鲸娘',
    action: 'home',
  },
  401: {
    code: 401,
    label: 'Unauthorized',
    title: '先确认一下你的身份',
    description: '当前登录信息无效或已过期，请重新登录后继续访问',
    illustration: 401,
    alt: '在闸机前检查访客证件的蓝发小鲸娘',
    action: 'login',
  },
  403: {
    code: 403,
    label: 'Forbidden',
    title: '这里需要访问权限',
    description: '当前账户无权访问这个页面，请联系管理员确认权限',
    illustration: 403,
    alt: '护着饭碗、示意禁止访问的蓝发小鲸娘',
    action: 'home',
  },
  404: {
    code: 404,
    label: 'Not Found',
    title: '这个页面走丢了',
    description: '链接可能有误，或者页面已经移走了。回到博客找找吧',
    illustration: 404,
    alt: '抱着空碗、在电饭煲旁寻找米饭的蓝发小鲸娘',
    action: 'home',
  },
  408: {
    code: 408,
    label: 'Request Timeout',
    title: '这次请求等得有点久',
    description: '请求未能及时完成，请检查网络后再试一次',
    illustration: 408,
    alt: '在电脑和时钟旁睡着的蓝发小鲸娘',
    action: 'retry',
  },
  414: {
    code: 414,
    label: 'URI Too Long',
    title: '这个链接太长了',
    description: '地址超出了服务可接受的长度，请缩短链接后重新打开',
    illustration: 414,
    alt: '拖着超长蛋挞盒的蓝发小鲸娘',
    action: 'home',
  },
  418: {
    code: 418,
    label: "I'm a teapot",
    title: '先喝杯茶吧',
    description: '这只小茶壶暂时处理不了这个请求，回到博客继续吧',
    illustration: 418,
    alt: '躲在鲸鱼茶壶里的蓝发小鲸娘',
    action: 'home',
  },
  429: {
    code: 429,
    label: 'Too Many Requests',
    title: '请求有点多，缓一缓',
    description: '访问过于频繁，请稍等片刻再试一次',
    illustration: 429,
    alt: '被请求卡片和文件堆包围的蓝发小鲸娘',
    action: 'retry',
  },
  500: {
    code: 500,
    label: 'Internal Server Error',
    title: '服务遇到了一点问题',
    description: '这次请求没能完成，请稍后重试。若持续出现，请联系管理员',
    illustration: 500,
    alt: '趴在冒烟的故障服务器旁的蓝发小鲸娘',
    action: 'retry',
  },
  502: {
    code: 502,
    label: 'Bad Gateway',
    title: '暂时没有连上服务',
    description: '网关未能取得有效响应，请稍后再试一次',
    illustration: 503,
    alt: '在待检修的服务器旁休息的蓝发小鲸娘',
    action: 'retry',
  },
  503: {
    code: 503,
    label: 'Service Unavailable',
    title: '博客暂时休息一下',
    description: '服务目前不可用，请稍后重试。若持续出现，请联系管理员',
    illustration: 503,
    alt: '在服务器和维修工具旁休息的蓝发小鲸娘',
    action: 'retry',
  },
  504: {
    code: 504,
    label: 'Gateway Timeout',
    title: '服务响应得有点慢',
    description: '网关等待服务响应超时，请稍后再试一次',
    illustration: 408,
    alt: '在电脑和时钟旁等待时睡着的蓝发小鲸娘',
    action: 'retry',
  },
}

// The SVG viewport trims only empty layout space; the original PNG stays intact.
export const statusIllustrations: Record<
  number,
  { width: number; height: number; viewBox: string }
> = {
  200: { width: 1254, height: 1254, viewBox: '168 394 938 824' },
  401: { width: 1254, height: 1254, viewBox: '0 402 1213 852' },
  403: { width: 1254, height: 1254, viewBox: '0 376 1245 844' },
  404: { width: 1254, height: 1254, viewBox: '99 413 1077 802' },
  408: { width: 1254, height: 1254, viewBox: '44 402 1139 767' },
  414: { width: 1254, height: 1254, viewBox: '11 526 1243 588' },
  418: { width: 1254, height: 1254, viewBox: '56 340 1162 853' },
  429: { width: 1254, height: 1254, viewBox: '17 425 1226 804' },
  500: { width: 1254, height: 1254, viewBox: '0 401 1233 775' },
  503: { width: 1254, height: 1254, viewBox: '18 351 1215 829' },
}

export function resolveStatusPage(value: unknown): StatusPage {
  const code =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d{3}$/.test(value)
        ? Number(value)
        : 404
  return statusPages[code] ?? statusPages[404]!
}
