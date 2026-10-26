# Folio Studio

一个可在本地运行的个人网站与单人编辑后台。深色、极简、柔和鼠标光晕，完整支持简体中文、English 和 Français。示例项目、经历和个人介绍均为演示内容，不代表真实履历。

生产部署使用同域网关：正式站 `https://www.jasonshelter.com/`、后台 `/admin/`、学习入口 `/learn/`。部署记录、SQLite 数据路径、健康检查及回滚见 [RELEASE_HANDOFF.md](RELEASE_HANDOFF.md)；后续扩展学习页面请先读 [LEARN_CODEX_HANDOFF.md](docs/LEARN_CODEX_HANDOFF.md)。

## 界面预览

[桌面正式站](docs/screenshots/site-desktop.png) · [手机正式站](docs/screenshots/site-mobile.png) · [编辑后台](docs/screenshots/studio.png) · [光晕设置](docs/screenshots/glow-settings.png) · [后台光晕预览](docs/screenshots/admin-glow.png)

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

更新源码后，运行 `npm ci` 和 `npm run build:admin`，重启服务，再从后台创建预览、检查并发布。正式站使用冻结的静态版本，仅重启服务或运行 `npm run setup` 不会替换已发布页面；旧版本仍可回滚。

正式站的鼠标光晕跟随指针位置，颜色随主题强调色变化，在窄窗口使用鼠标时也可见。与参考网站一致，开启“减少动态效果”时仍保留直接跟随鼠标的光晕，但关闭平滑滚动及过渡动画。纯触屏操作不会激活光晕。

在后台「外观与导航 → 鼠标光晕半径」可通过滑块或数值输入调整大小（100–1200 px，默认 600 px），也可恢复默认值。保存只更新草稿，创建预览并发布后正式站才生效；旧数据自动使用默认半径，回滚会恢复该版本的设置。

正式站与后台共用柔和光晕：降低中心亮度、分段渐隐至透明，移入移出时轻柔淡入淡出。后台登录页使用默认配色和半径，登录后跟随当前草稿设置；在外观设置里调整颜色与半径可立即看到效果。光晕不会拦截点击或影响表单输入；“减少动态效果”设置下保留鼠标跟随并取消淡入淡出。

搜索按钮和搜索框提示会按访问者的系统显示快捷键：Windows/Linux 为 `Ctrl + K`，macOS 为 `⌘ K`。再次按快捷键或按 `Esc` 可关闭搜索。

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

资料和内容编辑页可选择翻译服务。默认提供免密钥的 **MyMemory**：官方匿名额度通常为每天 5,000 字符，本站每次最多发送 4,500 个源文字符；使用前会确认将源文发送给该服务。译文需校对、预览并发布才会公开。

也支持配置 `LIBRETRANSLATE_URL` 与可选 `LIBRETRANSLATE_API_KEY`，连接自己的 LibreTranslate 服务；商业公共端点不作为免费默认服务。原有 OpenAI 兼容 Chat Completions 服务继续支持：

```dotenv
TRANSLATION_BASE_URL=https://your-provider.example/v1
TRANSLATION_API_KEY=your-secret-key
TRANSLATION_MODEL=your-model
```

未配置的可选服务会显示但禁用，MyMemory 无需配置。密钥不会进入客户端。翻译会保留链接、代码和 Markdown 结构；额度不足、超时或结构无法安全处理时返回错误，不保存部分译文。覆盖已审核译文需要确认；翻译期间草稿发生变化时，旧请求不会覆盖新内容。

OpenAI 兼容服务需要支持对应 JSON 输出格式。服务详情、限制和配置见 [FREE_TRANSLATION.md](docs/FREE_TRANSLATION.md)。自动化测试使用模拟响应，不向外部服务发送草稿；另以合成示例句子验证了阿里云服务器到 MyMemory 的实际连通性。

外链图标已扩展为 **50 种**，包含微信、Goodreads、豆瓣、知乎、Google Scholar、ORCID 等；后台可搜索名称并预览。清单及来源见 [SOCIAL_ICONS.md](docs/SOCIAL_ICONS.md)。个人照片风格与生成提示词见 [PORTRAIT_PROMPT.md](docs/PORTRAIT_PROMPT.md)。

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

生产部署说明、实际产物、服务器验证和回滚命令见 [RELEASE_HANDOFF.md](RELEASE_HANDOFF.md)。生产模式通过同一域名提供正式站、`/admin/` 编辑器和登录后可见的 `/preview/<版本>/`。SQLite、媒体和发布版本保存在独立持久目录；公开页面不读取草稿。部署入口为现有 Nginx，Node 24 容器只监听服务器 loopback。WordPress 文件和原数据库保留，入口切换不等于迁移 WordPress 文章。

新增的 `/learn/` 是三语言学习空间入口；后续开发请阅读 [学习页面 Codex 交接](docs/LEARN_CODEX_HANDOFF.md)。正式页底部统一展示备案号及工信部查询链接。

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

24 项单元与集成测试、8 组 Chromium 端到端流程、TypeScript 检查及正式构建全部通过。浏览器流程实际完成了编辑保存、中英法切换、搜索、图片上传、三语言文章创建、预览发布、回滚与删除；光晕回归测试检查实际渲染像素、三语言首页和文章页、滚动定位、窄窗口、触屏及减少动态效果设置。新增半径的保存、发布隔离、回滚与旧数据兼容检查，以及模拟 Windows、Linux、macOS 平台的三语言快捷键测试。

## 自定义分区与版本整理

1.3.0支持在「外观与导航」新建、命名、排序、隐藏和删除首页分区，并配置三语正文及内容卡片；媒体替代文字、题注和分区文字可使用现有免费翻译服务。预览与发布列表可删除非当前、非构建中的历史版本。公开页面移除演示品牌与底部口号，设计参考集中在独立的三语「设计致谢」页面。操作、数据兼容性及回滚注意事项见 [分区与版本管理](docs/SECTIONS_AND_RELEASES.md)。

将新文章提炼为与默认项目图、文章图一致的抽象宽幅配图，可使用 [文章主旨配图提示词](docs/PASSAGE_IMAGE_PROMPT.md)。
