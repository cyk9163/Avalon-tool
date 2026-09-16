# 圆桌 · 阿瓦隆助手：换机与新会话交接

本文件用于没有聊天记录、无法打开聊天分享链接时继续开发。先读本文件和 `AGENTS.md`，再看 `README.md`、`CHANGELOG.md`；代码、配置和测试是实现依据。聊天链接仅提供背景，不能代替克隆仓库、安装依赖和登录部署账号。

## 当前状态

- 仓库：[cyk9163/Avalon-tool](https://github.com/cyk9163/Avalon-tool)，主分支 `main`。
- 正式地址：[圆桌 · 阿瓦隆助手](https://avalon-roundtable.yunkangchen2017.workers.dev)。个人 Cloudflare Workers + D1，保持免费方案，不再部署到 GPT Sites。
- 本次工作从 v0.4 提交 `dda5679` 开始。当前工作区为 v0.5.0：界面重设计与房主 Key 验证，保留完整对局和房间管理功能。
- 交接日期：2026-09-16。50 项单元测试、完整本地集成、类型检查和构建通过；浏览器已检查 360px／390px 手机布局及桌面布局，实际操作覆盖建房 Key、入座、身份、表决、私密任务与管理弹窗。
- 发布证据入口：[main 最新提交](https://github.com/cyk9163/Avalon-tool/commits/main)、[自动检查](https://github.com/cyk9163/Avalon-tool/actions)、上述正式站点。不能仅凭版本号认定上线；每次交付消息还应给出具体提交与线上验证结果。

现有功能：5–10 人建房、房间码和二维码入座、准备、私密身份及角色线索、选队表决、秘密任务牌、刺杀与结算、公开复盘、同房重开、房主移交、大厅移出玩家、中途作废、主屏幕安装和断网提示。v0.5 新增统一手机界面、四阶段进度、连接状态、房主 Key 建房权限。

## 换机启动

安装 Git 和 Node.js 24。用以下真实仓库地址，不需要找到原聊天：

```sh
git clone https://github.com/cyk9163/Avalon-tool.git
cd Avalon-tool
npm ci
node -e "require('fs').copyFileSync('.dev.vars.example','.dev.vars',require('fs').constants.COPYFILE_EXCL)"
npm run db:migrate:local
npm run dev
```

打开 http://localhost:5173 。新克隆的本地数据库为空，创建测试房间即可；本地开发不需要 Cloudflare 登录，也不会访问线上房间数据。已有 `.dev.vars` 时示例复制命令会拒绝覆盖；请保留自己的配置，按示例检查所需变量。

本项目实际使用的是 **`.dev.vars.example`**，不是 `.env.example`。其中仅有公开测试配置，本地建房 Key 为：

```text
AVL-TEST-KEYS-2345-6789
```

这不是正式 Key，禁止把该测试值的摘要发布到线上。无有效 Key 或服务端未配置摘要时，创建房间会失败；朋友加入房间无需 Key。

已有克隆先运行 `git status`，保留未提交更改，再 `git fetch origin`、检查远端差异。不要直接覆盖本地目录或强制推送。

Windows 上若系统的 npm 启动脚本解析出错，可用 `node scripts/run-framework.mjs dev` 启动开发服务；部署命令由 `scripts/wrangler.mjs` 包装。依赖版本由 `package-lock.json` 固定，不要为排查环境问题先升级整套框架。

## 架构与修改入口

| 文件或目录 | 职责 |
| --- | --- |
| `app/page.tsx`、`app/globals.css` | 建房、入房、座位、身份与页面状态 |
| `components/room-progress.tsx`、`app/progress.css` | 公开阶段轨道与同步状态 |
| `components/game-panel.tsx`、`app/game.css` | 选队、表决、私密任务牌、刺杀、结果与复盘 |
| `components/room-management.tsx`、`app/management.css` | 移交、移出和中止确认流程 |
| `app/api/room/route.ts` | JSON API、Cookie、来源校验、频率限制和建房 Key 验证 |
| `lib/host-key.ts`、`scripts/host-keys.mjs` | Key 格式／摘要验证、生成和发布允许列表 |
| `lib/game.ts` | 规则状态机、权限、幂等重试、面向当前玩家的响应投影 |
| `lib/room-store.ts` | D1 查询、房间持久化与并发条件更新 |
| `db/schema.ts`、`drizzle/` | 数据库结构、迁移和迁移记录 |
| `components/install-app.tsx`、`public/sw.js`、`public/manifest.webmanifest` | 安装入口与公开断网提示 |
| `tests/` | 规则、权限、重放、并发、多玩家 API 与 PWA 验证 |
| `wrangler.jsonc`、`vite.config.ts`、`scripts/` | Workers／D1 绑定、Vinext 开发、构建及部署 |

前端是 React + TypeScript，通过 Vinext 运行于 Cloudflare Workers。Vinext 当前锁定 beta 版本；应用运行不调用 AI API，也不依赖 Codex 或 ChatGPT 登录。

每个房间以 JSON 状态存入 D1，并使用版本号条件更新与重试处理并发。客户端约每 3 秒轮询，后台暂停，恢复前台时重新同步；尚未接入 WebSocket 或 Durable Objects。不要将“已同步”解释为实时长连接。

必须保持的权限边界：

- HttpOnly Cookie 绑定原设备／浏览器；数据库保存凭据的 SHA-256 摘要。昵称、座位号、公开玩家 ID 都不是登录凭据。
- `roomView`／身份投影只返回当前玩家应看到的内容。房主在结局前也不能读取全员身份；局外人得不到成员的对局详情。
- 组队票收齐后才逐人公开；任务牌只公开汇总结果，**结局后仍不能返回任务牌与玩家的关联**。服务端重试回执不可加入客户端响应。
- `turnId` 隔离提案／任务，`round` 隔离新局，`hostRevision` 隔离房主权限变更。不要为了兼容界面跳过这些服务端校验。
- Service Worker 只缓存公开断网提示页，不缓存房间页面、API、身份或投票，不自动补发离线操作。

## 仓库包含什么

克隆会得到完整前后端源码、依赖锁文件、规则与接口测试、数据库结构和迁移、公开本地环境示例、部署配置及文档。执行 `npm ci` 后即可继续开发。

克隆**不会**得到线上 D1 数据、本地数据库、正式 Key、Cloudflare／GitHub 凭据或玩家 Cookie。`node_modules`、构建输出、`.wrangler/`、`.dev.vars`、`.env*`、`work/`、`backups/` 等均不应提交。线上 D1 仍保存在 Cloudflare，不因换机丢失。

本次生成的 10 个正式 Key 保存在原机器的 `work/avalon-host-keys-v0.5.txt`，该路径被 Git 忽略；本文件不包含其内容。需要继续分发原 Key 时，由持有人通过私密方式保管和交接。**仅部署已有站点不需要复制这些明文 Key。**

## 登录与部署到现有站点

GitHub 推送使用自己的 Git Credential Manager、SSH 或 GitHub 登录凭据；Cloudflare 登录不能代替 GitHub 登录。不要把 Token 写入源码、文档或远程仓库 URL。

```sh
npm run cf:login
npm run cf:whoami
```

应登录拥有现有 Worker 与 D1 的同一 Cloudflare 账号。`wrangler.jsonc` 已记录 Worker `avalon-roundtable`、D1 `avalon-roundtable-db`、账户 ID 和数据库 ID；这些资源标识可以提交，登录凭据不能。换机沿用现有资源，不要重复创建数据库。换账号部署属于另一套环境，需重新配置资源，见 `README.md`。

完成验证后运行：

```sh
npm run deploy
```

该脚本先构建，再部署 Worker。线上已有 `HOST_KEY_HASHES` Cloudflare Secret，普通部署会保留它；不要用本地测试环境文件覆盖线上 Secret。没有数据库结构变化时不需要额外执行线上迁移。

若新增数据库迁移：修改 `db/schema.ts`，运行 `npm run db:generate`、`npm run db:migrate:local`，审查并验证新的迁移文件后，再执行 `npm run db:migrate:remote`。禁止改写已应用的旧迁移。

## 正式 Key 管理

Key 只授权创建新房间，可重复使用；加入、投票、移交和同房重开依靠当前房间权限，不要求重新输入 Key。Key 不写入房间记录或浏览器本地存储，成功创建后清除前端输入。服务端只保存允许的 SHA-256 摘要，未配置时拒绝建房。

只有确实要生成或轮换正式 Key 时才运行：

```sh
node scripts/host-keys.mjs generate work/my-host-keys.txt
node scripts/host-keys.mjs publish work/my-host-keys.txt
```

`generate` 使用 Node 密码学随机源生成 10 个 Key，只写入 `work/`，拒绝覆盖已有文件。`publish` 需要 Cloudflare 登录，并**替换整个** `HOST_KEY_HASHES` 允许列表，不是追加；不在新列表中的旧 Key 将无法再创建房间，已建立的房间仍可使用。不要把示例测试摘要发布到正式环境，不要在聊天输出、GitHub、截图或日志中公开真实 Key。

## 验证、发布与下一阶段

常规验证命令：

```sh
npm test
npm run typecheck
npm run build
```

本地开发服务器运行时，另开终端执行 `npm run test:integration`。测试只允许本地地址，会创建独立测试房间；默认 http://localhost:5173，可通过 `AVALON_TEST_URL` 覆盖。Key 默认使用上述公开本地测试值，也支持 `AVALON_TEST_HOST_KEY`。不要让集成测试写入正式站点。

GitHub Actions 当前配置单元测试、类型检查和构建，未配置自动上线。此前定向 ESLint 检查记录有 **7 个 error、2 个 warning**，属于原有问题，本次未新增；不要把其他检查通过表述为全仓 lint 已通过。

后续按 `AGENTS.md` 的既有授权推进，每个可用阶段都完成以下流程：

1. 查看工作区与远端状态，理解现有实现，确定本阶段范围。
2. 实现并验证规则、权限与界面；涉及界面时检查 360px 手机布局、实际点击和隐私遮罩。
3. 更新 `README.md`、`CHANGELOG.md` 和必要的交接信息。
4. 提交并推送 `main`，保留远端更改，禁止强制覆盖；检查该提交的 CI 结果。
5. 部署 Cloudflare，核对正式地址、版本与核心路径，再报告 Git 提交和上线结果。任何未完成部分单独说明。

普通阶段的推送和上线已获授权，不必重复询问；不要自动开通收费服务或升级套餐。

当前明确限制：房间自创建起 24 小时过期，重开／中止不延长；无永久战绩、导出或换设备恢复。清除 Cookie 或改用另一个浏览器／主屏幕入口可能失去原玩家会话，房主 Key 也不能恢复座位；房主失去会话时需另建房间。

下一项实际验收是 iPhone 与 Android 真机聚会测试：先安装再入房，完成身份、表决、任务、锁屏恢复、刷新和同房重开。现有自动化和手机尺寸浏览器检查不能代替这一步。不要把尚未做过的真机验证记为已完成。
