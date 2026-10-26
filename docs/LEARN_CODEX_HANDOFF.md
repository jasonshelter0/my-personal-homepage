# 学习页面开发交接

2026-10-26 最新：LearnPyTorch 张量实验室已发布，入口 `/learn/learnpytorch/`，含中英法三语、三项挑战与自由实验。源码 `11731b7`，内容 `mvorvfm7-2c2fcfb4`。实现及限制见 `LEARNPYTORCH.md`；当前镜像、备份和回滚以 `RELEASE_HANDOFF.md` 顶部 LearnPyTorch 章节为准。后续部署必须保留此课程。

2026-10-25 最新：Git 模拟器已与主站深蓝/青绿主题统一并完成线上验收，源码 `0855e4f`、内容 `mvnz3t4d-fb9699f6`。当前部署/备份/回滚以 RELEASE_HANDOFF.md 顶部主题章节为准。

2026-10-25 更新：Git 目标窗口手机宽度修复已发布并验收，运行源码 `34cf36e`、内容 `mvntcxim-e5d321e2`。当前镜像、备份与回滚以 `RELEASE_HANDOFF.md` 顶部 Git 修复章节为准。

项目：`/home/jasonshelter/Projects/personal-website`。仓库：`https://github.com/jasonshelter0/my-personal-homepage`。部署状态、实际版本、产物校验和与生产操作说明以仓库根目录 `RELEASE_HANDOFF.md` 为准。

## 本次已实现

- `https://www.jasonshelter.com/learn/` 是稳定入口，跳转到后台配置的默认语言（当前为简体中文）。无尾斜杠的 `/learn` 由静态服务规范化。
- 完整语言页为 `/zh-cn/learn/`、`/en/learn/`、`/fr/learn/`，语言切换保持学习栏目。
- 学习主页复用正式站的深色配色、柔和鼠标光晕、导航、搜索与页底备案链接。
- 学习主页由 `lib/learning-catalog.ts` 列出源码课程：`mamba-tta-irstd`（11 章 × 3 语言）与 `git-branching`（3 语言及本地模拟器）。现有文章入口保留。
- 课程详情进入各语言 Pagefind 和 sitemap。Mamba 课程提供公式演示、测验、协议导出及浏览器本地笔记/进度；Git 提供同源 iframe 模拟器。教学模拟不执行真实机器学习训练，也不访问真实 Git 仓库。

## 文件位置

| 文件                                              | 职责                                              |
| ------------------------------------------------- | ------------------------------------------------- |
| `apps/site/src/pages/learn.astro`                 | 无语言前缀的稳定入口，跳转至默认语言              |
| `apps/site/src/pages/[...path].astro`             | 三语言静态路由生成，当前含 `learn` 栏目           |
| `apps/site/src/components/LearningHub.astro`      | 学习主页内容与布局                                |
| `apps/site/src/lib/data.ts`                       | 语言文案、快照读取、路由和媒体路径、Markdown 消毒 |
| `apps/site/src/layouts/Layout.astro`              | 全站布局、语言导航、搜索、SEO                     |
| `apps/site/src/components/ComplianceFooter.astro` | 底部中央的 `京ICP备2024092234号-1` 及工信部链接   |
| `apps/site/src/styles/global.css`                 | 主题与 `.learn-*` 样式                            |
| `shared/types.ts`、`server/schema.ts`             | CMS 内容模型及服务端校验                          |
| `server/store.ts`、`server/publisher.ts`          | SQLite 草稿持久化、冻结发布、预览和回滚           |

## 当前源码课程

- Mamba：`docs/MAMBA_TTA_IRSTD.md`；完整三语 JSON 位于 `apps/site/src/content/learn/mamba-tta-irstd/`。
- Git：`docs/GIT_BRANCHING.md`；`GitLearningLesson.astro` 与 `public/learn-assets/git-branching/`。
- 详情路由：`pages/[locale]/learn/[...lesson].astro`；默认语言别名：`pages/learn/[...lesson].astro`。
- 共享目录 `learning-catalog.ts` 同时驱动主页卡片、别名与 sitemap；增加课程时也要更新详情路由映射。
- 静态课程来自已审核源码；CMS 草稿模型保持不变。浏览器学习记录不上传服务器。

## 后续添加学习内容

先确认内容范围，再选择扩展方式。不要为了添加学习文章另建数据库或绕过现有编辑审核流程。

1. 普通学习笔记可以先作为现有 `page` 或 `post` 条目存储，使用统一的 `learn` 标签分类。它们已经拥有三语言正文、封面、Markdown、草稿、审核和数据库持久化能力。下一位 Codex 可以让学习主页从已发布条目中筛选该标签；在这一步完成前，添加标签本身不会自动改变学习主页。
2. 若需要学习栏目专属 URL，预留 `/<locale>/learn/<slug>/`，例如 `/zh-cn/learn/linear-algebra/`。在 Astro 的路由生成中添加明确映射并处理 slug 唯一性；可用 `apps/site/src/pages/[locale]/learn/[slug].astro` 承载详情。将 `/learn/<slug>/` 作为默认语言别名时也要显式实现，不能依赖 SPA 回退。目前已通过上述 catch-all 路由实现；新增课程应扩展其显式映射，避免建立冲突路由。
3. 路由别名与既有 `/pages/`、`/posts/` URL 共存时，选定一个 canonical 地址，更新卡片链接、sitemap、RSS 和语言切换；有公开旧链接时保留兼容重定向。
4. 若需要课程层级、章节关系或学习进度，再设计向后兼容的字段和迁移。当前内容保存在 SQLite 的草稿快照中，发布版本和媒体另存在持久目录。新增类型必须同时修改 TypeScript 类型、Zod 校验、后台编辑 UI、三语言文案、完整性检查、静态路由、搜索过滤和回归测试。不能只改前台类型断言。
5. 学习页面应调用 `Layout` 并传入正确的 `locale`、`path`、标题和摘要；所有语言都要提供完整内容。保留 `data-pagefind-body`、标题元数据及 ICP 页脚。Markdown 使用现有 `markdown()` 消毒器，禁止直接渲染未处理 HTML。

## 生产预览与路径约束

正式构建的根路径为 `/`；私有预览会以 `FOLIO_BASE=/preview/<release-id>/` 单独构建并通过登录认证后提供。发布器冻结同一内容快照，生成公开 `dist/` 和私有 `preview-dist/`。

- 页面内部链接使用 `href(locale, path)`，资源使用 `withBase('/media/...')` 或 `media(id)`。不要硬编码 `/en/`、`/media/`、`/_astro/` 或 `/pagefind/`，否则会跳出私有预览。
- canonical、hreflang、RSS、sitemap 使用正式站地址和 `publicHref()`／`withoutBase()`，不能包含私有预览前缀。
- 客户端资源通过 `import.meta.env.BASE_URL` 获取构建根路径。Pagefind 导入路径及 `baseUrl` 选项都要跟随这个前缀。
- 不要在学习页接入后台 `/api/` 读取草稿。公开页面只来自已经审核、冻结并发布的快照。
- 学习页面不能占用 `/admin/`、`/api/`、`/preview/`、`/healthz`、`/media/`、`/pagefind/` 及 `/_astro/` 命名空间。

## 应用更新时保持生产内容与草稿

更新镜像后，当前公开网站仍指向旧的冻结产物。先记录实际 `current` ID，再在新容器运行 `node --import tsx scripts/rebuild-published.ts --expected-current <verified-id>`。此命令只从现有已发布快照构建，不覆盖数据库草稿，也不自动发布。打开并验证真实 HTTPS 私有预览之后，通过正常发布 API 切换。不要用后台普通“生成预览”替代此流程，因为它读取已保存草稿；不要使用未提供生产快照的演示初始化命令。

具体镜像、备份、内容 ID、最终验收与回滚参见根目录 `RELEASE_HANDOFF.md` 的最新记录。

## 验证与交付

运行 `npm ci`、`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e`。除了当前测试，还应针对新增内容验证：

- `/learn/` 的默认语言跳转、三个语言的学习入口与详情、404 和手机宽度无横向溢出。
- 学习页搜索结果、语言切换、图片放大、光晕和底部备案链接。
- 从后台新增学习内容后，保存草稿不改变公开页；打开预览后发布，正式页才变化；回滚恢复之前的内容。
- 同一语言页在正式根路径和 `/preview/<release-id>/` 下都能加载 CSS、JS、图片和 Pagefind，并且预览内跳转不离开预览。
- 未登录不能读取私有预览、草稿、数据库、上传源文件或发布快照。

只交付公开产物，勿将 `.env`、SQLite 文件、会话、SSH 私钥或服务器备份放进网站目录、截图或 Git。上线前读取 `/home/jasonshelter/Projects/connect/AGENTS.md` 和 `DEPLOYMENT_HANDOFF.md`，按本次明确授权操作；同一时刻只能有一个会话修改生产服务器。既有 WordPress 文件和原数据库需要按发布交接约定保留，不应由学习页面开发任务迁移或删除。
