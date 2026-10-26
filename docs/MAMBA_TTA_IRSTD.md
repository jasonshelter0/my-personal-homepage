# Mamba × TTT 单帧 IRSTD 学习手册

主题路径：`mamba-tta-irstd`。源材料来自 `/home/jasonshelter/Projects/paper-20261024/irstd-learning`，本项目将其完整接入共享 Astro Layout，不嵌入另一个站点框架。

## 路由与内容

- 默认语言入口：`/learn/mamba-tta-irstd/`。
- 完整语言入口：`/zh-cn/learn/mamba-tta-irstd/`、`/en/learn/mamba-tta-irstd/`、`/fr/learn/mamba-tta-irstd/`。
- 章节后缀：`foundations/`、`mamba/`、`vmamba/`、`tent/`、`cotta/`、`frontier/`、`ttt/`、`ttt-vision/`、`irstd/`、`ttt-plan/`、`lab/`、`references/`。
- 共 13 页 × 3 语言，11 学习单元与 8 种交互实验。各章节均有默认语言别名。

正文位于 `apps/site/src/content/learn/mamba-tta-irstd/{zh-CN,en,fr}.json`。`lib/learning.ts` 校验可用内部章节链接、消毒 HTML，并用调用方的 `href()` 保留预览前缀。标题、canonical、语言 alternates、搜索、备案和光晕统一复用 Layout。

`LearningLesson.astro`、`learning.css`、`learning-interactions.js`、`learning-ui.js` 及三个 `ttt-*` 模块 提供限定于 `.learning-course` 的深色移动布局和三语言交互。新增内容为已审核源码，不依赖 CMS 草稿或新数据库字段。以后从后台发布内容时仍会随 Astro 构建生成。

## 教学与数据边界

当前主线为 Mamba 表征背景 → TTT 内外循环 → 文本到视觉 → 单帧 IRSTD 复现。补充 ViT³ / ViTTT（arXiv2025、CVPR2026）与 Vision-TTT（固定2026 v1原文），明确二者是不同论文及候选模型，组内 baseline 身份仍未确认。Tent、CoTTA、SAR 及原有协议演示保留为 TTA 概念对照，不再默认加入当前实验矩阵。原 URL `mamba-tta-irstd` 保持稳定。

新增 `ttt-learning.js`、`ttt-learning-ui.js`、`ttt-interactions.js`：

- `ttt-inner` 计算标量 L=½(wk−v)²，展示状态/损失轨迹、单步/重置、负值与零步、稳定边界；不是检测网络训练。默认一步 w=.2、读出=.6。
- `ttt-plan` 选择 S0/B0/B1/B2/H0/H1，导出复现草案。B2只改变内循环步数；研究级IR改动另记R1。各配置缺少实测速率时不估时；切换B组分辨率会清空失效测速，固定分辨率S0/H0/H1不变。
- GPU-hours表示总工作量，墙钟估计是受最长单次运行约束的理想下界，不承诺训练时间。40–48GB与24–48GPU-hours为起步预算，不是已测最低需求。网站不运行GPU任务。

进度在浏览器中按课程保存，语言切换共享完成状态；笔记按课程、章节和语言保存。拒绝 localStorage 时提示手动保存，不上传任何笔记。JSON 导出仅为协议草案。

## 首次集成验证（2026-10-25，历史）

依次通过 `npm ci`、`npm run typecheck`、`npm run build`、`npm test`（27 项）、`npm run test:e2e`（13 项）。新增测试覆盖：

- 三语言正文结构、题目答案和演示一致性，英法无残留中文。
- HTML 消毒、预览前缀、canonical 与 sitemap。
- 33 页真实 Chromium / 360px 无横向溢出。
- 六演示初始化、测验、笔记、进度、协议下载、搜索与语言切换。
- 既有编辑、发布、回滚、稿件隔离和鼠标光晕回归。

集成测试通过 `--test-concurrency=1` 串行运行：独立测试进程的发布器共用 Astro 源码下的 prerender 工作目录，并发构建会竞争同一中间文件。生产应用自身已通过发布队列串行构建。

## TTT 扩展验证（2026-10-26）

类型检查、生产构建与 78 项单元/API 测试通过。浏览器全量运行 41 项通过，一项新增预览测试的入口导航修正后，5 项学习测试在生产式预览前缀下全部复验通过；合计覆盖 42 个不同案例。真实 HTTPS 私有预览及公开检查均覆盖 39 个三语课程页、9 个既有课程页、320px 手机布局、2560px 沉浸/全屏、搜索、语言切换、SEO、备案与资源；浏览器错误为 0。TTT 计算器与复现矩阵三语交互/导出全部通过。

## 发布与回滚

最新 TTT 扩展于 `2026-10-26T14:10:34.257Z` 完成真实 HTTPS 发布验收。入口：<https://www.jasonshelter.com/learn/mamba-tta-irstd/>。源码 `20f9419`，当前内容 `mvpbw31u-d49d7fc9`；实际镜像、备份和回滚以根目录 `RELEASE_HANDOFF.md` 最新记录为准。

新增 `scripts/rebuild-published.ts --expected-current <verified-id>` 仅基于已发布冻结快照构建新版本，不保存草稿、不自动发布。必须随后打开真实鉴权预览并检查，才能通过正常发布端点切换内容。该脚本拒绝预期当前版本不匹配和已有构建，避免用旧交接 ID 或并发发布覆盖现场。
