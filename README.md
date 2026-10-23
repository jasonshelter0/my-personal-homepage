# Folio Studio

一个可在本地运行的个人网站与单人编辑后台。深色、极简、柔和鼠标光晕，完整支持简体中文、English 和 Français。示例项目、经历和个人介绍均为演示内容，不代表真实履历。

## 界面预览

[桌面正式站](docs/screenshots/site-desktop.png) · [手机正式站](docs/screenshots/site-mobile.png) · [编辑后台](docs/screenshots/studio.png)

## 本地运行

需要 Node.js 24 或更新版本。

```bash
npm install
npm run setup
npm start
```

- 编辑后台：<http://127.0.0.1:4321/admin/>
- 私有发布预览：<http://127.0.0.1:4322/>（从后台版本列表打开）
- 本地正式站：<http://127.0.0.1:4323/>
- 默认本地演示密码：`local-demo-password`

首次 setup 构建编辑器并生成初始预览。登录后台，打开预览检查，然后点击发布，正式站即可访问。后续启动只需 `npm start`。已经存在的内容和发布版本会保留。三个地址请统一使用 `127.0.0.1`，不要混用 localhost，登录 Cookie 在同一主机的不同端口间共享。

需要自定义配置时，复制 `.env.example` 为 `.env`，然后运行 `npm run start:env`。默认只监听本机。非本机监听必须设置 `ADMIN_PASSWORD`。当前三端口的 Cookie 共享方式专为本地 demo 设计；线上分域部署需调整认证、HTTPS 与反向代理。

## 编辑与发布

1. 在资料、内容、主题、媒体界面编辑，保存草稿。
2. 中英法分别填写并审核。源文变动后，旧译文会显示过期。
3. 内容条目的“发布”状态表示加入下一次发布；保存不会改变正式站。
4. 检查发布清单，修复缺少正文、未审核、旧译文、缺少图片替代文本等问题。
5. 创建发布预览。系统冻结内容、主题和媒体引用，构建所有语言页面和 Pagefind 搜索索引。
6. 打开并检查该版本的真实静态预览，再发布。此后继续修改草稿不会改变已冻结的版本。
7. 历史版本可以恢复。恢复的是完整网页、图片、主题与搜索索引，不会改写正在编辑的草稿。

新文章、项目、信息页与经历都支持增删改查、排序、首页精选和草稿状态。正文使用 Markdown，支持工具栏、代码块、列表、引用和图片。媒体上传会生成 WebP，原始元信息不会直接暴露。封面及头像图片支持三语言替代文本与图注。

主题预设与自定义强调色、背景色共用同一组设计变量。首页支持栏目排序和显示开关，外链支持常用平台图标。正式站包含项目归档、文章列表、信息页、详情页、简历、语言切换、搜索、站点地图和 RSS。

## 自动翻译

支持 OpenAI 兼容的 Chat Completions 服务，通过服务器环境变量配置：

```dotenv
TRANSLATION_BASE_URL=https://your-provider.example/v1
TRANSLATION_API_KEY=your-secret-key
TRANSLATION_MODEL=your-model
```

没有配置时，界面明确显示未配置，翻译请求返回错误；不会生成伪翻译。密钥不会进入客户端。译文保留 Markdown，生成后需要人工审核。覆盖已审核译文需要确认；翻译期间如果草稿发生变化，旧请求不会覆盖新内容。

供应商需要支持对应 JSON 输出格式。真实供应商费用与连通性由所选服务决定；自动化测试使用本地 HTTP 测试服务验证接口、覆盖保护和并发冲突，不代表对任何付费供应商做过实际调用。

## 数据与备份

默认数据目录 `.folio/`（可通过 `FOLIO_DATA_DIR` 指定）：

```text
.folio/
  studio.sqlite          草稿与登录会话
  media/                 上传后的图片
  releases/<version>/
    snapshot.json        私有内容快照
    release.json         私有发布状态
    build.log            构建日志
    dist/                可公开托管的静态产物
  current.json           当前正式版本指针
  exports/               导出的静态版本
```

备份整个数据目录，并保留源码与 package-lock.json。最简单的一致性备份方式是停止服务后复制数据目录；运行中备份 SQLite 需要使用数据库在线备份方式，并协调媒体文件。不要只备份网页产物。

发布目录只包含公开网站需要的文件。草稿、数据库、会话、密钥与内容快照不应上传到公开托管服务。

## 导出与未来部署

```bash
npm run export
```

命令打印当前正式版本的静态文件目录，可放在 Nginx、Cloudflare Workers Static Assets 或 Pages 上。后台、图片元数据与数据库不依赖正式站在线运行。

本次交付范围是本地编辑器与本地 production demo，没有修改 DNS 或部署到公网。后续双站发布应上传同一版本目录，并分别记录国内与海外部署结果；跨服务商切换不是一个原子事务。Cloudflare 与阿里云需要各自的凭据、域名和相应配置，国内服务还需核实备案。

## 开发与验证

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

单元与集成测试覆盖完整性、译文过期、权限、CSRF、乐观锁、图片处理、翻译接口、真实静态构建、草稿隔离、预览门槛、发布与回滚。浏览器测试覆盖登录编辑、三语言页面、搜索、预览发布和移动端。

源码分工：`apps/site` 是 Astro 模板，`apps/admin` 是 React 编辑器，`server` 是 API 与发布服务，`shared` 是内容模型、演示内容与发布校验，`tests` 是验证。

## 本次验证结果

20 项单元与集成测试、2 组 Chromium 端到端流程、TypeScript 检查及正式构建全部通过。浏览器流程实际完成了编辑保存、中英法切换、搜索、图片上传、三语言文章创建、预览发布、回滚与删除。已在本地生成并发布初始演示版本。
