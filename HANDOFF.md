# 圆桌 · 阿瓦隆助手：换机与新会话交接

本文件用于没有聊天记录、无法打开聊天分享链接时继续开发。先读本文件和 `AGENTS.md`，再看 `README.md`、`CHANGELOG.md`；代码、配置和测试是实现依据。聊天链接仅提供背景，不能代替克隆仓库、安装依赖和登录部署账号。

## 当前状态

- 仓库：[cyk9163/Avalon-tool](https://github.com/cyk9163/Avalon-tool)，主分支 `main`。
- 正式地址：[圆桌 · 阿瓦隆助手](https://avalon-roundtable.yunkangchen2017.workers.dev)。个人 Cloudflare Workers + D1 + Durable Objects（SQLite 版），保持免费方案，不再部署到 GPT Sites。
- staging：[avalon-roundtable-staging](https://avalon-roundtable-staging.yunkangchen2017.workers.dev)，独立 Worker、独立 D1（`avalon-roundtable-staging-db`）和独立房主 Key 白名单；明文 Key 在原机器被 Git 忽略的 `work/staging-host-keys.txt`。
- 当前为 v1.2.0：v0.6 的自定义板子与扩展角色之上，v0.7 完成企业级基础治理（lint 清零、安全头、结构化日志、健康检查、Cron 清理、依赖漏洞清零、CI 扩充、部署后 smoke test），v0.8 加入换设备恢复（恢复码／房主批准）与带口令的邀请链接，v0.9 加入 Durable Object + WebSocket 实时同步与 staging 环境，v0.9.1 轮换房主 Key 并简化 Key 输入，v0.10 加入规则教学页与隐私说明页，v0.11 加入板子模板与复盘导出，v0.12 加入管理后台，v1.0 加入中英双语，v1.1 加入本机推理笔记，v1.2 把「坏人互相知道具体角色」「刺客随时出刀一次」定为所有房间的固定规则（与官方规则不同，规则页已注明）。
- 交接日期：2026-09-23。规则测试覆盖自定义阵容、扩展身份线索、强制任务牌、揭露者和湖中仙女隐私；每次发布的最终验证结果以 `CHANGELOG.md`、GitHub CI 与交付消息为准。
- 发布证据入口：[main 最新提交](https://github.com/cyk9163/Avalon-tool/commits/main)、[自动检查](https://github.com/cyk9163/Avalon-tool/actions)、上述正式站点。不能仅凭版本号认定上线；每次交付消息还应给出具体提交与线上验证结果。

现有功能：5–10 人建房、官方预设与自定义板子、扩展角色、湖中仙女、房间码和二维码入座、准备、私密身份及角色线索、选队表决、秘密任务牌、刺杀与结算、公开复盘、同房重开、房主移交、大厅移出玩家、中途作废、换设备恢复（恢复码或房主批准）、邀请口令、主屏幕安装和断网提示。

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
| `app/api/room/route.ts` | JSON API、Cookie、来源校验、频率限制、建房 Key 验证、request ID 与结构化日志 |
| `app/api/health/route.ts` | 健康检查（版本、数据库） |
| `worker/index.ts`、`lib/security-headers.ts`、`public/_headers` | Worker 入口：安全响应头与 Cron 定时任务 |
| `lib/maintenance.ts`、`lib/log.ts` | 过期数据分批清理、JSON 日志 |
| `components/device-recovery.tsx`、`components/takeover-requests.tsx` | 恢复码、换设备请求与房主批准界面 |
| `lib/host-key.ts`、`scripts/host-keys.mjs` | Key 格式／摘要验证、生成和发布允许列表 |
| `lib/game.ts` | 规则状态机、权限、幂等重试、面向当前玩家的响应投影 |
| `lib/room-store.ts` | D1 查询、房间持久化与并发条件更新；提交成功后调用 `signalRoom` |
| `lib/live.ts`、`lib/live-gateway.ts`、`lib/room-hub.ts`、`lib/room-signal.ts`、`lib/use-room-live.ts` | 实时信号：协议、握手校验、每房间 Durable Object、提交后通知、前端连接与退避 |
| `app/rules/page.tsx`、`app/privacy/page.tsx`、`components/doc-page.tsx`、`app/docs.css` | 规则教学与隐私说明（静态页，表格与角色取自 `lib/game.ts`）；修改数据保存方式时要同步更新隐私说明 |
| `lib/board-templates.ts` | 推荐板子模板与本机保存的模板（localStorage），可用性用服务端的 `validateCustomRoles` 判断 |
| `lib/replay.ts`、`components/replay-export.tsx` | 结局复盘文字导出：只用本人的 RoomView，不含任务牌归属、房间码或湖中仙女私密结果 |
| `app/admin/`、`app/api/admin/route.ts`、`lib/admin-key.ts`、`lib/admin-stats.ts`、`scripts/admin-keys.mjs` | 管理后台：管理员 Key（Secret `ADMIN_KEY_HASHES`，与房主 Key 分开）、只含汇总数字的统计查询。新增统计时只能返回计数，不能返回房间码、昵称、设备凭据、身份、投票或任务牌 |
| `lib/i18n/`、`components/lang-toggle.tsx`、`scripts/i18n-check.mjs` | 中英双语：以中文原文为键的英文词典（按页面分文件），界面用 `t()`，服务端文字用 `ts()`，服务端组件用 `serverT(await serverLang())`。新增文字必须通过 `npm run i18n:check` |
| `components/early-assassination.tsx`、`lib/game.ts` 的 `assassinate`、`identityFor` | 本站固定规则：选队／表决／任务／湖中仙女阶段刺客可按当前 `turnId` 出刀一次（结果带 `early: true`）；坏人线索的标签是同伴的角色名，奥伯伦除外；梅林只看到「已知邪恶」 |
| `lib/player-notes.ts`、`components/player-notes.tsx` | 推理笔记：只存 localStorage（按房间和局次，保留最近 5 局），绝不发送到服务器 |
| `lib/request-context.ts` | 接口与实时网关共用的设备身份、网络限流、房间码查找预算 |
| `scripts/environments.mjs`、`scripts/deploy.mjs`、`scripts/staging-check.mjs` | 正式／staging 部署（核对 Worker 名称）与 staging 端到端实时检查 |
| `db/schema.ts`、`drizzle/` | 数据库结构、迁移和迁移记录 |
| `components/install-app.tsx`、`public/sw.js`、`public/manifest.webmanifest` | 安装入口与公开断网提示 |
| `tests/` | 规则、权限、重放、并发、多玩家 API 与 PWA 验证 |
| `wrangler.jsonc`、`vite.config.ts`、`scripts/` | Workers／D1 绑定、Vinext 开发、构建及部署 |

前端是 React + TypeScript，通过 Vinext 运行于 Cloudflare Workers。Vinext 当前锁定 beta 版本；应用运行不调用 AI API，也不依赖 Codex 或 ChatGPT 登录。

每个房间以 JSON 状态存入 D1，并使用版本号条件更新与重试处理并发。v0.9 起，每次提交成功后通知该房间的 Durable Object（`RoomHub`），它通过 WebSocket（Hibernation API）向所有连接广播 `{"type":"changed","version":N}`；客户端收到后经 `GET /api/room` 读取自己的投影。实时连接打开时轮询降为 30 秒兜底（进度栏显示「实时」），连接不可用时回到每 3 秒轮询（显示「已同步」）；页面进入后台时断开，回到前台重连并补拉。D1 仍是唯一数据源，Durable Object 不存数据。

必须保持的权限边界：

- HttpOnly Cookie 绑定原设备／浏览器；数据库保存凭据的 SHA-256 摘要。昵称、座位号、公开玩家 ID 都不是登录凭据。
- `roomView`／身份投影只返回当前玩家应看到的内容。房主在结局前也不能读取全员身份；局外人得不到成员的对局详情。
- 组队票收齐后才逐人公开；任务牌只公开汇总结果，**结局后仍不能返回任务牌与玩家的关联**。服务端重试回执不可加入客户端响应。
- `turnId` 隔离提案／任务，`round` 隔离新局，`hostRevision` 隔离房主权限变更。不要为了兼容界面跳过这些服务端校验。
- Service Worker 只缓存公开断网提示页，不缓存房间页面、API、身份或投票，不自动补发离线操作。
- 实时信号只能包含版本号。不要把房间状态、昵称、身份、投票或任务牌放进 WebSocket 消息；需要新数据时让客户端走授权的 GET。握手必须校验同源 Origin，并与读取接口共用限流。
- 管理后台只返回汇总计数；管理员 Key 只通过自定义请求头发送，并按网络限流错误次数。正式和 staging 的管理员 Key 在原机器被 Git 忽略的 `work/admin-key.txt`、`work/admin-key-staging.txt`。
- 恢复码只投影给本人，换设备请求的设备凭据摘要不进入任何响应；房主座位不能经批准流程接管；批准前有 60 秒等待，原设备可拒绝；核对码用于当面配对；每次换设备写入公开记录。没有邀请口令的局外人看不到昵称，移出玩家会更换口令。本地（回环地址）不计网络限流，集成测试用 `CF-Connecting-IP` 模拟网络。

## 仓库包含什么

克隆会得到完整前后端源码、依赖锁文件、规则与接口测试、数据库结构和迁移、公开本地环境示例、部署配置及文档。执行 `npm ci` 后即可继续开发。

克隆**不会**得到线上 D1 数据、本地数据库、正式 Key、Cloudflare／GitHub 凭据或玩家 Cookie。`node_modules`、构建输出、`.wrangler/`、`.dev.vars`、`.env*`、`work/`、`backups/` 等均不应提交。线上 D1 仍保存在 Cloudflare，不因换机丢失。

2026-09-23（v0.9.1）起正式环境只有 1 个房主 Key，保存在原机器的 `work/avalon-host-key-v0.9.txt`，该路径被 Git 忽略；本文件不包含其内容。此前的 Key 全部失效，旧 Key 文件已删除。需要继续分发 Key 时，由持有人通过私密方式保管和交接。**仅部署已有站点不需要复制这些明文 Key。**

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

该脚本先构建，再部署 Worker，最后运行只读 smoke test。建议先 `npm run deploy:staging` 和 `npm run check:staging` 在 staging 验证，再部署正式环境。v0.9 的 Durable Object 迁移使 Cloudflare 可能拒绝回滚到 v0.9 之前的版本，出问题时优先修复后重新部署。线上已有 `HOST_KEY_HASHES` Cloudflare Secret，普通部署会保留它；不要用本地测试环境文件覆盖线上 Secret。没有数据库结构变化时不需要额外执行线上迁移。

若新增数据库迁移：修改 `db/schema.ts`，运行 `npm run db:generate`、`npm run db:migrate:local`，审查并验证新的迁移文件后，再执行 `npm run db:migrate:remote`。禁止改写已应用的旧迁移。

## 正式 Key 管理

Key 只授权创建新房间，可重复使用；加入、投票、移交和同房重开依靠当前房间权限，不要求重新输入 Key。Key 不写入房间记录或浏览器本地存储，成功创建后清除前端输入。服务端只保存允许的 SHA-256 摘要，未配置时拒绝建房。

只有确实要生成或轮换正式 Key 时才运行：

```sh
node scripts/host-keys.mjs generate work/my-host-keys.txt
node scripts/host-keys.mjs publish work/my-host-keys.txt
```

`generate` 使用 Node 密码学随机源生成 Key（`--count N`，默认 10，可取 1–50），只写入 `work/`，拒绝覆盖已有文件。输入时带或不带短横线、前缀 `AVL` 可有可无都能通过，服务端统一转成 `AVL-XXXX-XXXX-XXXX-XXXX` 再算摘要，所以摘要格式不变。`publish` 需要 Cloudflare 登录，并**替换整个** `HOST_KEY_HASHES` 允许列表，不是追加；不在新列表中的旧 Key 将无法再创建房间，已建立的房间仍可使用。不要把示例测试摘要发布到正式环境，不要在聊天输出、GitHub、截图或日志中公开真实 Key。

## 验证、发布与下一阶段

常规验证命令：

```sh
npm test
npm run typecheck
npm run build
```

本地开发服务器运行时，另开终端执行 `npm run test:integration`。测试只允许本地地址，会创建独立测试房间；默认 http://localhost:5173，可通过 `AVALON_TEST_URL` 覆盖。Key 默认使用上述公开本地测试值，也支持 `AVALON_TEST_HOST_KEY`。不要让集成测试写入正式站点。

GitHub Actions 分两个任务：lint（0 警告）、类型检查、单元测试、生产依赖审计（阻断）、全量审计（仅报告）、构建；以及在本地 D1 上运行全部集成测试。未配置自动上线。v0.7 起全仓 `npm run lint` 为 0 错误 0 警告，`npm audit` 为 0。

后续按 `AGENTS.md` 的既有授权推进，每个可用阶段都完成以下流程：

1. 查看工作区与远端状态，理解现有实现，确定本阶段范围。
2. 实现并验证规则、权限与界面；涉及界面时检查 360px 手机布局、实际点击和隐私遮罩。
3. 更新 `README.md`、`CHANGELOG.md` 和必要的交接信息。
4. 提交并推送 `main`，保留远端更改，禁止强制覆盖；检查该提交的 CI 结果。
5. 部署 Cloudflare，核对正式地址、版本与核心路径，再报告 Git 提交和上线结果。任何未完成部分单独说明。

普通阶段的推送和上线已获授权，不必重复询问；不要自动开通收费服务或升级套餐。

当前明确限制：房间自创建起 24 小时过期，重开／中止不延长；无永久战绩或导出。清除 Cookie 或改用另一个浏览器／主屏幕入口会失去原会话，需用本人恢复码或由房主批准回到座位；房主座位只接受恢复码。v0.8 之前建立的房间没有恢复码和邀请口令，按旧行为运行至过期。

运维：`/api/health` 为健康检查；错误编号＝request ID 前 8 位，可在 Workers Logs 检索或 `npm run cf:tail` 实时查看；回滚用 `npm run cf:deployments` 与 `npm run cf:rollback -- <version-id>`；每小时 Cron `17 * * * *` 清理过期数据。

下一项实际验收是 iPhone 与 Android 真机聚会测试：先安装再入房，完成身份、表决、任务、锁屏恢复、刷新和同房重开。现有自动化和手机尺寸浏览器检查不能代替这一步。不要把尚未做过的真机验证记为已完成。
