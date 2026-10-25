# Mamba × TTA/TTT 单帧 IRSTD 学习手册

主题路径：`mamba-tta-irstd`。源材料来自 `/home/jasonshelter/Projects/paper-20261024/irstd-learning`，本项目将其完整接入共享 Astro Layout，不嵌入另一个站点框架。

## 路由与内容

- 默认语言入口：`/learn/mamba-tta-irstd/`。
- 完整语言入口：`/zh-cn/learn/mamba-tta-irstd/`、`/en/learn/mamba-tta-irstd/`、`/fr/learn/mamba-tta-irstd/`。
- 章节后缀：`foundations/`、`mamba/`、`vmamba/`、`tent/`、`cotta/`、`frontier/`、`ttt/`、`irstd/`、`lab/`、`references/`。
- 共 11 页 × 3 语言，9 学习单元与 6 交互实验。各章节均有默认语言别名。

正文位于 `apps/site/src/content/learn/mamba-tta-irstd/{zh-CN,en,fr}.json`。`lib/learning.ts` 校验可用内部章节链接、消毒 HTML，并用调用方的 `href()` 保留预览前缀。标题、canonical、语言 alternates、搜索、备案和光晕统一复用 Layout。

`LearningLesson.astro`、`learning.css`、`learning-interactions.js`、`learning-ui.js` 提供限定于 `.learning-course` 的深色移动布局和三语言交互。新增内容为已审核源码，不依赖 CMS 草稿或新数据库字段。以后从后台发布内容时仍会随 Astro 构建生成。

## 教学与数据边界

以 VMamba、Tent、CoTTA 为主线，补充 Mamba、Mamba-2、SAR、RoTTA、DeYO、TTT layers、MiM-ISTD、IRMamba，保留原文链接。新增文献集中 2023–2025，原始 TTT 2020 仅作前史。

演示只计算教学公式，不运行神经网络、不虚构实验指标。IRSTD 方案为待验证假设。实验协议区分每图重置/持续更新与输出时序，默认先适应再预测；每图重置且先预测的退化情形有明确提示。

进度在浏览器中按课程保存，语言切换共享完成状态；笔记按课程、章节和语言保存。拒绝 localStorage 时提示手动保存，不上传任何笔记。JSON 导出仅为协议草案。

## 本地验证（2026-10-25）

依次通过 `npm ci`、`npm run typecheck`、`npm run build`、`npm test`（27 项）、`npm run test:e2e`（13 项）。新增测试覆盖：

- 三语言正文结构、题目答案和演示一致性，英法无残留中文。
- HTML 消毒、预览前缀、canonical 与 sitemap。
- 33 页真实 Chromium / 360px 无横向溢出。
- 六演示初始化、测验、笔记、进度、协议下载、搜索与语言切换。
- 既有编辑、发布、回滚、稿件隔离和鼠标光晕回归。

集成测试通过 `--test-concurrency=1` 串行运行：独立测试进程的发布器共用 Astro 源码下的 prerender 工作目录，并发构建会竞争同一中间文件。生产应用自身已通过发布队列串行构建。

## 发布与回滚

实际线上应用镜像、内容 release、备份和验证结果以根目录 `RELEASE_HANDOFF.md` 最新记录为准。此文档的本地测试通过不代表已发布。

新增 `scripts/rebuild-published.ts --expected-current <verified-id>` 仅基于已发布冻结快照构建新版本，不保存草稿、不自动发布。必须随后打开真实鉴权预览并检查，才能通过正常发布端点切换内容。该脚本拒绝预期当前版本不匹配和已有构建，避免用旧交接 ID 或并发发布覆盖现场。
