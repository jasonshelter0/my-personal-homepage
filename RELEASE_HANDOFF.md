# Folio Studio 生产发布交接

## Git 手机目标窗口修复（2026-10-25，当前部署）

已于 `2026-10-25T12:40:09.235Z` 完成真实 HTTPS 私有预览、发布及匿名公网验收。
修复上游桌面样式的 400px 最小宽度覆盖手机样式的问题；目标图按实际容器重绘，
横竖屏切换及隐藏后重开仍受当前宽度约束，长目标说明可换行。
以下为本次当前状态；下方此前发布章节保留历史，不代表此刻的镜像/内容。

- 入口：<https://www.jasonshelter.com/learn/git-branching/>（中文、英文、法文）。
- 运行源码 `34cf36e02d6e75117d0b74350aeb3671841c3e48`；只从隔离 worktree 构建，未纳入同期未发布的翻译/图标功能。
- 镜像 `sha256:96395dee4359fa6a1c119f953b65d3cf9202c6492fe5c10c36ceed31b5dbf255`。
- runtime `/www/dk_project/folio-studio/releases/git-width-20261025-34cf36e`；`current` 指向此目录。
- 冻结内容 `mvntcxim-e5d321e2`；基于部署时现场已发布版本 `mvnrtyk6-9f73620e` 重建，保留用户后续内容更新与 Mamba 三语课程。
- 持久数据仍为 `/www/dk_project/folio-studio/shared/data`，草稿 revision 14 和 SHA-256 发布前后完全一致，无数据库迁移。
- 旧镜像 `sha256:ba0946ac153a012703a077e6ebaddd96b3669892e3e80a1249e364528f6ac728`、旧 runtime `releases/learn-20261025-8ff2c4d` 均保留。
- 一致性备份 `/www/backup/site/folio-studio/20261025T123743Z-learning/data.tar.gz`，应用短暂停止时归档，排除可再生 build-cache，权限0600/目录0700；SHA-256 `4afbcbb4845bbdce81a9a925df6ec8a103aff12f617613b64118e76a92e8ac35`。已检查归档可完整列出，未做恢复演练。
- 运行包 SHA-256 `f9722ec618a8ba774e1fa6a2a9350fc7630183057d5d41f4d1203bf60baead77`，上传后校验一致。
- 模拟器 SHA-256 `8f7226b2da11ec8e5e75192e8a14aa78531dc166ff99dd50be2cc9c4ce753815`，预览和公网与本地逐字节一致。

验证：npm ci/typecheck/build、27 项网站测试、原有13项浏览器测试、新增3项中英法目标窗口回归、415项上游测试通过；全部36个英文关卡的目标图和目标说明在320px检查通过。
真实 HTTPS 中英法各检查320px、844px横屏、隐藏后在320px重开、关闭按钮、目标说明和搜索；预览通过才发布，随后匿名重复检查，脚本/资源错误0。
首页、Mamba课程、后台和health200；匿名草稿/私有预览401，数据库/快照404。未更改Nginx、DNS、证书、端口或其他服务。

本次回滚分为内容和应用两步（执行前协调唯一写入者并持有 `config/deployment.lock`）：

```bash
ssh aliyun-web 'docker exec -i folio-studio-studio-1 node --import tsx --input-type=module -' <<'JS'
import { rollbackRelease } from './server/publisher.ts';
console.log((await rollbackRelease('mvnrtyk6-9f73620e')).id);
JS
ssh aliyun-web 'bash /www/backup/site/folio-studio/20261025T123743Z-learning/rollback-application.sh'
ssh aliyun-web 'curl --fail --silent http://127.0.0.1:18080/healthz'
```

回滚脚本恢复旧 image.env、runtime 链接并重建固定 Compose 服务；不覆盖数据或草稿。
源码与可重建补丁见 `docs/GIT_BRANCHING.md`。部署锁在记录更新与验收完成后释放。

## 最新学习课程发布（2026-10-25）

**已发布并通过真实 HTTPS 验收，完成时间 `2026-10-25T07:49:11.541Z`。** 本节为当前状态；下方首次建站记录保留作历史，旧镜像和初始内容 ID 不代表当前版本。两个开发会话协调后，由 Mamba 会话持有服务器 `flock` 独占完成统一部署。

| 项目 | 当前记录 |
| --- | --- |
| 主课程 | <https://www.jasonshelter.com/learn/mamba-tta-irstd/>；11 章 × 中英法，33 个正文页面 |
| 同批课程 | <https://www.jasonshelter.com/learn/git-branching/>；由 Git 会话提供完整三语模拟器 |
| 运行源码 | `8ff2c4dd16f66c2b5a9b0318222eee3ad13d2dc3`（包含 Git 提交 `defca9fb526a42fdaec37817fed6ca024be7eb1b`），已推送 `main` |
| 当前镜像 | `sha256:ba0946ac153a012703a077e6ebaddd96b3669892e3e80a1249e364528f6ac728` |
| 当前内容版本 | `mvnivkmk-648c10e2` |
| runtime | `/www/dk_project/folio-studio/current` → `/www/dk_project/folio-studio/releases/learn-20261025-8ff2c4d` |
| 持久数据 | `/www/dk_project/folio-studio/shared/data`；10001:10001 / 0700，沿用原目录 |
| 更新前内容版本 | `mvngl5bl-5e2da295`（现场读取，区别于首次部署 ID） |
| 更新前应用 | `sha256:bc865fa97e06200d0bd71377acf17e21c4f240724045041348d99f3ec25e1e93`；runtime `releases/1.1.0-8c4a227` |
| 一致性备份 | `/www/backup/site/folio-studio/20261025T074428Z-learning`；目录 0700、`data.tar.gz` 0600，仅存服务器 |
| 备份 SHA-256 | `ca486b48716f4a47c4c4d9627acb3251b0537508646202ba413227d5eb631596` |
| 运行包 | `.folio/deployments/learn-20261025-8ff2c4d/runtime.tar.gz`，119679474 字节 |
| 运行包 SHA-256 | `462391e7ff035f8cff1acc354ec73d6067ca19adce6879c41574ecd4e0d9c247`，上传后复核一致 |

### 内容保留与验收

更新前短暂停止应用，对完整持久数据（排除可再生 build-cache）做文件系统备份，归档可完整列出；保留 SQLite/WAL/媒体/冻结版本。此次未做备份恢复演练，不将归档校验解释为完整灾备验证。新应用继续使用原数据库，未运行演示数据初始化或 schema 迁移。

新内容由 `scripts/rebuild-published.ts --expected-current mvngl5bl-5e2da295` 从现场已发布快照生成。先在真实 HTTPS 私有预览检查三语言 36 个页面、360px 布局、Mamba 演示/测验、Git 命令、语言切换、搜索、base 路径、canonical、光晕与备案；通过后才调用正常发布 API。随后匿名重复公开页面和交互检查，浏览器脚本与资源错误均为 0。后台草稿 revision 8 和原始内容 SHA-256 发布前后均相同。

本地 typecheck、正式 build、27 项单元/集成测试及 13 组 Chromium e2e 通过。集成测试串行运行，避免独立测试发布器争用 Astro prerender 目录。Pagefind 构建索引 75 页、3 语言。

公网首页、后台和 `/healthz` 返回 200；真实 HTTPS 登录、Secure/HttpOnly/SameSite=Strict Cookie、会话和登出通过。匿名草稿和私有预览返回 401；数据库/快照文件返回 404。所有课程进入 sitemap，canonical 不含 preview 前缀。仅精确 Git 模拟器资源使用 `X-Frame-Options: SAMEORIGIN`，后台和其他页面仍为 DENY。

Git 开发会话使用独立匿名浏览器再次验收三语言 Git 页面、命令、搜索和模拟器文件 SHA-256，全部通过。原 IP 页面返回 200，裸域 HTTPS 保留课程路径并 308 到 www。

应用容器健康、只读根目录、用户 10001:10001；固定镜像运行。Nginx、DNS、证书、WordPress、RDS、本机 MySQL/PHP 和其他服务均未调整。

### 此批次的精确回滚

仅回退公开内容，可在受控运维会话执行现有发布器回滚；这不改变后台草稿：

```bash
ssh aliyun-web 'docker exec -i folio-studio-studio-1 node --import tsx --input-type=module -' <<'JS'
import { rollbackRelease } from './server/publisher.ts';
console.log((await rollbackRelease('mvngl5bl-5e2da295')).id);
JS
```

回退应用使用已保存脚本，恢复精确旧镜像、runtime 链接并重新创建 Compose 容器：

```bash
ssh aliyun-web 'bash /www/backup/site/folio-studio/20261025T074428Z-learning/rollback-application.sh'
ssh aliyun-web 'curl --fail --silent http://127.0.0.1:18080/healthz'
```

完整撤回本次页面时先回退内容，再回退应用，并复核真实 HTTPS。应用回滚脚本不会覆盖 `/data`；数据库恢复是另一个受控操作，不得在线解压覆盖当前数据。保留新旧镜像和冻结内容，不做 prune、down -v 或 WordPress/Nginx 入口恢复。回滚前仍须协调唯一生产写入者并持有部署锁。

更新时间：2026-10-25（Asia/Shanghai）。此文档仅记录非敏感信息，不含密码、令牌、私钥或环境变量秘密值。

**首次建站历史状态：已上线并完成公网验收，2026-10-25 14:08:31（Asia/Shanghai）切换成功。** 用户已明确授权本会话接管上线，将 `www.jasonshelter.com` 的 WordPress 入口切到新站，保留旧站文件和原数据库供回滚。部署约束来源：`/home/jasonshelter/Projects/connect/DEPLOYMENT_HANDOFF.md` 与该目录的 `AGENTS.md`。

## 项目标识与版本

| 项目                                 | 记录                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 项目名称 / site-id / Compose project | Folio Studio / `folio-studio` / `folio-studio`                                                 |
| 项目绝对路径                         | `/home/jasonshelter/Projects/personal-website`                                                 |
| Git 仓库                             | `https://github.com/jasonshelter0/my-personal-homepage`                                        |
| 分支                                 | `main`                                                                                         |
| 应用版本                             | `1.1.0`                                                                                        |
| 打包运行时代码提交                   | `8c4a227cd21892bd33b9ccea31fb725d7487df4d`                                                     |
| 文档提交说明                         | 本文件为上述运行时提交之后生成的交接记录；若后续只有文档更新，运行时代码仍以该提交为准         |
| 本地产物批次                         | `1.1.0-8c4a227`                                                                                |
| 初始内容发布 ID                      | `mvneuk4i-caeca440`                                                                            |
| 本地内容状态                         | 已打开并检查私有预览，已发布；由本地产物 `manifest.json` 记录                                  |
| 公网切换完成时间                     | `2026-10-25 14:08:31 Asia/Shanghai`（`06:08:31 UTC`）                                          |
| 生产当前内容发布 ID                  | `mvneuk4i-caeca440`                                                                            |
| 生产应用镜像 ID                      | `sha256:bc865fa97e06200d0bd71377acf17e21c4f240724045041348d99f3ec25e1e93`                      |
| 生产 runtime 目录 / current 链接目标 | `/www/dk_project/folio-studio/current` → `/www/dk_project/folio-studio/releases/1.1.0-8c4a227` |
| 切换前配置备份与回滚文件             | `/www/backup/site/folio-studio/20261025T061000Z`；原配置 `root:root / 0600`，详见下文校验      |

这次是新站接管域名入口，不是将 WordPress 帖子导入新 CMS 的数据迁移。既有 WordPress 文件、上传资源、PHP 服务及其外部 RDS 数据库需保留；新站内容来自本次审核过的 Folio 快照。本批初始内容仍是原本地已发布的演示资料，仅切换为正式域名；用户尚未提供真实履历。站主应通过后台替换演示资料，不得当作真实履历。

## 技术栈、运行方式与数据库选择

| 组件         | 锁定依赖版本 / 用途                                         |
| ------------ | ----------------------------------------------------------- |
| Node.js      | `24.21.0`，项目最低 Node 24；生产固定 Linux/amd64 镜像      |
| Astro        | `7.4.2`，生成正式站和私有预览的静态 HTML                    |
| React / Vite | `19.3.1` / `8.3.5`，单人编辑后台                            |
| Express      | `5.3.0`，登录、内容 API、上传、发布、健康检查与同源路由     |
| TypeScript   | `7.0.2`                                                     |
| Pagefind     | `1.5.2`，三语言静态搜索                                     |
| sharp / Zod  | `0.35.5` / `4.6.7`，图片处理与内容校验                      |
| SQLite       | Node 内置 `node:sqlite`，WAL 模式，持久化草稿快照与登录会话 |

**部署类型：需要服务端运行时。** 公开页面虽是静态产物，网页端编辑、数据库、登录、上传、自动翻译、预览和发布均依赖常驻 Node 服务；不能只上传 `dist/` 后宣称整个系统已部署。

服务器已有本机 MySQL 5.7，旧 WordPress 依赖外部阿里云 RDS。新站是单人编辑，选择既有代码已支持的 SQLite，避免新增数据库进程、账号、端口与额外常驻内存。帖子、信息页、经历、三语言正文和站点配置保存在草稿 JSON 快照中；写入带 revision 冲突校验，并非仅保存在浏览器。发布后的不可变版本及媒体文件保存在同一持久数据目录。

实际运行方式为现有宝塔 Nginx → `127.0.0.1:18080` → Compose 服务 `studio`。不安装竞争 80/443 的入口、不依赖宿主机未安装的 Node、不修改 MySQL 或 RDS 权限。

## 构建、验证与本地产物

在 Linux x86_64、Node `24.21.0` 的构建机执行：

```bash
cd /home/jasonshelter/Projects/personal-website
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

已验证：类型检查通过，24 项单元与集成测试通过，8 组 Chromium 端到端流程通过，正式构建通过。验证包含数据库持久化、三语言、搜索、媒体、光晕、稿件隔离、私有预览、发布、回滚、同源路由及生产配置拒绝不安全默认值。

`npm run build` 生成后台 `apps/admin/dist/` 和默认正式站 `apps/site/dist/`，并生成 Pagefind 索引。生产交付应使用下面冻结版本的产物，不应将随后开发生成的默认 `dist/` 混入当前版本。最终运行时与包校验清单位于 `1.1.0-8c4a227`；初始冻结内容未改变，其展开目录保留在 `1.1.0-3ac5106`。

| 产物                   | 绝对路径                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 后台构建               | `/home/jasonshelter/Projects/personal-website/apps/admin/dist`                                                               |
| 默认静态构建           | `/home/jasonshelter/Projects/personal-website/apps/site/dist`                                                                |
| 本批交付根目录         | `/home/jasonshelter/Projects/personal-website/.folio/deployments/1.1.0-8c4a227`                                              |
| 批次清单               | `/home/jasonshelter/Projects/personal-website/.folio/deployments/1.1.0-8c4a227/deployment-manifest.json`                     |
| 包校验清单             | `/home/jasonshelter/Projects/personal-website/.folio/deployments/1.1.0-8c4a227/artifact-sha256.json`                         |
| 公开冻结站点           | `/home/jasonshelter/Projects/personal-website/.folio/deployments/1.1.0-3ac5106/data/releases/mvneuk4i-caeca440/dist`         |
| 私有冻结预览           | `/home/jasonshelter/Projects/personal-website/.folio/deployments/1.1.0-3ac5106/data/releases/mvneuk4i-caeca440/preview-dist` |
| 初始化数据             | `/home/jasonshelter/Projects/personal-website/.folio/deployments/1.1.0-3ac5106/data`                                         |
| 应用镜像构建上下文归档 | `/home/jasonshelter/Projects/personal-website/.folio/deployments/1.1.0-8c4a227/runtime.tar.gz`                               |
| 初始化数据归档         | `/home/jasonshelter/Projects/personal-website/.folio/deployments/1.1.0-8c4a227/data.tar.gz`                                  |

本次实际交付包校验（服务器上传后再次验证）：

| 文件             |    字节数 | SHA-256                                                            |
| ---------------- | --------: | ------------------------------------------------------------------ |
| `runtime.tar.gz` | 118302315 | `46f54d4c17c2dbdf5e62f170a2eee452b941af4446cd6061e69341859a597b1c` |
| `data.tar.gz`    |    849633 | `6a7b2f5cf9978dea048c8a05f94f5745bf669a02279cd0e9af3a48c92bf0bb00` |

`data.tar.gz` 包含 SQLite 和非公开内容快照，不能作为公开下载或放在 Nginx 静态根目录；正式 `dist/` 才是允许公开托管的范围。两份归档都不应包含 `.env` 或生产密码。本次初始化数据与开发会话数据库分离，避免复制开发登录会话。

后续生成新批次使用：

```bash
npm run release:prepare -- \
  --output .folio/deployments/NEW_RELEASE_ID \
  --site-url https://www.jasonshelter.com
```

`NEW_RELEASE_ID` 必须替换为不存在的新目录。需要承接既有内容时，增加 `--snapshot` 和 `--media-dir` 指向已审核快照及其媒体；不传快照会使用演示 seed，不能用于覆盖已有生产内容。命令只准备待审核版本；必须打开私有预览、检查并发布，清除临时审核会话后再封装初始化数据。**后续更新应用不应再次覆盖生产 `/data`。**

## 容器与资源

部署定义：项目根 `Dockerfile`、`deploy/container-entrypoint.sh`、`deploy/compose.production.yml`；入口候选：`deploy/nginx-site.candidate.conf`。详细打包要求见 `deploy/README.md`。

- 基础镜像：官方 `node:24.21.0-bookworm-slim`，Linux/amd64 manifest digest 为 `sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd`。
- 离线载入的已验证基础镜像 ID：`sha256:470015c1ab1577c19efce2e80cdad4afd9c682cf8f4dcf3dccae5abfd9113397`。基础镜像归档校验：服务器 `/www/dk_project/folio-studio/cache/node24.21.0-bookworm-slim.docker.tar.gz`，88,583,979 字节，SHA-256 `126cd20a182022ee91ce7b55e332afd92890caeb1cdf00396d355d51bc1ab308`。
- 应用镜像内包含锁定依赖和后台构建，因为后台发布操作仍需运行 Astro/Pagefind 构建。首次 ECS 镜像打包不执行 npm 联网安装。
- 以 UID/GID `10001:10001` 运行，只读根文件系统、全部 capabilities 移除、`no-new-privileges`。持久写入限于 `/data`，临时写入在 `/tmp`。
- `/tmp` 为 256 MiB tmpfs，`/app/apps/site/.astro` 类型目录和 Vite 配置缓存通过镜像内符号链接指向该目录。`/app/.astro` 预渲染目录指向 `/data/build-cache/astro-prerender`，必须与发布输出处在同一文件系统，避免 Astro 移动产物时出现 `EXDEV`；不要把这个目录改回 tmpfs。`/data/build-cache/node_modules` 指向镜像 `/app/node_modules`，保证预渲染模块按真实路径解析依赖；启动脚本负责建立这个链接。
- 单实例内存上限 768 MiB、CPU 上限 1.5 核、进程上限 192；各 Node 进程 JS heap 上限 384 MiB。它们是初始资源预算，不是已测最低需求；实机完整发布峰值 321,060,864 字节（约 306.2 MiB），cgroup memory failcnt 为 0，无 OOM；验收时宿主机 MemAvailable 为 970,900 KiB，磁盘可用 23,639,732,224 字节。这是当前演示内容的单次实测，大量内容和图片需重新评估。
- host networking 下仅监听 `127.0.0.1:18080`，不创建 Docker 端口发布规则；不得改成 `0.0.0.0`。此模式能访问宿主机网络，需保留严格绑定和来源校验。
- 日志使用 Docker json-file，单文件 10 MiB、最多 3 文件；容器重启策略 `unless-stopped`。

在已审核、解包的构建上下文中构建镜像；Docker Hub 不可达时使用上述已核验本地基础镜像 ID：

```bash
DOCKER_BUILDKIT=0 docker build --pull=false --platform linux/amd64 \
  --build-arg BASE_IMAGE=sha256:470015c1ab1577c19efce2e80cdad4afd9c682cf8f4dcf3dccae5abfd9113397 \
  -t folio-studio:1.1.0-8c4a227 .
docker image inspect --format '{{.Id}}' folio-studio:1.1.0-8c4a227
```

上述 `DOCKER_BUILDKIT=0` 是本次离线构建的回退方式：BuildKit 不能将裸镜像 ID 直接解析为 `FROM`，会尝试访问 `library/sha256`。后续采用 BuildKit 时，可为已核验的本地基础镜像设置专用 tag，再次校验 tag 对应的镜像 ID，并使用可读取该本地镜像的 builder；不能仅假定 `--pull=false` 能防止所有解析联网。

将应用镜像不可变 ID 写入受控的 `image.env`；Compose 不使用浮动 tag。生产启动命令：

```bash
docker compose --env-file /www/dk_project/folio-studio/config/image.env \
  -p folio-studio \
  -f /www/dk_project/folio-studio/current/deploy/compose.production.yml \
  up -d --no-build --pull never
```

容器内部入口为 `node --import tsx server/index.ts`。本地调试可用 `npm start`；生产禁止使用默认演示密码，必须按运行配置校验通过后启动。

## 环境变量（只列名称与用途）

| 名称                                             | 阶段 / 用途                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `NODE_ENV`                                       | 运行期；启用生产配置校验                                              |
| `NODE_OPTIONS`                                   | 运行期；Node 内存预算，子构建进程继承                                 |
| `HOST`、`PORT`                                   | 运行期；应用监听地址和端口，生产使用明确的 loopback 入口              |
| `SERVE_PUBLIC`                                   | 运行期；启用同源网关，将后台/API/私有预览/公开站点合并到一个端口      |
| `PUBLIC_ORIGIN`                                  | 运行期；公开 HTTPS origin，用于 Host、来源校验及预览 URL              |
| `PRODUCTION_URL`                                 | 运行期；后台“访问正式站”的目标                                        |
| `COOKIE_SECURE`                                  | 运行期；生产登录 Cookie 仅通过 HTTPS 传输                             |
| `ADMIN_PASSWORD`                                 | 运行期秘密；站主登录密码，生产必须为 20–1024 字符且不能使用演示默认值 |
| `PREVIEW_BASE_PATH`                              | 运行期/构建编排；私有预览的固定路径命名空间                           |
| `FOLIO_DATA_DIR`                                 | 运行期；SQLite、媒体、发布版本、当前版本指针的持久根目录              |
| `FOLIO_CACHE_DIR`                                | 构建期/运行期；Astro/Vite 的可写缓存目录                              |
| `FOLIO_SNAPSHOT`                                 | 发布子进程构建期；本次冻结快照文件，由发布器设置                      |
| `FOLIO_OUTPUT`                                   | 发布子进程构建期；当前版本的公开或预览输出目录，由发布器设置          |
| `FOLIO_BASE`                                     | 发布子进程构建期；公开站点根路径或私有预览前缀，由发布器设置          |
| `ASTRO_TELEMETRY_DISABLED`                       | 构建期/运行期；禁用 Astro 遥测                                        |
| `TRANSLATION_BASE_URL`                           | 可选运行期；OpenAI 兼容翻译服务 origin/API 前缀                       |
| `TRANSLATION_API_KEY`                            | 可选运行期秘密；翻译服务认证密钥                                      |
| `TRANSLATION_MODEL`                              | 可选运行期；翻译服务模型名                                            |
| `FOLIO_IMAGE`                                    | Compose 解析期；已验证的应用镜像不可变 ID                             |
| `BASE_IMAGE`                                     | Docker 构建参数；已核验的基础镜像 digest 或本地 ID                    |
| `HOME`、`TMPDIR`                                 | 镜像运行配置；将必要临时文件写入可写 tmpfs                            |
| `PUBLIC_HOST`、`PREVIEW_PORT`、`PRODUCTION_PORT` | 兼容本地三端口演示；生产单端口模式不以这些端口对外提供服务            |

生产秘密仅放在服务器 `/www/dk_project/folio-studio/config/studio.env`，权限 0600；不提交、不打印、不在命令行参数内传入密码。不要通过未过滤的 `docker inspect`、`docker compose config` 或环境变量导出来交接秘密。未配置翻译供应商时，自动翻译明确不可用；手工编辑和发布仍可使用。

## 数据、权限、迁移与备份

固定宿主机持久目录：`/www/dk_project/folio-studio/shared/data`，挂载容器 `/data`，所有者 `10001:10001`。Compose 禁止自动创建不存在的 host bind 目录，避免拼错路径后启动空站。

```text
shared/data/
  studio.sqlite              草稿 JSON、revision、登录会话哈希
  studio.sqlite-wal/-shm     SQLite 运行时辅助文件（如存在）
  media/                     上传并处理后的私有媒体
  releases/<release-id>/
    snapshot.json            私有冻结快照
    assets/                  冻结媒体副本
    release.json             私有构建/发布状态
    build.log                构建日志，不公开
    dist/                    允许公开的静态网页与搜索索引
    preview-dist/            私有预览构建，必须认证
  current.json               当前正式内容版本指针
  exports/                   可选公开静态导出
  build-cache/astro-prerender/ 构建缓存，与发布输出同文件系统
```

此次不执行 MySQL/RDS 迁移，也不更改 WordPress 数据库。SQLite 表为草稿快照与 sessions，已存在数据的默认字段通过解析层兼容；应用升级与内容发布不是同一个操作。后续若改变数据结构，应先评估旧版读取兼容性再迁移。

备份必须协调 SQLite、上传媒体、冻结版本与当前指针。简单一致性方案为停止本服务后备份整个持久目录；不停机方案需要 SQLite 在线备份并协调媒体与发布目录。不能只复制正在写入的 `studio.sqlite` 主文件。恢复数据库可能覆盖备份之后的编辑，需明确停写时间与恢复点；不能将内容版本回滚描述为数据库恢复。

切换前备份位于 `/www/backup/site/folio-studio/20261025T061000Z`，包含原 Nginx 配置、候选配置、完整 WordPress 文件归档和校验清单；初始化 Folio 数据归档保留在服务器 `releases/1.1.0-3ac5106/data.tar.gz`，SHA-256 同上。本次未新增定时或异地备份，站主负责后续备份安排；保留策略为不自动删除任何现有恢复点。 本轮不自动删除旧版本、镜像或备份。不能承诺零停机；应用容器更新可能短暂停止编辑和动态入口，需要在更新前检查该站状态并记录实际中断。

## 域名与入口

| URL / 路径                          | 目标行为                                                   |
| ----------------------------------- | ---------------------------------------------------------- |
| `https://www.jasonshelter.com/`     | 新站主页入口，进入配置的默认语言                           |
| `http://www.jasonshelter.com/*`     | HTTPS 规范化跳转，保留 ACME 验证例外                       |
| `http(s)://jasonshelter.com/*`      | 规范化到 HTTPS 的 www 域名，保留路径及必要 ACME 例外       |
| `/admin/`                           | 编辑后台；静态应用可访问，内容操作需要登录                 |
| `/api/`                             | 同源后台 API；除 session/login/health 等明确端点外要求认证 |
| `/admin/media/`                     | 后台媒体，要求认证；不得与公开 `/media/` 混用              |
| `/preview/<release-id>/`            | 私有预览；需要登录，`no-store`、`noindex`                  |
| `/zh-cn/`、`/en/`、`/fr/`           | 三语言已发布站点                                           |
| `/learn/`                           | 稳定学习入口，进入默认语言学习页                           |
| `/<locale>/learn/`                  | 风格一致的三语言学习主页                                   |
| `/_astro/`、`/media/`、`/pagefind/` | 已发布版本的公开资源                                       |
| `/healthz`                          | 无副作用 readiness 检查                                    |

全站页底中央显示 `京ICP备2024092234号-1`，链接到 `https://beian.miit.gov.cn/`。这仅实现提供的备案号展示，不替代备案主体、域名和接入信息的核验，也未新增或伪造公安备案信息。

现有 Nginx 为宝塔管理，候选配置必须与实际站点配置合并后做完整语法检查。复用原证书路径和 ACME 验证目录，保留 IP 页面、PHP/MySQL、VS Code Server。公开路由不是全站 SPA：不存在的内容应返回 404，后台的 SPA 回退仅限 `/admin/`。当前没有 WebSocket 入口需求。

既有证书记录到期时间为 2026-11-11 23:59:59 UTC，覆盖 www 与裸域。切换后从外部对 www 与裸域验证 TLS 信任链、域名和有效期，通过 TLS 1.3；未使用忽略证书验证的选项。续期仍由站主/服务器管理流程负责，现有续期任务是否覆盖该 RapidSSL 证书尚未证明。 本次发布不能被当作已完成证书续期，原有其他服务器风险也不因新站上线自动消失。

学习页面后续开发说明见 [`docs/LEARN_CODEX_HANDOFF.md`](docs/LEARN_CODEX_HANDOFF.md)。当前学习页是完整三语言入口与待更新状态，没有虚构课程或学习进度；具体学习详情页在后续任务中实现。

## 健康检查与上线验收

```bash
curl --fail --silent http://127.0.0.1:18080/healthz
curl --fail --silent https://www.jasonshelter.com/healthz
```

正常返回 HTTP 200，JSON 为 `status: "ok"`，`checks.database`、`checks.editor`、`checks.website` 全部为 true。检查读取数据库草稿 revision、后台入口文件和已发布三语言主页是否存在，无写入副作用；任一项失败返回 503。它不是全面内容正确性、备份或外部翻译服务检测，不能单独作为切流量验收。

上线前后应核验：

1. TLS 信任链、域名和有效期；HTTP/裸域规范化不形成循环，ACME 入口保留。
2. 三语言首页、`/learn/`、学习语言切换、ICP 链接、JS/CSS/媒体、搜索与手机布局。
3. `/admin/` 登录正常，未登录的草稿 API、后台媒体和私有预览返回 401；不暴露 SQLite、快照、`.env` 或部署目录。
4. 在实际只读容器内新建并打开私有预览，确认构建、图片、搜索和预览内链接；仅在 owner 检查后发布。
5. 公开页面只显示发布版本，保存草稿不改变公开内容；旧内容版本可回滚。
6. IP 页面仍保持原有行为，WordPress 文件和 RDS 没有迁移或删除。
7. 确认监听仅为 loopback，容器 healthy，检查实际构建内存峰值和磁盘余量。

实际验收（2026-10-25 14:08–14:11，Asia/Shanghai）：

- 真实只读容器生成三语言公开站与私有预览，预览版本 `mvnfd0p6-bf59c581`，构建、预览、发布、恢复初始版本流程用时 12.1 秒。当前版本恢复为 `mvneuk4i-caeca440`。
- SQLite `PRAGMA integrity_check` 为 `ok`；临时测试会话清零。实际 HTTPS 登录/退出、Secure + HttpOnly Cookie、已认证草稿读取、私有预览 200 与 `no-store/noindex` 均通过。
- 公网 Chromium：根页与 `/learn` 跳转通过；三语言首页与学习页共 6 页正常，6 个备案链接正确；Pagefind 搜索返回 4 个结果；手机 7 页无横向溢出。
- 正式站和后台登录页鼠标光晕真实绘制像素差分别为 53 / 54，减少动态效果模式同样可见；JS 错误 0、资源失败 0。
- `/healthz` 200；未认证 `/api/snapshot`、`/preview/`、具体预览路径均 401；不存在页面 404。HTTP www/裸域与 HTTPS 裸域均 308 到 HTTPS www，并保留路径。
- 原 IP 页面仍 200；WordPress 文件保留，Nginx/MySQL/PHP 服务 active；无数据库迁移、无 RDS 写入。
- Docker running/healthy，重启次数 0，监听仅 `127.0.0.1:18080`。公网浏览器截图位于本批交付目录 `production-*.png`。

首次入口切换遇到 Nginx reload 后旧 worker 短暂返回 404，脚本已自动恢复旧配置，确认旧站静态资源 200。修正健康探测的有限重试后，第二次切换在第 2 次探测通过。旧失败尝试的恢复归档 `/www/backup/site/folio-studio/20261025T060654Z` 继续保留。这也实际验证了入口自动回滚路径。

## 发布、回滚与后续维护

本次上线顺序：复核当前配置与容量 → 记录并备份受影响入口配置 → 校验归档并解包到独立版本目录 → 初始化专用持久数据（仅首发） → 构建并记录不可变镜像 → 启动 loopback 服务 → 在容器中验证健康及实际预览 → 备份并合并宝塔站点配置 → 完整 Nginx 检查 → reload → 外部浏览器与 HTTP/TLS 验收 → 完成本交接记录并同步服务器登记。

WordPress 入口回滚：恢复本次记录的旧站配置及权限，执行现有完整 Nginx 配置检查，检查通过后 reload，再验证旧站静态资源及 IP 页面。需要停止新应用时只操作固定项目 `folio-studio` 的 `studio` 服务。实际回滚命令见下方；执行前确认站主希望恢复 WordPress 入口。

后续应用代码回滚：恢复前一不可变 `FOLIO_IMAGE` 和对应部署定义，再运行同一 Compose `up -d --no-build --pull never`。仅切换 runtime `current` 链接不会改变运行容器。内容回滚使用后台已有版本恢复；数据库恢复另行协调，不应覆盖正在编辑的草稿。

禁止使用 `docker compose down -v`、全局 prune、删除 WordPress、清空数据库或删除备份来“重置”发布。生产秘密继续留在服务器受限配置中，自动翻译供应商需要单独配置并进行真实连通性验证；此前的 mock 测试不代表任何付费供应商已接通。

已同步 `/home/jasonshelter/Projects/connect/` 内的服务登记、架构及发布记录；学习开发会话不应同时修改生产入口。

## 实际切换工具、恢复点与操作命令

运行时镜像源代码为 `8c4a227cd21892bd33b9ccea31fb725d7487df4d`；入口切换脚本额外修复提交为 `0dd00b87a530bf88a752f01848a8cd875cf28f1c`。实际执行脚本位于 `/www/dk_project/folio-studio/config/switch-nginx.py`（root:root，0600），SHA-256 `dceb572b4b474182e68c02c6a0934409e0b988415fb2c653d756397e2dd2fdfd`。运行时归档内的早期切换脚本没有 reload 重试修复，后续操作须使用此 config 路径或仓库修正版。

实际入口配置 `/www/server/panel/vhost/nginx/www.jasonshelter.com.conf`，root:root，0600。恢复点清单位于 `/www/backup/site/folio-studio/20261025T061000Z/manifest.json`（目录名是批次标识，准确创建/启用时间见清单）。

| 对象                                        | SHA-256                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ |
| 原入口配置 `nginx.before.conf`              | `24a8601f403916183cb84be9d518b0a05faf1050d1e8e854bf9eccb4a3bc8061` |
| 新入口配置 `nginx.after.conf`               | `d5dff915ae1af2e300a862bde0dd3167e3e09d5db4dbc9a21a04bab89adb6f63` |
| WordPress 文件归档 `wordpress-files.tar.gz` | `58a76867fb63cbbbfd0bf13c1e9d9cf527b2812ee2f647f894b2db9893b3b665` |

入口回滚命令（在已授权的服务器会话执行）：

```bash
python3 /www/dk_project/folio-studio/config/switch-nginx.py \
  --backup-dir /www/backup/site/folio-studio/20261025T061000Z --rollback
curl --fail --silent --output /dev/null \
  https://www.jasonshelter.com/wp-includes/css/dashicons.min.css
curl --fail --silent --head --output /dev/null http://47.120.33.219/
```

脚本校验旧配置哈希、恢复权限、检查完整 Nginx 配置并 reload。原 WordPress 数据库未改变，恢复入口无需导入 RDS；文件归档用于额外灾难恢复，不应在日常入口回滚时覆盖原文件。

站主日常内容更新：访问 `https://www.jasonshelter.com/admin/` → 登录 → 编辑并保存中英法内容 → 检查发布清单 → 创建预览 → 打开预览审阅 → 发布。正式站立即切换到该冻结版本；不需要每次重新部署容器。历史版本恢复只切换已发布内容，保留当前草稿。

本次为后台生成了独立随机密码，仅存服务器 `/www/dk_project/folio-studio/config/studio.env` 的 `ADMIN_PASSWORD`。站主通过自己的可信 SSH 终端访问该受限配置并保存到密码管理器；不要把其值贴到聊天、Git、截图或命令历史。需要更换时在服务器受控编辑该文件，然后运行上述 Compose `up -d --no-build --pull never --force-recreate studio` 命令以重新载入环境。

当前没有配置翻译供应商，因此自动翻译暂不可用；zh-CN/en/fr 手工编辑、预览与发布完整可用。学习入口已部署，具体学习课程/详情页留给下一项开发任务，扩展契约见 `docs/LEARN_CODEX_HANDOFF.md`。
