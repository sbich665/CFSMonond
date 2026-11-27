# CFSMonond

CFSMonond 是一个采用银蓝 Aqua 风格的 CF-Server-Monitor 第三方主题。它使用 Vue 3、Vite 和 hash 路由。首页位于 `/#/`，单机详情位于 `/#/server/:id`。

## 本地构建

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm build
```

`dist/` 的顶层产物为 `index.html` 和 `assets/`。同源安装时使用 Worker 注入的外观和站点配置。独立静态部署时，可以为 `pnpm build:github-page` 提供以下环境变量。

| 变量 | 用途 |
| ---- | ---- |
| `API_BASE` | Worker origin，多站以逗号分隔 |
| `TITLE` | 静态站点的标题回退值 |
| `BACKGROUND_IMAGE` | 静态站点背景图的 HTTPS URL |
| `CSP_API` | 额外 API origin，以逗号分隔 |
| `CSP_STATIC` | 静态资源 origin，以逗号分隔 |

跨域部署时，在每个 Worker 上配置 `CORS_ALLOWED_ORIGINS`，值为逗号分隔的纯 origin。私有站跨域访问使用主题所在 origin 的 `localStorage.jwt_token`。登录入口由 Worker 的内置管理页提供。启用 Turnstile 时，主题部署域也需要纳入该小组件的域名配置。

## 在 CF-Server-Monitor 中使用

在内置管理后台的外观设置中，使用下面的 GitHub tree 地址作为第三方主题。保存后从原来的 Worker 地址打开首页。

```text
https://github.com/sbich665/CFSMonond/tree/dist
```

同源安装时，主题从 Worker 读取 API 和站点外观配置。[CF-Server-Monitor 主题说明](https://github.com/huilang-me/CF-Server-Monitor#%E4%B8%BB%E9%A2%98%E4%B8%8E%E5%A4%96%E8%A7%82)

## 主题设置

总览默认展示全部服务器。左侧可按后台配置的服务器分组或注册区域筛选。总览标题旁的按钮可以直接收起或展开侧栏，收起时清除侧栏筛选。

登录后从工具栏打开「主题设置」。实时速度顺序可选择上行或下行在前。线路数可设为 0–8，设为 0 时收起该区。后台入口可独立控制是否显示，入口地址为 `/admin#/admin`。「显示服务器侧栏」决定打开总览时的默认状态。

设置修改后立即反映在页面上，短时间内连续修改会合并后自动保存。只有通过登录校验才会写入 `POST /api/theme_options`。保存失败时恢复上次保存的界面并提供重试。多站情况下，首个 Worker 保存整套主题选项。上游接口说明见 [主题开发 API](https://github.com/huilang-me/CF-Server-Monitor/blob/main/theme-develop.md)。

## 发布到 GitHub Pages

`main` 或 `master` 推送和手动触发都会构建，并把产物追加提交到 `dist`。生成提交沿用触发该次构建的源码提交说明。Actions 需要 `contents: write`。在仓库的 Settings → Pages 中选择 Deploy from a branch，托管源使用 `dist` 的根目录。

使用 GitHub 的内置 `GITHUB_TOKEN` 可以追加 `dist` 分支。要让工作流推送自动触发分支托管的 Pages 构建，请为工作流配置具有该仓库 Contents 写权限的 `PAGES_PUSH_TOKEN`。各运行时配置由仓库 Secrets 注入。[GitHub Pages 发布源说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#troubleshooting-publishing-from-a-branch)

## 验收

`pnpm test` 使用隔离的接口和 WebSocket 测试数据验证请求契约，包括公开／私有与 Turnstile 开／关的组合、凭证续换、字段增量合并和保存请求。发布前还需在可切换设置的 Worker 上逐项验证四种组合，包括浏览器中的真实 Turnstile、人机凭证复用、同域 Cookie 与跨域 JWT 的实时连接。
