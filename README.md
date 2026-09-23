# 圆桌 · 阿瓦隆助手

面对面玩阿瓦隆的手机网页工具。当前为 v1.0：房主 Key 验证、5–10 人建房、官方预设与自定义板子、扩展角色、湖中仙女、扫码入座、私密身份、完整投票与任务、刺杀、复盘、同房再开、房主移交、移出玩家、中途作废、换设备恢复（恢复码或房主批准）、带口令的邀请链接，以及添加到手机主屏幕。v0.7 起具备安全响应头、结构化日志、健康检查、定时清理和完整 CI；v0.9 起房间变化实时推送到每台手机，并有独立的 staging 环境；v0.10 起有规则教学页（`/rules`）和隐私说明页（`/privacy`）；v0.11 起自定义板子可以套用或保存模板，结局后可以导出复盘文字；v0.12 起运营者可以用单独的管理员 Key 在 `/admin` 查看汇总统计；v1.0 起全站支持中文和英文。

本项目包含完整前后端源码、数据库结构、迁移、测试和部署配置。独立部署到 Cloudflare Workers + D1，不依赖 ChatGPT、Codex 或 Sites 账号；使用时不调用 AI API。

线上地址：[圆桌 · 阿瓦隆助手](https://avalon-roundtable.yunkangchen2017.workers.dev)。预发布（staging）：[avalon-roundtable-staging](https://avalon-roundtable-staging.yunkangchen2017.workers.dev)，数据与正式环境完全分开。

## 界面与操作

深墨绿、暖金与浅色建房卡片组成统一视觉。手机优先显示当前操作；房间进度、比分、选队与表决状态分层呈现，身份与房间管理按需展开。支持 360px 窄屏、长昵称、键盘焦点和减少动画设置；刷新恢复时显示连接状态，进入房间自动回到顶部。

项目背景、架构与交接步骤见 [HANDOFF.md](HANDOFF.md)。聊天链接用于补充背景，不能替代克隆源码或服务账号授权。

## 扩展角色与自定义板子

建房时可继续使用基础、经典、迷雾和全角色预设，也可选择「自定义板子」。自定义板子固定保留梅林与刺客，按人数自动补齐忠臣和爪牙；可加入派西维尔、莫甘娜、莫德雷德、奥伯伦，以及官方扩展中的正义／邪恶兰斯洛特、牧师、疯子、野蛮人和揭露者。服务端校验阵营人数、莫甘娜依赖派西维尔、兰斯洛特成对出现及特殊角色唯一性。

扩展角色限定 7 人及以上。兰斯洛特采用官方基础玩法：两人互相知道身份与阵营，本版不启用阵营转换变体。疯子必须出失败牌；野蛮人在第四、第五次任务只能出成功牌；揭露者在第二次任务失败后公开；牧师私密得知第一任队长的阵营。自定义板子还可启用湖中仙女，在第 2、3、4 次任务后由当前持有者私密查验一位玩家的阵营，再把令牌交给对方；查验结果只返回给查验者。

信使、游侠、术士与不可信任的仆人属于带专用任务牌或独立结算的高级模块，v0.6 尚未加入。界面不会把未实现的模块列为可用角色。

## 换设备与邀请（v0.8）

- **恢复码**：入座后在「我的身份与圆桌座位」里有「换设备恢复码」，仅本人可见。换手机或浏览器时，在新设备打开房间，点「我本来就在这桌，换了设备」，选原座位并输入恢复码。原设备立即失效，恢复码自动更换。
- **房主批准**：没记下恢复码时，选择「请房主批准」，新设备会显示 4 位核对码。房主页面顶部出现「换设备请求」和同一核对码，当面核对后批准。为防冒用，原设备会收到提醒并可拒绝，请求发出 60 秒后才能批准。房主自己的座位只能用恢复码恢复。
- 每次换设备都会在全桌留下公开记录（座位与方式），被替换的设备会看到提示。
- **邀请口令**：房主分享的二维码／链接带有不可猜的口令，扫码进入可看到昵称；只输入六位房间码也能入座，但看不到昵称。房主移出玩家后口令自动更换。未知房间码的查找按网络限流防止枚举，已入座玩家不受影响。

## 中英双语（v1.0）

- 右上角「EN / 中文」按钮切换语言，选择保存在 Cookie `avalon_lang`；没有选择时按浏览器语言决定，中文浏览器或无偏好时为中文。
- 界面文字写成 `t("中文原文")`，英文放在 `lib/i18n/en/` 下按页面分开的词典里；服务端返回的中文（报错、身份线索）由客户端 `ts()` 翻译。新增或修改文字后运行 `npm run i18n:check`，它会列出未翻译的中文和缺少的英文，单元测试也会检查。
- 英文术语以 `lib/i18n/GLOSSARY.md` 为准。

## 实时同步（v0.9）

- 每个房间有一个 Durable Object，只负责推送“房间有变化（版本 N）”。手机收到后，照常通过带权限校验的 `/api/room` 读取自己能看到的内容，所以 WebSocket 不会多暴露任何信息。D1 仍是唯一的数据源。
- 连接地址是 `/api/room/live?code=房间码`，由 `worker/index.ts` 在 vinext 之前处理。握手要求同源 Origin 且房间存在，与读取接口共用限流；每个房间最多 48 个连接。
- 实时连接打开时，轮询放宽到每 30 秒一次；连接不上时自动回到 3 秒轮询。页面切到后台就断开，回到前台立即重连并补拉。房间进度栏显示「实时」或「已同步」。
- 使用 Hibernation API：没有消息时对象休眠、不计时长；心跳由运行时直接回复，不唤醒对象。免费方案额度足够日常聚会。

## 运维与安全基线（v0.7）

- 所有响应带 CSP、HSTS、Referrer-Policy、Permissions-Policy、X-Frame-Options 等安全头：Worker 响应见 `lib/security-headers.ts`，静态文件见 `public/_headers`（测试保证一致）。
- 接口响应带 `X-Request-Id`，服务端写 JSON 结构化日志（不含 Cookie、Key、恢复码、身份或原始房间码）。玩家报错时的「错误编号」是 request ID 的前 8 位，可在 Cloudflare Workers Logs 中搜索；实时查看用 `npm run cf:tail`。
- `GET /api/health` 返回版本与数据库状态，可接入免费的外部可用性监控。
- `wrangler.jsonc` 配置每小时一次的 Cron（`17 * * * *`），分批清理过期房间和限流记录；本地可访问 `http://localhost:5173/cdn-cgi/handler/scheduled` 触发。

## 换机继续开发

安装 Git 和 Node.js 24，然后：

```sh
git clone https://github.com/cyk9163/Avalon-tool.git
cd Avalon-tool
npm ci
node -e "require('fs').copyFileSync('.dev.vars.example','.dev.vars',require('fs').constants.COPYFILE_EXCL)"
npm run db:migrate:local
npm run dev
```

打开 http://localhost:5173 。本地数据库为空，使用页面创建测试房间即可。本地开发无需 Cloudflare 登录，也不会修改线上数据。本地建房使用公开测试 Key `AVL-TEST-KEYS-2345-6789`；这是本地测试值，不能在正式站点使用。Windows、macOS、Linux 使用相同命令。

`package-lock.json` 固定依赖版本，请提交到 GitHub。`node_modules`、构建产物、本地房间数据库和登录凭据不提交；安装依赖后会自动生成所需文件。Windows 本机若 npm 命令本身有路径问题，可直接运行 `node scripts/run-framework.mjs dev` 或 `node scripts/wrangler.mjs ...`。

## 验证

```sh
npm run lint        # 0 错误、0 警告
npm run typecheck
npm test
npm run audit:prod  # 生产依赖漏洞审计
npm run build
# 或一次执行：npm run verify
```

启动本地开发服务器后，另一个终端执行 `npm run test:integration`，覆盖 5/7/10 人并发入房、身份权限、会话恢复、缺失与错误 Key 拦截、完整五人对局、刺杀命中/失手、连续五次否决、重复末票、任务票隐私、并发重开、同房第二局、房主移交、中途作废和移出／发牌冲突。单元测试另外覆盖自定义板子、扩展角色、任务牌限制、揭露者与湖中仙女的隐私边界。集成测试会创建房间，仅允许本地地址；可用环境变量 `AVALON_TEST_URL` 指定地址，默认 http://localhost:5173 。

`npm start` 在本地预览构建产物；它使用与开发服务器相同的本地数据库。

GitHub Actions 包含两个任务：①lint、类型检查、单元测试、生产依赖审计（阻断）、全量依赖审计（仅报告）、构建；②在本地 D1 上启动开发服务器并运行全部集成测试。未配置自动上线。集成测试还覆盖安全响应头、健康检查、request ID、邀请口令、恢复码和房主批准换设备。

## 管理后台

`/admin` 只给站点运营者用，显示汇总统计（房间数、阶段、人数、板子、胜负、限流、服务状态），不显示房间码、昵称或身份。需要单独的管理员 Key，它和房主 Key 互不通用：

```sh
node scripts/admin-keys.mjs generate work/admin-key.txt
node scripts/admin-keys.mjs publish work/admin-key.txt            # 正式环境
node scripts/admin-keys.mjs publish work/admin-key-staging.txt --env staging
```

`publish` 会替换整个 `ADMIN_KEY_HASHES` 允许列表。本地开发使用 `.dev.vars.example` 里的公开测试 Key `ADM-TEST-ADMN-KEYS-2345-6789`。

## 房主 Key

仅创建新房间需要 Key。服务器检查 Key 摘要，未配置时拒绝建房；不能仅靠绕过前端获得建房权限。朋友扫码加入、查看自己的身份、投票、移交房主和同房重开仍依赖原房间权限，无需输入 Key。Key 可重复使用；不会写入房间状态、日志或浏览器本地存储。

建房时只需在 Key 输入框里填 16 位字母和数字：会自动转大写，自动忽略短横线、空格和 0/1/I/O，并按 4 位一组显示；粘贴含 `AVL-` 的完整 Key 也可以。服务端同样接受带或不带短横线的写法。

为你自己的部署生成高强度随机 Key 并发布摘要（`--count` 默认 10，可取 1–50）：

```sh
node scripts/host-keys.mjs generate work/my-host-keys.txt --count 1
node scripts/host-keys.mjs publish work/my-host-keys.txt
```

第一条只写入本地忽略目录，已存在的文件不会覆盖；第二条需要 Cloudflare 登录，并替换 `HOST_KEY_HASHES` Secret 的允许列表。未包含在新列表中的旧 Key 无法再建新房，已建立的房间仍可正常使用。明文 Key 请私下保存和分享；不要上传 GitHub。换机部署不需要复制正式 Key，Cloudflare 会保留已有 Secret。新账号首次部署还需发布自己的 Key 摘要；不要将 `.dev.vars.example` 的测试摘要发布到正式环境。

## 同房再开与手机入口

结束后由房主点击「同房再来一局」。确认后保留房间码、玩家、座位和角色配置，清除上一局身份与记录，所有人重新准备后再发身份。请先完成复盘。重开不会延长房间的 24 小时有效期；旧局延迟请求不会修改新局。

房主展开「房间管理」后，可以选择玩家并移交房主，当前座位、身份和进度均保留，原房主随即失去管理权限。发身份前还可以移出其他玩家，空出座位；这不是封禁，对方可以再次加入。发身份后不能直接移出玩家。

有人离场、无法继续对局时，房主可以选择「中止本局」，确认后作废当前对局，不判胜负、不揭晓身份，清除本局身份和记录。所有人回到未准备的大厅，保留房间码、座位和配置，再移出离场玩家、邀请补位并重新准备。中止不延长房间有效期；旧投票、旧管理请求及重复中止不会影响新局。房主换设备时使用自己的恢复码回到座位；其他玩家换设备可用恢复码，或由房主当面核实后批准。

点击页面右上角「添加到主屏幕」查看安装步骤。Android 支持的浏览器会提供安装入口，iPhone 可在 Safari 的分享菜单中添加。建议入房前安装；主屏幕应用与浏览器可能不共享玩家会话，已经入房时请继续使用原入口。

对局需要联网；断网后不会自动补发投票。恢复网络、返回前台时立即同步，同一浏览器刷新会恢复原座位。生产版 Service Worker 只缓存不含游戏数据的断网提示页；身份、API 响应、任务牌和房间页面不进入离线缓存。开发模式不注册 Service Worker，可用 `npm run build`、`npm start` 验证生产行为。

自动化测试和手机尺寸浏览器检查不能代替真机验收。聚会前建议各用一台 iPhone 和 Android：先安装再加入同一房间，完成看身份、表决和任务票；锁屏返回、刷新后检查座位不变；结束后同房再开，确认大家回到未准备状态且需重新看身份。

## 部署到现有 Cloudflare 账号

```sh
npm run cf:login
npm run cf:whoami
npm run db:migrate:remote
npm run deploy
```

`deploy` 会先构建再发布，然后自动对正式地址运行只读 smoke test（等待 `/api/health` 报告新版本，检查安全头和实时网关）。也可以单独运行 `npm run smoke`。

建议先发布到 staging 验证，再上线正式环境：

```sh
npm run db:migrate:staging   # 有新迁移时
npm run deploy:staging       # 构建、部署到 staging、只读 smoke test
npm run check:staging        # 在 staging 建临时房间，端到端验证实时信号
```

staging 使用独立 Worker、独立 D1 和独立的房主 Key 白名单（明文 Key 在被 Git 忽略的 `work/staging-host-keys.txt`，用 `node scripts/host-keys.mjs publish work/staging-host-keys.txt --env staging` 发布）。部署脚本会核对构建出的 Worker 名称，staging 构建无法覆盖正式环境。

出问题时回滚：`npm run cf:deployments` 查看历史版本，`npm run cf:rollback -- <version-id>` 回到指定版本（仅回滚代码，不回滚 D1 数据）。v0.9 加入了 Durable Object 迁移，Cloudflare 可能拒绝回滚到 v0.9 之前的版本，此时应修复后重新部署。v0.7 起部署会同时注册每小时 Cron 清理任务，免费方案可用。克隆到新电脑后重新登录同一个 Cloudflare 账号即可继续部署，线上 D1 数据仍保存在 Cloudflare。

根目录 `wrangler.jsonc` 保存 Worker 名、账户 ID 和 D1 数据库 ID。这些是资源标识，不是密码，可随源码提交；具有对应账户权限的登录凭据才允许部署或读写线上数据库。

换到另一个 Cloudflare 账号时，运行 `node scripts/wrangler.mjs d1 create avalon-roundtable-db`，将返回的数据库 ID 和新账户 ID 写入 `wrangler.jsonc`，再执行线上迁移和部署。首次使用 Workers 的账户可能需要在 Cloudflare 控制台选择 workers.dev 子域名。

项目使用免费 Workers、D1 和 workers.dev 域名，不要求购买域名或开通付费订阅；免费额度有限。详见 [Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/) 与 [D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)。不要为了部署本项目自动升级套餐。

## 数据库变更与备份

修改 `db/schema.ts` 后：

```sh
npm run db:generate
npm run db:migrate:local
```

将 `drizzle/` 中的新迁移一并提交，验证通过后再执行 `npm run db:migrate:remote`。不要修改已经应用到线上的旧迁移。

GitHub 保存代码和数据库结构，不保存线上房间记录。房间 24 小时后过期，不作为长期战绩保存。需要备份时先创建本地 `backups` 文件夹，再运行：

```sh
node scripts/wrangler.mjs d1 export DB --remote --config wrangler.jsonc --output backups/avalon.sql
```

备份可能包含玩家昵称、身份和恢复码等数据，`backups/` 已被 Git 忽略。不要上传到公开仓库。玩家身份由浏览器 HttpOnly Cookie 绑定；克隆代码不复制玩家会话。清除 Cookie 后不能仅凭昵称恢复座位，需要恢复码或房主批准。

## 放到 GitHub

现有 GitHub 仓库为 `https://github.com/cyk9163/Avalon-tool.git`。通过上述 `git clone` 命令取得的副本已配置 `origin`；完成更改并检查后推送：

```sh
git add <本次修改的文件>
git commit -m "Describe the change"
git push origin main
```

推送前先读取远端最新状态并保留他人的修改；不要强制推送。GitHub 登录通过 Git Credential Manager、GitHub CLI 或 SSH 完成；不要把令牌放进远程地址或源文件。

`.gitignore` 已排除 `.env*`、`.dev.vars*`、`.wrangler/`、依赖、备份和构建输出。房主 Key 使用 Cloudflare Secret `HOST_KEY_HASHES`，现有站点的 Secret 会在换机部署时保留。正式 Key 明文需要另外私密保管；不能从摘要还原。

## 源码导航

- `app/page.tsx`、`app/globals.css`：手机界面与样式。
- `components/game-panel.tsx`、`app/game.css`：选队、表决、私密任务牌、结局与对局记录。
- `components/room-management.tsx`、`app/management.css`：房主移交、移出玩家及中途作废。
- `components/install-app.tsx`、`app/pwa.css`、`public/manifest.webmanifest`、`public/sw.js`：主屏幕安装与断网提示。
- `app/api/room/route.ts`：房间接口、Cookie 会话、输入校验、访问限制、request ID 与结构化日志。
- `app/api/health/route.ts`：健康检查。
- `worker/index.ts`：Worker 入口，添加安全头并运行定时清理；`lib/security-headers.ts`、`public/_headers`、`lib/maintenance.ts`、`lib/log.ts`。
- `components/device-recovery.tsx`、`components/takeover-requests.tsx`、`app/recovery.css`：恢复码、换设备与房主批准界面。
- `lib/live.ts`、`lib/live-gateway.ts`、`lib/room-hub.ts`、`lib/room-signal.ts`、`lib/use-room-live.ts`：实时信号（协议、握手校验、Durable Object、提交后通知、前端连接）。
- `app/rules/page.tsx`、`app/privacy/page.tsx`、`components/doc-page.tsx`、`app/docs.css`：规则教学与隐私说明页（规则表格取自 `lib/game.ts`）。
- `lib/board-templates.ts`：推荐板子与本机保存的板子模板；`lib/replay.ts`、`components/replay-export.tsx`：结局复盘文字导出。
- `app/admin/`、`app/api/admin/route.ts`、`lib/admin-key.ts`、`lib/admin-stats.ts`、`scripts/admin-keys.mjs`：管理后台（管理员 Key 与汇总统计）。
- `lib/i18n/`（`core.ts`、`react.tsx`、`server.ts`、`dictionary.ts`、`en/*.ts`、`GLOSSARY.md`）、`components/lang-toggle.tsx`、`scripts/i18n-check.mjs`：中英双语。
- `lib/request-context.ts`：接口与实时网关共用的设备身份和网络限流。
- `scripts/smoke.mjs`：部署后只读检查；`scripts/environments.mjs`：正式与 staging 地址；`scripts/staging-check.mjs`：staging 端到端实时检查。
- `lib/host-key.ts`、`scripts/host-keys.mjs`：房主 Key 验证、生成与发布。
- `HANDOFF.md`：架构、部署凭据边界与新会话交接。
- `lib/game.ts`：角色配置、发牌、线索投影、游戏操作。
- `lib/room-store.ts`：D1 存储和并发更新。
- `db/`、`drizzle/`：数据库结构与迁移。
- `tests/`：游戏规则及多玩家接口测试。
- `wrangler.jsonc`、`vite.config.ts`、`scripts/`：独立开发、构建与部署。
- `AVALON.md`：产品范围、身份保护机制和后续阶段。

框架使用 React、TypeScript 和 Cloudflare Vinext（当前为 beta）。后续升级前请运行测试与构建；本仓库已锁定目前验证过的版本。
