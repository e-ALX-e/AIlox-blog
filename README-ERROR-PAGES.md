# 插图错误页

博客的 `app/not-found.tsx`、`app/error.tsx` 和 `app/global-error.tsx` 共用 `ui/components/status-page.tsx`，使用真实透明背景的 PNG。页面呈现可选择的状态文字、返回博客按钮和错误边界重试操作，不向访客显示内部异常或 digest。

页面沿用明暗主题，并根据当前 URL 保留六种既有语言的首页地址。根布局发生异常时，`global-error.tsx` 自行提供 HTML、字体及主题恢复，保证错误页面可独立显示。

`/status/{code}` 提供 200、401、403、404、408、414、418、429、500、502、503、504 的插图预览，禁止搜索引擎索引。预览是正常 Next.js 页面，不会伪装成实际故障状态；真正的未知页面仍由 Next.js 返回 404，服务端异常仍由框架错误边界处理。502/504 分别复用维修和等待插图，文字保持各自状态。

验证使用 `pnpm install --frozen-lockfile`、`pnpm build`、`pnpm ts:check` 和对修改文件运行 Biome。无生产环境配置时，可以使用仓库现有 Dockerfile 中的构建占位变量进行本地编译验证；这些变量只用于构建，不用于生产登录、数据库或存储。

图片及页面随现有应用发布。本次改动不变更部署脚本或基础设施。Cloudflare 与外层代理产生的错误需在对应服务单独接入。
