# 管理员邮箱配置

## 本站新增账号

仓库在 `config/auth/site-admins.ts` 中明确增加 `3612996124@qq.com`。
它与服务器 `.env` 中已有的 `ADMIN_EMAILS` 名单取并集，不会删除或替换原管理员。
只匹配完整邮箱（忽略大小写），不会把 `3612996124@其他域名` 或整个 QQ 邮箱域设成管理员。

这项仓库配置仅在服务端配置的 `SITE_URL` 为以下 HTTPS 来源时生效：

- `https://www.mikuflare.com`
- `https://mikuflare.com`

`parseServerEnv` 会把站点 URL 规范化为 origin。匹配不依赖浏览器 URL、请求 Host、
Referer 或客户端传来的权限字段。其他域名、本地开发或复用此仓库的部署，仍只使用自己的
`ADMIN_EMAILS` 和原钱包管理员配置，不会自动授权上述 QQ 邮箱。

## 登录与权限

权限判断继续使用 Better Auth 已登录会话中的用户邮箱，`customSession` 调用统一的
`isAdminUser` 生成 `isAdmin`，后台的权限检查使用这个服务端会话标识。
新管理员可使用原有的后台文章、暗号与分享、翻译等管理功能。

这不是创建新登录账号，也不是新增 QQ 登录入口；GitHub、Google 和钱包登录方式不变。
第三方登录到本站后的实际账号邮箱必须是 `3612996124@qq.com`。
仅修改昵称、头像、个人简介或前端传入这个邮箱，不会得到管理员会话。
不改变现有环境名单、钱包判定、第三方身份验证或账号绑定策略。

文章的「管理员免暗号验证」仍按原来的逐篇开关控制。成为管理员不等于自动绕过
所有前台文章暗号；后台管理、编辑和创建分享的权限不受该开关影响。

## 部署与验证

不需要再手动向 `.env` 追加这一个邮箱，但必须保留已有的有效 `ADMIN_EMAILS`。
本次没有数据库、依赖或 Docker 编排变更。拉取 main 后重建镜像和应用容器：

```sh
docker compose build app && docker compose up -d --force-recreate app
```

更新后退出本站登录，再使用对应账号登录，检查后台入口。
如果仍未获得权限，检查本站会话的真实邮箱和服务器 `SITE_URL`，不要开放模糊邮箱匹配。
`printenv ADMIN_EMAILS` 只会显示环境名单，不会显示这项仓库内补充名单；以登录后的
服务端 `isAdmin` 判断为准。不要分享完整会话 Cookie 或凭据。

## 维护与撤销

后续新增站点专用管理员，可审查并修改 `config/auth/site-admins.ts`；普通部署仍可以
通过 `ADMIN_EMAILS` 自行管理名单。

要撤销本次新增账号，删除两个来源下对应邮箱并重新构建部署，同时确认 `.env` 的
`ADMIN_EMAILS` 中也没有该邮箱。只从 `.env` 删除它不会撤销仓库配置给予的权限。

## 回归检查

```sh
node --test tests/admin-access.test.cjs
pnpm ts:check
pnpm build
```

测试运行实际的站点名单与 `isAdminUser`，验证精确匹配、来源隔离、已有管理员及钱包
行为；使用隔离的环境配置和钱包地址识别适配器，不代替真实 OAuth 登录或完整应用构建。
