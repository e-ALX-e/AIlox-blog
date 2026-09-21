import type { Metadata } from 'next'
import type { Language } from '@/lib/i18n/config'

const sharedMetadata = {
  metadataBase: new URL('https://www.mikuflare.com'),
  robots: {
    index: true,
    follow: true,
  },
} satisfies Metadata

const baseSeoMetadata = {
  zh: {
    root: {
      ...sharedMetadata,

      title: {
        default: '黯留星 & Ailoxi',
        template: '%s & 黯留星',
      },

      description:
        '黯留星的个人技术博客，记录 Go 后端开发、Python、自动化、云服务、Linux、自托管与一些有用没用的小工具。',

      keywords: [
        '黯留星',
        'Ailoxi',
        'Go',
        'Golang',
        'Go 后端开发',
        'Python',
        'Docker',
        'Linux',
        'CI/CD',
        'Cloud',
        '云服务',
        '自动化',
        '后端开发',
        '全栈开发',
        '自托管',
        'Self-hosted',
        'Blender',
        '3D',
        '开发工具',
        '技术博客',
      ],

      authors: [
        {
          name: '黯留星',
          url: 'https://www.mikuflare.com',
        },
      ],

      creator: '黯留星',
    },

    home: {
      title: '首页',

      description:
        '黯留星的个人主页。主要折腾 Go 后端、Python、Linux、Docker、CI/CD、云服务与自托管，偶尔也使用 Blender 做一些 3D 和视觉相关的东西。',

      alternates: {
        canonical: '/zh',
        languages: {
          zh: '/zh',
          en: '/en',
        },
      },
    },

    blog: {
      title: '日志',

      description:
        '记录 Go 后端开发、Python、Linux、Docker、CI/CD、云服务、自托管、工具开发与日常折腾。',

      alternates: {
        canonical: '/zh/blog',
        languages: {
          zh: '/zh/blog',
          en: '/en/blog',
        },
      },
    },

    friends: {
      title: '友链',

      description:
        '黯留星的朋友们，以及技术博客与个人站点的友链申请。',

      alternates: {
        canonical: '/zh/friends',
        languages: {
          zh: '/zh/friends',
          en: '/en/friends',
        },
      },
    },

    articleDescription: (title: string) =>
      `阅读黯留星的文章《${title}》。`,
  },

  en: {
    root: {
      ...sharedMetadata,

      title: {
        default: 'Ailoxi',
        template: '%s & Ailoxi',
      },

      description:
        'Ailoxi’s personal tech blog about Go backend development, Python, automation, cloud services, Linux, self-hosting, and useful little tools.',

      keywords: [
        'Ailoxi',
        'Go',
        'Golang',
        'Go Backend',
        'Backend Development',
        'Python',
        'Docker',
        'Linux',
        'CI/CD',
        'Cloud',
        'Cloud Services',
        'Automation',
        'Full-stack Development',
        'Self-hosting',
        'Self-hosted',
        'Blender',
        '3D',
        'Developer Tools',
        'Tech Blog',
      ],

      authors: [
        {
          name: 'Ailoxi',
          url: 'https://www.mikuflare.com',
        },
      ],

      creator: 'Ailoxi',
    },

    home: {
      title: 'Home',

      description:
        'Ailoxi’s personal site about Go backend development, Python, Linux, Docker, CI/CD, cloud services, self-hosting, and occasional Blender experiments.',

      alternates: {
        canonical: '/en',
        languages: {
          zh: '/zh',
          en: '/en',
        },
      },
    },

    blog: {
      title: 'Blog',

      description:
        'Notes on Go backend development, Python, Linux, Docker, CI/CD, cloud services, self-hosting, developer tools, and everyday experiments.',

      alternates: {
        canonical: '/en/blog',
        languages: {
          zh: '/zh/blog',
          en: '/en/blog',
        },
      },
    },

    friends: {
      title: 'Friends',

      description:
        'Ailoxi’s friends and friend link applications for personal and technical websites.',

      alternates: {
        canonical: '/en/friends',
        languages: {
          zh: '/zh/friends',
          en: '/en/friends',
        },
      },
    },

    articleDescription: (title: string) =>
      `Read "${title}" on Ailoxi's blog.`,
  },
} as const

export const seoMetadata = {
  zh: baseSeoMetadata.zh,
  en: baseSeoMetadata.en,
  'zh-tw': baseSeoMetadata.en,
  ja: baseSeoMetadata.en,
  ru: baseSeoMetadata.en,
  de: baseSeoMetadata.en,
} satisfies Record<
  Language,
  {
    root: Metadata
    home: Metadata
    blog: Metadata
    friends: Metadata
    articleDescription: (title: string) => string
  }
>
