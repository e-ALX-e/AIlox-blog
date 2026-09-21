import type { Language } from './config'

const baseMessages = {
  zh: {
    common: {
      empty: '虚无。',
      cancel: '取消',
      confirm: '确定',
      pending: '稍等',
      closeConfirmDialog: '关闭确认弹窗',
      pageLoading: '页面加载中',
      openQuickMenu: '打开快捷菜单',
      closeQuickMenu: '关闭快捷菜单',
      quickSettings: '快捷设置',
      backgroundMusic: '背景音乐',
      backgroundOnly: '仅显示背景',
      showBackgroundOnly: '仅显示天空背景',
      showFullInterface: '显示完整界面',
      appearance: '外观',
      lightTheme: '浅色',
      darkTheme: '深色',
      playMusic: '播放背景音乐',
      pauseMusic: '暂停背景音乐',
      switchToLightTheme: '切换到浅色主题',
      switchToDarkTheme: '切换到深色主题',
      skyTime: '天空时间',
      useRealTime: '自动匹配主题时间',
      cloudSpeed: '云层速度',
      cloudMotion: '云层动画',
      playCloudMotion: '播放云层动画',
      pauseCloudMotion: '暂停云层动画',
      resetSkyBackground: '重置天空背景',
      phase: '时段',
      skyPhases: {
        midnight: '深夜',
        dawn: '黎明',
        morning: '清晨',
        noon: '正午',
        afternoon: '午后',
        sunset: '日落',
        night: '夜晚',
      },
    },

    header: {
      homeLabel: '返回首页',
      navigationLabel: '主导航',
      switchLanguageLabel: '切换语言',
      routes: {
        blog: '日志',
        friends: '友链',
        login: '登录',
        language: 'EN',
      },
    },
  home: {
    avatarAlt: '黯留星的头像',

    greeting: '你好! 我是 黯留星 ( ^¯꒳¯^ )ﾉﾉ',

    role: 'Golang 全栈开发者 ⸜( *ˊᵕˋ* )⸝',

    about: [
      {
        id: 'career',
        paragraphs: [
          '27 年大学毕业，主要方向是 Go 后端开发、自动化与云端服务',
          '平时喜欢用 Python 和 AI 把重复的事情做成工具 φ(-ω-*)',
        ],
      },

      {
        id: 'engineering',
        paragraphs: [
          '日常会折腾 Linux、Docker、CI/CD 和各种自托管服务',
          '比起只把代码写完，我更喜欢把部署、运行和维护一起做好 ( ˙◞˙ )',
        ],
      },

      {
        id: 'creative',
        paragraphs: [
          '偶尔也会用 Blender 做一些 3D 和视觉相关的东西',
          '喜欢在代码、系统和创作工具之间来回折腾。',
        ],
      },

      {
        id: 'motto',
        paragraphs: [
          '灰色没有尽头，星光暂不退场。',
        ],
      },
    ],

    techStackLabel: '技术栈',
    socialLinksLabel: '社交链接',
    copyrightName: '黯留星',
  },

    friends: {
      apply: '申请友链',
      visitSite: (name: string) => `访问 ${name} 的网站`,
    },

    comments: {
      title: '评论',
      count: (total: number) => `共 ${total} 条评论`,
      noComments: '还没有评论，来发表第一条评论吧',
      loginPrompt: '登录后即可评论喵~',
      loginToComment: '登录后评论',
      placeholder: '（*＾-＾*）',
      publish: '发布',
      walletReview: 'Web3 钱包登录用户评论提交后可能需要审核。',

      sortOrder: {
        asc: '按时间正序',
        desc: '按时间倒序',
      },

      switchSortOrder: {
        asc: '切换为正序',
        desc: '切换为倒序',
      },

      empty: '评论会在这里按时间展开，回复会以缩进形式挂在对应楼层下面。',
      admin: '管理员',
      you: '你',
      deletedStatus: '（已删除）',
      deleted: '已删除',

      replyTo: (name: string) => `回复 ${name}`,
      deleteLabel: (name: string) => `删除 ${name} 的评论`,
      replyLabel: (name: string) => `回复 ${name}`,
      reply: '回复',
      replyPlaceholder: (name: string) => `回复 ${name}...`,

      walletReplyReview: 'Web3 钱包登录用户回复提交后可能需要审核。',
      loginToReply: '登录后即可回复这条评论。',

      deleteTitle: '确定要删除这条评论吗？',
      deleteDescription: '该操作不可撤销。',

      adminAvatarAlt: '管理员头像',
      sessionAvatarAlt: '我的头像',

      openGithubProfile: (name: string) =>
        `打开 ${name} 的 GitHub 主页`,
    },

    friendLinkApplyModal: {
      title: '申请友链',

      description: [
        '申请说明：技术博客或生活记录，需 HTTPS、无广告 ~',
        '已添加本站 / 站点可访问 / 内容合规 ~',
      ],

      copied: '已复制',
      copySiteInfo: '复制本站信息',
      cancel: '取消',
      submitting: '稍等',
      submit: '提交',

      submitted: '友链申请已提交，等待审核。',

      closeLabel: '关闭友链申请弹窗',

      fields: {
        name: {
          label: '站点名称',
          placeholder: '黯留星',
        },

        email: {
          label: '联系邮箱（可选，仅用于通知）',
          placeholder: 'your@email.com',
        },

        description: {
          label: '站点描述',
          placeholder: 'Golang / 全栈开发 / 个人博客',
        },

        avatarUrl: {
          label: '头像地址',
          placeholder: 'https://example.com/avatar.webp',
        },

        siteUrl: {
          label: '站点地址',
          placeholder: 'https://www.mikuflare.com/',
        },
      },
    },

    loginModal: {
      userInfoTitle: '用户信息',
      loginTitle: '登录 (ゝ∀･)',
      closeLabel: '关闭登录弹窗',
      loading: '正在加载',
      closeModalLabel: '关闭弹窗',
      signingIn: '少女折寿中...',
      adminDashboard: '进入后台',
      logout: '退出登录',
      walletAddress: '钱包地址',

      walletSignInStatement:
        '使用以太坊钱包登录 www.mikuflare.com',
    },
  },

  en: {
    common: {
      empty: 'Nothing here.',
      cancel: 'Cancel',
      confirm: 'Confirm',
      pending: 'Please wait',
      closeConfirmDialog: 'Close confirmation dialog',
      pageLoading: 'Page loading',
      openQuickMenu: 'Open quick menu',
      closeQuickMenu: 'Close quick menu',
      quickSettings: 'Quick settings',
      backgroundMusic: 'Background music',
      backgroundOnly: 'Background only',
      showBackgroundOnly: 'Show only the sky background',
      showFullInterface: 'Show the full interface',
      appearance: 'Appearance',
      lightTheme: 'Light',
      darkTheme: 'Dark',
      playMusic: 'Play background music',
      pauseMusic: 'Pause background music',
      switchToLightTheme: 'Switch to light theme',
      switchToDarkTheme: 'Switch to dark theme',
      skyTime: 'Sky time',
      useRealTime: 'Match theme time automatically',
      cloudSpeed: 'Cloud speed',
      cloudMotion: 'Cloud motion',
      playCloudMotion: 'Play cloud motion',
      pauseCloudMotion: 'Pause cloud motion',
      resetSkyBackground: 'Reset sky background',
      phase: 'Phase',

      skyPhases: {
        midnight: 'Midnight',
        dawn: 'Dawn',
        morning: 'Morning',
        noon: 'Noon',
        afternoon: 'Afternoon',
        sunset: 'Sunset',
        night: 'Night',
      },
    },

    header: {
      homeLabel: 'Back to home',
      navigationLabel: 'Main navigation',
      switchLanguageLabel: 'Switch language',

      routes: {
        blog: 'Blog',
        friends: 'Friends',
        login: 'Login',
        language: 'ZH',
      },
        },
    home: {
      avatarAlt: "Ailoxi's avatar",

      greeting: "Hello! I'm Ailoxi ( ^¯꒳¯^ )ﾉﾉ",

      role: 'Go / Cloud full-stack developer ⸜( *ˊᵕˋ* )⸝',

      about: [
        {
          id: 'career',
          paragraphs: [
            'I will graduate in 2027, focusing on Go backend development, automation, and cloud services.',
            'I enjoy using Python and AI to turn repetitive tasks into useful tools φ(-ω-*)',
          ],
        },

        {
          id: 'engineering',
          paragraphs: [
            'I spend a lot of time working with Linux, Docker, CI/CD, and self-hosted services.',
            'I enjoy not only writing code, but also making sure it can be deployed, operated, and maintained well ( ˙◞˙ )',
          ],
        },

        {
          id: 'creative',
          paragraphs: [
            'I also use Blender from time to time for 3D and visual experiments.',
            'I like moving between code, systems, and creative tools.',
          ],
        },

        {
          id: 'motto',
          paragraphs: [
            'Gray has no end, and the starlight has not left the stage yet.',
          ],
        },
      ],

      techStackLabel: 'Tech stack',
      socialLinksLabel: 'Social links',
      copyrightName: 'Ailoxi',
    },

    friends: {
      apply: 'Apply for a friend link',
      visitSite: (name: string) =>
        `Visit ${name}'s website`,
    },

    comments: {
      title: 'Comments',

      count: (total: number) =>
        `${total} ${total === 1 ? 'comment' : 'comments'}`,

      noComments:
        'No comments yet. Be the first to comment.',

      loginPrompt:
        'Log in to leave a comment.',

      loginToComment:
        'Log in to comment',

      placeholder:
        '（*＾-＾*）',

      publish:
        'Publish',

      walletReview:
        'Comments from Web3 wallet users may require review.',

      sortOrder: {
        asc: 'Oldest first',
        desc: 'Newest first',
      },

      switchSortOrder: {
        asc: 'Switch to oldest first',
        desc: 'Switch to newest first',
      },

      empty:
        'Comments will appear here by time, with replies nested under each thread.',

      admin:
        'Admin',

      you:
        'You',

      deletedStatus:
        '(deleted)',

      deleted:
        'Deleted',

      replyTo: (name: string) =>
        `Replying to ${name}`,

      deleteLabel: (name: string) =>
        `Delete ${name}'s comment`,

      replyLabel: (name: string) =>
        `Reply to ${name}`,

      reply:
        'Reply',

      replyPlaceholder: (name: string) =>
        `Reply to ${name}...`,

      walletReplyReview:
        'Replies from Web3 wallet users may require review.',

      loginToReply:
        'Log in to reply to this comment.',

      deleteTitle:
        'Delete this comment?',

      deleteDescription:
        'This action cannot be undone.',

      adminAvatarAlt:
        'Admin avatar',

      sessionAvatarAlt:
        'My avatar',

      openGithubProfile: (name: string) =>
        `Open ${name}'s GitHub profile`,
    },

    friendLinkApplyModal: {
      title: 'Apply for a friend link',

      description: [
        'For tech blogs or personal journals using HTTPS and no ads ~',
        'Please add this site first and ensure your site is accessible and compliant ~',
      ],

      copied:
        'Copied',

      copySiteInfo:
        'Copy my site info',

      cancel:
        'Cancel',

      submitting:
        'Submitting',

      submit:
        'Submit',

      submitted:
        'Your friend link application has been submitted for review.',

      closeLabel:
        'Close friend link application',

      fields: {
        name: {
          label: 'Site name',
          placeholder: 'Ailoxi',
        },

        email: {
          label: 'Contact email (optional, notifications only)',
          placeholder: 'your@email.com',
        },

        description: {
          label: 'Site description',
          placeholder: 'Golang / Full-stack development / Personal blog',
        },

        avatarUrl: {
          label: 'Avatar URL',
          placeholder: 'https://example.com/avatar.webp',
        },

        siteUrl: {
          label: 'Site URL',
          placeholder: 'https://www.mikuflare.com/',
        },
      },
    },

    loginModal: {
      userInfoTitle:
        'User information',

      loginTitle:
        'Login (ゝ∀･)',

      closeLabel:
        'Close login dialog',

      loading:
        'Loading',

      closeModalLabel:
        'Close dialog',

      signingIn:
        'Signing in...',

      adminDashboard:
        'Open dashboard',

      logout:
        'Log out',

      walletAddress:
        'Wallet address',

      walletSignInStatement:
        'Sign in to www.mikuflare.com with Ethereum',
    },
  },
} as const


const zhTwMessages = {
  ...baseMessages.zh,
  common: {
    ...baseMessages.zh.common,
    empty: '這裡什麼都沒有。',
    cancel: '取消',
    confirm: '確定',
    pending: '請稍候',
    closeConfirmDialog: '關閉確認視窗',
    pageLoading: '頁面載入中',
    openQuickMenu: '開啟快捷選單',
    closeQuickMenu: '關閉快捷選單',
    quickSettings: '快捷設定',
    backgroundMusic: '背景音樂',
    backgroundOnly: '僅顯示背景',
    showBackgroundOnly: '僅顯示天空背景',
    showFullInterface: '顯示完整介面',
    appearance: '外觀',
    lightTheme: '淺色',
    darkTheme: '深色',
    playMusic: '播放背景音樂',
    pauseMusic: '暫停背景音樂',
    switchToLightTheme: '切換到淺色主題',
    switchToDarkTheme: '切換到深色主題',
    skyTime: '天空時間',
    useRealTime: '自動匹配主題時間',
    cloudSpeed: '雲層速度',
    cloudMotion: '雲層動畫',
    playCloudMotion: '播放雲層動畫',
    pauseCloudMotion: '暫停雲層動畫',
    resetSkyBackground: '重設天空背景',
    phase: '時段',
    skyPhases: {
      midnight: '深夜',
      dawn: '黎明',
      morning: '清晨',
      noon: '正午',
      afternoon: '午後',
      sunset: '日落',
      night: '夜晚',
    },
  },
  header: {
    ...baseMessages.zh.header,
    homeLabel: '返回首頁',
    navigationLabel: '主導覽',
    switchLanguageLabel: '切換語言',
    routes: {
      blog: '日誌',
      friends: '友鏈',
      login: '登入',
      language: '文',
    },
  },
  home: {
    ...baseMessages.zh.home,
    avatarAlt: '黯留星的頭像',
    greeting: '你好！我是 黯留星 ( ^¯꒳¯^ )ﾉﾉ',
    role: 'Golang 全端開發者 ⸜( *ˊᵕˋ* )⸝',
    about: [
      {
        id: 'career',
        paragraphs: [
          '27 年大學畢業，主要方向是 Go 後端開發、自動化與雲端服務',
          '平時喜歡用 Python 和 AI 把重複的事情做成工具 φ(-ω-*)',
        ],
      },
      {
        id: 'engineering',
        paragraphs: [
          '日常會折騰 Linux、Docker、CI/CD 和各種自託管服務',
          '比起只把程式碼寫完，我更喜歡把部署、運行和維護一起做好 ( ˙◞˙ )',
        ],
      },
      {
        id: 'creative',
        paragraphs: [
          '偶爾也會用 Blender 做一些 3D 和視覺相關的東西',
          '喜歡在程式碼、系統和創作工具之間來回折騰。',
        ],
      },
      {
        id: 'motto',
        paragraphs: ['灰色沒有盡頭，星光暫不退場。'],
      },
    ],
    techStackLabel: '技術棧',
    socialLinksLabel: '社群連結',
    copyrightName: '黯留星',
  },
  friends: {
    apply: '申請友鏈',
    visitSite: (name: string) => `造訪 ${name} 的網站`,
  },
  comments: {
    ...baseMessages.zh.comments,
    title: '評論',
    count: (total: number) => `共 ${total} 則評論`,
    noComments: '還沒有評論，來發表第一則評論吧',
    loginPrompt: '登入後即可評論喵~',
    loginToComment: '登入後評論',
    publish: '發布',
    walletReview: 'Web3 錢包登入使用者的評論提交後可能需要審核。',
    sortOrder: { asc: '按時間正序', desc: '按時間倒序' },
    switchSortOrder: { asc: '切換為正序', desc: '切換為倒序' },
    empty: '評論會依時間顯示，回覆會縮排在對應樓層下方。',
    admin: '管理員',
    you: '你',
    deletedStatus: '（已刪除）',
    deleted: '已刪除',
    replyTo: (name: string) => `回覆 ${name}`,
    deleteLabel: (name: string) => `刪除 ${name} 的評論`,
    replyLabel: (name: string) => `回覆 ${name}`,
    reply: '回覆',
    replyPlaceholder: (name: string) => `回覆 ${name}...`,
    walletReplyReview: 'Web3 錢包登入使用者的回覆提交後可能需要審核。',
    loginToReply: '登入後即可回覆這則評論。',
    deleteTitle: '確定要刪除這則評論嗎？',
    deleteDescription: '此操作無法復原。',
    adminAvatarAlt: '管理員頭像',
    sessionAvatarAlt: '我的頭像',
    openGithubProfile: (name: string) => `開啟 ${name} 的 GitHub 個人頁面`,
  },
  friendLinkApplyModal: {
    ...baseMessages.zh.friendLinkApplyModal,
    title: '申請友鏈',
    description: [
      '申請說明：技術部落格或生活記錄，需 HTTPS、無廣告 ~',
      '已加入本站 / 網站可存取 / 內容合規 ~',
    ],
    copied: '已複製',
    copySiteInfo: '複製本站資訊',
    cancel: '取消',
    submitting: '請稍候',
    submit: '提交',
    submitted: '友鏈申請已提交，等待審核。',
    closeLabel: '關閉友鏈申請視窗',
    fields: {
      name: { label: '網站名稱', placeholder: '黯留星' },
      email: { label: '聯絡信箱（可選，僅用於通知）', placeholder: 'your@email.com' },
      description: { label: '網站描述', placeholder: 'Golang / 全端開發 / 個人部落格' },
      avatarUrl: { label: '頭像網址', placeholder: 'https://example.com/avatar.webp' },
      siteUrl: { label: '網站網址', placeholder: 'https://www.mikuflare.com/' },
    },
  },
  loginModal: {
    ...baseMessages.zh.loginModal,
    userInfoTitle: '使用者資訊',
    loginTitle: '登入 (ゝ∀･)',
    closeLabel: '關閉登入視窗',
    loading: '載入中',
    closeModalLabel: '關閉視窗',
    signingIn: '登入中...',
    adminDashboard: '進入後台',
    logout: '登出',
    walletAddress: '錢包地址',
    walletSignInStatement: '使用以太坊錢包登入 www.mikuflare.com',
  },
}

const jaMessages = {
  ...baseMessages.en,
  common: {
    ...baseMessages.en.common,
    empty: 'ここには何もありません。',
    cancel: 'キャンセル',
    confirm: '確認',
    pending: 'お待ちください',
    closeConfirmDialog: '確認ダイアログを閉じる',
    pageLoading: 'ページを読み込み中',
    openQuickMenu: 'クイックメニューを開く',
    closeQuickMenu: 'クイックメニューを閉じる',
    quickSettings: 'クイック設定',
    backgroundMusic: 'BGM',
    backgroundOnly: '背景のみ',
    showBackgroundOnly: '空の背景のみ表示',
    showFullInterface: 'すべてのUIを表示',
    appearance: '外観',
    lightTheme: 'ライト',
    darkTheme: 'ダーク',
    playMusic: '音楽を再生',
    pauseMusic: '音楽を一時停止',
    switchToLightTheme: 'ライトテーマに切り替え',
    switchToDarkTheme: 'ダークテーマに切り替え',
    skyTime: '空の時間',
    useRealTime: 'テーマ時間を自動調整',
    cloudSpeed: '雲の速度',
    cloudMotion: '雲のアニメーション',
    playCloudMotion: '雲のアニメーションを再生',
    pauseCloudMotion: '雲のアニメーションを停止',
    resetSkyBackground: '空の背景をリセット',
    phase: '時間帯',
    skyPhases: {
      midnight: '深夜',
      dawn: '夜明け',
      morning: '朝',
      noon: '正午',
      afternoon: '午後',
      sunset: '夕暮れ',
      night: '夜',
    },
  },
  header: {
    ...baseMessages.en.header,
    homeLabel: 'ホームへ戻る',
    navigationLabel: 'メインナビゲーション',
    switchLanguageLabel: '言語を切り替える',
    routes: { blog: 'ブログ', friends: 'リンク', login: 'ログイン', language: '文' },
  },
  home: {
    ...baseMessages.en.home,
    avatarAlt: 'Ailoxi のアバター',
    greeting: 'こんにちは！Ailoxi です ( ^¯꒳¯^ )ﾉﾉ',
    role: 'Go / Cloud フルスタック開発者 ⸜( *ˊᵕˋ* )⸝',
    about: [
      {
        id: 'career',
        paragraphs: [
          '2027 年卒業予定で、Go バックエンド開発、自動化、クラウドサービスを中心に学んでいます。',
          'Python と AI を使って、繰り返し作業を便利なツールにするのが好きです φ(-ω-*)',
        ],
      },
      {
        id: 'engineering',
        paragraphs: [
          '普段は Linux、Docker、CI/CD、セルフホスト環境をよく触っています。',
          'コードを書くことだけでなく、デプロイ・運用・保守まで整えることが好きです ( ˙◞˙ )',
        ],
      },
      {
        id: 'creative',
        paragraphs: [
          'ときどき Blender で 3D やビジュアル制作もしています。',
          'コード、システム、クリエイティブツールを行き来するのが好きです。',
        ],
      },
      { id: 'motto', paragraphs: ['灰色に終わりはなく、星の光はまだ舞台を去らない。'] },
    ],
    techStackLabel: '技術スタック',
    socialLinksLabel: 'ソーシャルリンク',
    copyrightName: 'Ailoxi',
  },
  friends: {
    apply: '相互リンクを申請',
    visitSite: (name: string) => `${name} のサイトを開く`,
  },
  comments: {
    ...baseMessages.en.comments,
    title: 'コメント',
    count: (total: number) => `${total} 件のコメント`,
    noComments: 'まだコメントはありません。最初のコメントを書いてみましょう。',
    loginPrompt: 'ログインするとコメントできます。',
    loginToComment: 'ログインしてコメント',
    publish: '投稿',
    walletReview: 'Web3 ウォレット利用者のコメントは審査が必要な場合があります。',
    sortOrder: { asc: '古い順', desc: '新しい順' },
    switchSortOrder: { asc: '古い順に切り替え', desc: '新しい順に切り替え' },
    empty: 'コメントは時間順に表示され、返信はスレッド内に表示されます。',
    admin: '管理者',
    you: 'あなた',
    deletedStatus: '（削除済み）',
    deleted: '削除済み',
    replyTo: (name: string) => `${name} に返信`,
    deleteLabel: (name: string) => `${name} のコメントを削除`,
    replyLabel: (name: string) => `${name} に返信`,
    reply: '返信',
    replyPlaceholder: (name: string) => `${name} に返信...`,
    walletReplyReview: 'Web3 ウォレット利用者の返信は審査が必要な場合があります。',
    loginToReply: 'ログインすると返信できます。',
    deleteTitle: 'このコメントを削除しますか？',
    deleteDescription: 'この操作は元に戻せません。',
    adminAvatarAlt: '管理者アバター',
    sessionAvatarAlt: '自分のアバター',
    openGithubProfile: (name: string) => `${name} の GitHub プロフィールを開く`,
  },
  friendLinkApplyModal: {
    ...baseMessages.en.friendLinkApplyModal,
    title: '相互リンク申請',
    description: [
      '技術ブログまたは日記サイト向け。HTTPS 必須、広告なし ~',
      '先に当サイトを追加し、サイトがアクセス可能で適切な内容であることを確認してください ~',
    ],
    copied: 'コピーしました',
    copySiteInfo: 'サイト情報をコピー',
    cancel: 'キャンセル',
    submitting: '送信中',
    submit: '送信',
    submitted: '相互リンク申請を送信しました。審査をお待ちください。',
    closeLabel: '相互リンク申請を閉じる',
    fields: {
      name: { label: 'サイト名', placeholder: 'Ailoxi' },
      email: { label: '連絡先メール（任意）', placeholder: 'your@email.com' },
      description: { label: 'サイト説明', placeholder: 'Golang / フルスタック開発 / 個人ブログ' },
      avatarUrl: { label: 'アバター URL', placeholder: 'https://example.com/avatar.webp' },
      siteUrl: { label: 'サイト URL', placeholder: 'https://www.mikuflare.com/' },
    },
  },
  loginModal: {
    ...baseMessages.en.loginModal,
    userInfoTitle: 'ユーザー情報',
    loginTitle: 'ログイン (ゝ∀･)',
    closeLabel: 'ログイン画面を閉じる',
    loading: '読み込み中',
    closeModalLabel: 'ダイアログを閉じる',
    signingIn: 'ログイン中...',
    adminDashboard: '管理画面へ',
    logout: 'ログアウト',
    walletAddress: 'ウォレットアドレス',
    walletSignInStatement: 'Ethereum ウォレットで www.mikuflare.com にログイン',
  },
}

const ruMessages = {
  ...baseMessages.en,
  common: {
    ...baseMessages.en.common,
    empty: 'Здесь пока ничего нет.',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    pending: 'Подождите',
    pageLoading: 'Загрузка страницы',
    quickSettings: 'Быстрые настройки',
    backgroundMusic: 'Фоновая музыка',
    appearance: 'Оформление',
    lightTheme: 'Светлая',
    darkTheme: 'Тёмная',
    skyTime: 'Время неба',
    cloudSpeed: 'Скорость облаков',
    cloudMotion: 'Анимация облаков',
    phase: 'Время суток',
    skyPhases: {
      midnight: 'Полночь',
      dawn: 'Рассвет',
      morning: 'Утро',
      noon: 'Полдень',
      afternoon: 'День',
      sunset: 'Закат',
      night: 'Ночь',
    },
  },
  header: {
    ...baseMessages.en.header,
    homeLabel: 'На главную',
    navigationLabel: 'Основная навигация',
    switchLanguageLabel: 'Сменить язык',
    routes: { blog: 'Блог', friends: 'Ссылки', login: 'Войти', language: 'Яз.' },
  },
  home: {
    ...baseMessages.en.home,
    avatarAlt: 'Аватар Ailoxi',
    greeting: 'Привет! Я Ailoxi ( ^¯꒳¯^ )ﾉﾉ',
    role: 'Go / Cloud full-stack разработчик ⸜( *ˊᵕˋ* )⸝',
    about: [
      {
        id: 'career',
        paragraphs: [
          'Выпускаюсь в 2027 году; основные направления — Go backend, автоматизация и облачные сервисы.',
          'Мне нравится превращать повторяющиеся задачи в инструменты с помощью Python и AI φ(-ω-*)',
        ],
      },
      {
        id: 'engineering',
        paragraphs: [
          'Часто работаю с Linux, Docker, CI/CD и self-hosted сервисами.',
          'Мне нравится не только писать код, но и доводить до ума развёртывание, эксплуатацию и поддержку ( ˙◞˙ )',
        ],
      },
      {
        id: 'creative',
        paragraphs: [
          'Иногда использую Blender для 3D и визуальных экспериментов.',
          'Мне нравится переключаться между кодом, системами и творческими инструментами.',
        ],
      },
      { id: 'motto', paragraphs: ['У серого нет конца, а звёздный свет ещё не покинул сцену.'] },
    ],
    techStackLabel: 'Технологии',
    socialLinksLabel: 'Социальные ссылки',
    copyrightName: 'Ailoxi',
  },
  friends: {
    apply: 'Добавить ссылку',
    visitSite: (name: string) => `Открыть сайт ${name}`,
  },
  comments: {
    ...baseMessages.en.comments,
    title: 'Комментарии',
    count: (total: number) => `Комментариев: ${total}`,
    noComments: 'Комментариев пока нет. Оставьте первый.',
    loginPrompt: 'Войдите, чтобы оставить комментарий.',
    loginToComment: 'Войти и комментировать',
    publish: 'Опубликовать',
    sortOrder: { asc: 'Сначала старые', desc: 'Сначала новые' },
    switchSortOrder: { asc: 'Показать старые первыми', desc: 'Показать новые первыми' },
    empty: 'Комментарии отображаются по времени, ответы вложены в соответствующие ветки.',
    admin: 'Администратор',
    you: 'Вы',
    deletedStatus: '(удалено)',
    deleted: 'Удалено',
    replyTo: (name: string) => `Ответ для ${name}`,
    deleteLabel: (name: string) => `Удалить комментарий ${name}`,
    replyLabel: (name: string) => `Ответить ${name}`,
    reply: 'Ответить',
    replyPlaceholder: (name: string) => `Ответить ${name}...`,
    loginToReply: 'Войдите, чтобы ответить.',
    deleteTitle: 'Удалить этот комментарий?',
    deleteDescription: 'Это действие нельзя отменить.',
    adminAvatarAlt: 'Аватар администратора',
    sessionAvatarAlt: 'Мой аватар',
    openGithubProfile: (name: string) => `Открыть профиль ${name} на GitHub`,
  },
  friendLinkApplyModal: {
    ...baseMessages.en.friendLinkApplyModal,
    title: 'Заявка на ссылку',
    copied: 'Скопировано',
    copySiteInfo: 'Скопировать данные сайта',
    cancel: 'Отмена',
    submitting: 'Отправка',
    submit: 'Отправить',
    submitted: 'Заявка отправлена на проверку.',
    closeLabel: 'Закрыть форму',
    fields: {
      name: { label: 'Название сайта', placeholder: 'Ailoxi' },
      email: { label: 'Email для связи (необязательно)', placeholder: 'your@email.com' },
      description: { label: 'Описание сайта', placeholder: 'Golang / Full-stack / Личный блог' },
      avatarUrl: { label: 'URL аватара', placeholder: 'https://example.com/avatar.webp' },
      siteUrl: { label: 'URL сайта', placeholder: 'https://www.mikuflare.com/' },
    },
  },
  loginModal: {
    ...baseMessages.en.loginModal,
    userInfoTitle: 'Информация о пользователе',
    loginTitle: 'Вход (ゝ∀･)',
    closeLabel: 'Закрыть окно входа',
    loading: 'Загрузка',
    closeModalLabel: 'Закрыть окно',
    signingIn: 'Вход...',
    adminDashboard: 'Открыть панель',
    logout: 'Выйти',
    walletAddress: 'Адрес кошелька',
    walletSignInStatement: 'Войти на www.mikuflare.com через Ethereum-кошелёк',
  },
}

const deMessages = {
  ...baseMessages.en,
  common: {
    ...baseMessages.en.common,
    empty: 'Hier ist noch nichts.',
    cancel: 'Abbrechen',
    confirm: 'Bestätigen',
    pending: 'Bitte warten',
    pageLoading: 'Seite wird geladen',
    quickSettings: 'Schnelleinstellungen',
    backgroundMusic: 'Hintergrundmusik',
    appearance: 'Darstellung',
    lightTheme: 'Hell',
    darkTheme: 'Dunkel',
    skyTime: 'Himmelszeit',
    cloudSpeed: 'Wolkengeschwindigkeit',
    cloudMotion: 'Wolkenanimation',
    phase: 'Tageszeit',
    skyPhases: {
      midnight: 'Mitternacht',
      dawn: 'Morgengrauen',
      morning: 'Morgen',
      noon: 'Mittag',
      afternoon: 'Nachmittag',
      sunset: 'Sonnenuntergang',
      night: 'Nacht',
    },
  },
  header: {
    ...baseMessages.en.header,
    homeLabel: 'Zur Startseite',
    navigationLabel: 'Hauptnavigation',
    switchLanguageLabel: 'Sprache wechseln',
    routes: { blog: 'Blog', friends: 'Links', login: 'Login', language: 'Spr.' },
  },
  home: {
    ...baseMessages.en.home,
    avatarAlt: 'Ailoxis Avatar',
    greeting: 'Hallo! Ich bin Ailoxi ( ^¯꒳¯^ )ﾉﾉ',
    role: 'Go / Cloud Full-Stack-Entwickler ⸜( *ˊᵕˋ* )⸝',
    about: [
      {
        id: 'career',
        paragraphs: [
          'Ich schließe mein Studium 2027 ab und konzentriere mich auf Go-Backend-Entwicklung, Automatisierung und Cloud-Dienste.',
          'Mit Python und AI verwandle ich gerne wiederkehrende Aufgaben in nützliche Werkzeuge φ(-ω-*)',
        ],
      },
      {
        id: 'engineering',
        paragraphs: [
          'Im Alltag beschäftige ich mich viel mit Linux, Docker, CI/CD und Self-Hosting.',
          'Ich schreibe nicht nur Code, sondern kümmere mich auch gern um Deployment, Betrieb und Wartung ( ˙◞˙ )',
        ],
      },
      {
        id: 'creative',
        paragraphs: [
          'Gelegentlich nutze ich Blender für 3D- und visuelle Experimente.',
          'Ich wechsle gern zwischen Code, Systemen und kreativen Werkzeugen.',
        ],
      },
      { id: 'motto', paragraphs: ['Grau kennt kein Ende, und das Sternenlicht verlässt die Bühne noch nicht.'] },
    ],
    techStackLabel: 'Tech-Stack',
    socialLinksLabel: 'Soziale Links',
    copyrightName: 'Ailoxi',
  },
  friends: {
    apply: 'Link beantragen',
    visitSite: (name: string) => `Website von ${name} öffnen`,
  },
  comments: {
    ...baseMessages.en.comments,
    title: 'Kommentare',
    count: (total: number) => `${total} Kommentare`,
    noComments: 'Noch keine Kommentare. Schreibe den ersten.',
    loginPrompt: 'Melde dich an, um zu kommentieren.',
    loginToComment: 'Anmelden und kommentieren',
    publish: 'Veröffentlichen',
    sortOrder: { asc: 'Älteste zuerst', desc: 'Neueste zuerst' },
    switchSortOrder: { asc: 'Älteste zuerst anzeigen', desc: 'Neueste zuerst anzeigen' },
    empty: 'Kommentare werden chronologisch angezeigt; Antworten erscheinen eingerückt im jeweiligen Thread.',
    admin: 'Admin',
    you: 'Du',
    deletedStatus: '(gelöscht)',
    deleted: 'Gelöscht',
    replyTo: (name: string) => `Antwort an ${name}`,
    deleteLabel: (name: string) => `Kommentar von ${name} löschen`,
    replyLabel: (name: string) => `${name} antworten`,
    reply: 'Antworten',
    replyPlaceholder: (name: string) => `${name} antworten...`,
    loginToReply: 'Melde dich an, um zu antworten.',
    deleteTitle: 'Diesen Kommentar löschen?',
    deleteDescription: 'Diese Aktion kann nicht rückgängig gemacht werden.',
    adminAvatarAlt: 'Admin-Avatar',
    sessionAvatarAlt: 'Mein Avatar',
    openGithubProfile: (name: string) => `GitHub-Profil von ${name} öffnen`,
  },
  friendLinkApplyModal: {
    ...baseMessages.en.friendLinkApplyModal,
    title: 'Link beantragen',
    copied: 'Kopiert',
    copySiteInfo: 'Website-Daten kopieren',
    cancel: 'Abbrechen',
    submitting: 'Wird gesendet',
    submit: 'Senden',
    submitted: 'Der Antrag wurde zur Prüfung eingereicht.',
    closeLabel: 'Link-Antrag schließen',
    fields: {
      name: { label: 'Website-Name', placeholder: 'Ailoxi' },
      email: { label: 'Kontakt-E-Mail (optional)', placeholder: 'your@email.com' },
      description: { label: 'Website-Beschreibung', placeholder: 'Golang / Full-Stack / Persönlicher Blog' },
      avatarUrl: { label: 'Avatar-URL', placeholder: 'https://example.com/avatar.webp' },
      siteUrl: { label: 'Website-URL', placeholder: 'https://www.mikuflare.com/' },
    },
  },
  loginModal: {
    ...baseMessages.en.loginModal,
    userInfoTitle: 'Benutzerinformationen',
    loginTitle: 'Login (ゝ∀･)',
    closeLabel: 'Login-Fenster schließen',
    loading: 'Wird geladen',
    closeModalLabel: 'Dialog schließen',
    signingIn: 'Anmeldung...',
    adminDashboard: 'Dashboard öffnen',
    logout: 'Abmelden',
    walletAddress: 'Wallet-Adresse',
    walletSignInStatement: 'Mit Ethereum-Wallet bei www.mikuflare.com anmelden',
  },
}

export const messages = {
  zh: baseMessages.zh,
  en: baseMessages.en,
  'zh-tw': zhTwMessages,
  ja: jaMessages,
  ru: ruMessages,
  de: deMessages,
} as const satisfies Record<Language, object>