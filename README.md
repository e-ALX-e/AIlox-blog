# AIlox Blog

Ailoxi（黯留星）的个人全栈技术博客。

当前站点：<https://www.mikuflare.com>

本仓库基于 [yeyu-blog](https://github.com/yeyuqwer/yeyu-blog) 进行二次开发，在保留原项目核心架构的基础上，加入了自托管部署、MinIO / S3 图片存储、个人品牌与界面定制等改动。

## 功能

- 中英文首页、日志与友链页面
- Markdown / GFM 渲染、代码高亮、表格、任务列表等
- 博客图片上传与文章内图片展示
- 自定义 Markdown 图片尺寸语法
- 评论、回复、删除与管理员标识
- GitHub OAuth / Google OAuth / Web3 钱包登录
- 博客、标签、友链、评论后台管理
- 主题切换、天空背景与背景音乐
- Ailoxi 自定义头像、Logo、技术栈与 SEO 信息
- Docker Compose 自托管部署
- PostgreSQL + Drizzle ORM
- MinIO / S3 兼容对象存储
- 可配合 Cloudflare Tunnel 对外提供 HTTPS 访问

## 技术栈

- Next.js 16
- React 19
- TypeScript 7
- Tailwind CSS 4
- Radix UI / Base UI
- Motion
- Better Auth
- Drizzle ORM
- PostgreSQL
- TanStack Query / TanStack Table
- Zustand
- Unified / Remark / Rehype
- AWS SDK S3 Client
- MinIO
- Docker / Docker Compose

## 相比上游的主要改动

本仓库针对个人使用与自托管场景进行了较多调整，包括：

- 将站点品牌修改为 **Ailoxi / 黯留星**
- 将站点域名和 SEO 信息修改为 `www.mikuflare.com`
- 使用自定义 Ailoxi 手写 Logo 动画
- 替换首页头像、技术栈图标与个人介绍
- 图片存储从 UploadThing 调整为 **MinIO / S3 兼容存储**
- 新增 `/api/media/upload` 图片上传接口
- 新增 `/media/[...key]` 图片读取路由
- 后台 Markdown 编辑器支持粘贴 / 拖拽上传图片
- Markdown 图片支持自定义显示宽度
- 新增 Dockerfile、Docker Compose 与 PostgreSQL / MinIO 部署配置
- 调整评论头像、登录用户头像、友链头像等显示逻辑

## Markdown 图片尺寸

普通 Markdown 图片默认使用文章可用宽度：

```md
![图片说明](/media/blog/example.webp)
```

也可以在图片说明后添加尺寸：

```md
![图片说明|80%](/media/blog/example.webp)
![图片说明|50%](/media/blog/example.webp)
![图片说明|600px](/media/blog/example.webp)
```

未指定尺寸时保持默认最大宽度。

## 本地开发

需要准备：

- Git
- Node.js 20+
- pnpm
- PostgreSQL
- S3 兼容对象存储，例如 MinIO
- GitHub OAuth App
- Google OAuth Client

安装依赖：

```bash
git clone https://github.com/e-ALX-e/AIlox-blog.git
cd AIlox-blog

pnpm install
```

创建本地环境变量文件，并至少配置：

```env
SITE_URL=http://localhost:3000

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE

BETTER_AUTH_SECRET=
ADMIN_EMAILS=admin@example.com
ADMIN_WALLET_ADDRESS=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=ailox-blog
S3_REGION=us-east-1

SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
MAIL_TO=
```

其中 SMTP 整组配置为可选；不使用邮件通知时应全部留空。

生成 Better Auth 密钥：

```bash
openssl rand -base64 32
```

启动开发环境：

```bash
pnpm dev
```

默认地址：

```text
http://localhost:3000
```

后台：

```text
http://localhost:3000/admin
```

## OAuth 回调地址

本地开发：

```text
GitHub:
http://localhost:3000/api/auth/callback/github

Google:
http://localhost:3000/api/auth/callback/google
```

生产环境：

```text
GitHub:
https://www.mikuflare.com/api/auth/callback/github

Google:
https://www.mikuflare.com/api/auth/callback/google
```

## AI 多语言翻译

后台新增 `/admin/translation` 模型配置页，可配置任意兼容 OpenAI Chat Completions 的第三方模型接口：

- API Base URL
- 模型名称
- API Key
- 自动翻译开关

API Key 会使用服务端 `BETTER_AUTH_SECRET` 派生密钥进行 AES-256-GCM 加密后保存到 PostgreSQL，不会在后台接口中回显明文。

当前文章语言：

- `/zh`：简体中文原文
- `/en`：English
- `/zh-tw`：繁體中文
- `/ja`：日本語
- `/ru`：Русский
- `/de`：Deutsch

文章首次发布时会自动生成并持久化其它语言版本；已发布文章修改标题或 Markdown 正文并保存时，会立即重新翻译并更新对应语言版本。若翻译失败或译文已经落后于原文，前台会回退显示中文原文，避免展示过期译文。

后台同时统计翻译 API 返回的输入 Token、输出 Token、总 Token 和调用次数，并按目标语言汇总。模型供应商未返回 `usage` 时，对应 Token 数会记录为 0。

已有文章可以在后台 AI 翻译页面点击“重新翻译全部已发布文章”进行一次性补齐。

## Docker 部署

仓库已包含：

```text
Dockerfile
compose.yaml
README-DOCKER.md
```

构建并启动应用：

```bash
docker compose build app && \
docker compose up -d --force-recreate app
```

完整的数据库初始化、备份、恢复和 Docker 部署说明见：

[README-DOCKER.md](./README-DOCKER.md)

当前 Compose 架构主要包含：

```text
Browser
   ↓
Cloudflare / Tunnel
   ↓
Next.js App
   ├── PostgreSQL
   └── MinIO
```

生产环境建议只将应用监听在本机地址，再通过反向代理或 Cloudflare Tunnel 暴露公网 HTTPS。

## 图片存储

博客图片使用 S3 API 存储，目前主要面向 MinIO。

上传接口：

```text
POST /api/media/upload
```

读取路径：

```text
/media/<object-key>
```

当前上传接口支持：

- JPEG
- PNG
- WebP
- GIF
- AVIF

单张图片最大为 4 MB。

## 常用命令

```bash
# 开发
pnpm dev

# 构建
pnpm build

# TypeScript 检查
pnpm ts:check

# 代码检查
pnpm lint

# 自动修复
pnpm lint:fix

# 未使用代码 / 依赖检查
pnpm knip
```

## 主要配置位置

- `config/seo/index.ts`：SEO、站点名称和域名
- `lib/i18n/messages.ts`：中英文文案
- `config/img/Ailoxi.png`：站点头像
- `ui/(main)/(home)/profile-section.tsx`：首页资料
- `ui/(main)/(home)/tech-stack.tsx`：首页技术栈
- `ui/(main)/layout/header/`：顶部导航与 Ailoxi Logo
- `ui/admin/`：后台管理界面
- `lib/core/markdown/`：Markdown 处理与扩展
- `lib/infra/storage/s3.ts`：S3 / MinIO 客户端
- `compose.yaml`：Docker Compose 服务配置

## License & Attribution

本项目遵循 **MIT License**。

本仓库是 [yeyu-blog](https://github.com/yeyuqwer/yeyu-blog) 的二次开发版本。

原项目版权声明：

```text
Copyright (c) 2025 Ye Yu
```

根据 MIT License 的要求，本仓库保留原项目的版权声明和许可证文本。完整许可证请查看 [LICENSE](./LICENSE)。

本仓库中的二次开发、个人化配置与新增功能由 **Ailoxi（黯留星）** 维护。

MIT License 允许在遵守许可证条件的前提下使用、复制、修改、合并、发布、分发、再许可及销售软件副本。

---

Maintained by **Ailoxi / 黯留星**
