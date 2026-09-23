# 圆桌 · 阿瓦隆助手

面对面玩阿瓦隆的手机网页工具。当前为 v0.6：房主 Key 验证、5–10 人建房、官方预设与自定义板子、扩展角色、湖中仙女、扫码入座、私密身份、完整投票与任务、刺杀、复盘、同房再开、房主移交、移出玩家、中途作废，以及添加到手机主屏幕。

本项目包含完整前后端源码、数据库结构、迁移、测试和部署配置。独立部署到 Cloudflare Workers + D1，不依赖 ChatGPT、Codex 或 Sites 账号；使用时不调用 AI API。

线上地址：[圆桌 · 阿瓦隆助手](https://avalon-roundtable.yunkangchen2017.workers.dev)。

## 界面与操作

深墨绿、暖金与浅色建房卡片组成统一视觉。手机优先显示当前操作；房间进度、比分、选队与表决状态分层呈现，身份与房间管理按需展开。支持 360px 窄屏、长昵称、键盘焦点和减少动画设置；刷新恢复时显示连接状态，进入房间自动回到顶部。

项目背景、架构与交接步骤见 [HANDOFF.md](HANDOFF.md)。聊天链接用于补充背景，不能替代克隆源码或服务账号授权。

## 扩展角色与自定义板子

建房时可继续使用基础、经典、迷雾和全角色预设，也可选择「自定义板子」。自定义板子固定保留梅林与刺客，按人数自动补齐忠臣和爪牙；可加入派西维尔、莫甘娜、莫德雷德、奥伯伦，以及官方扩展中的正义／邪恶兰斯洛特、牧师、疯子、野蛮人和揭露者。服务端校验阵营人数、莫甘娜依赖派西维尔、兰斯洛特成对出现及特殊角色唯一性。

扩展角色限定 7 人及以上。兰斯洛特采用官方基础玩法：两人互相知道身份与阵营，本版不启用阵营转换变体。疯子必须出失败牌；野蛮人在第四、第五次任务只能出成功牌；揭露者在第二次任务失败后公开；牧师私密得知第一任队长的阵营。自定义板子还可启用湖中仙女，在第 2、3、4 次任务后由当前持有者私密查验一位玩家的阵营，再把令牌交给对方；查验结果只返回给查验者。

信使、游侠、术士与不可信任的仆人属于带专用任务牌或独立结算的高级模块，v0.6 尚未加入。界面不会把未实现的模块列为可用角色。

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
npm test
npm run typecheck
npm run build
```

启动本地开发服务器后，另一个终端执行 `npm run test:integration`，覆盖 5/7/10 人并发入房、身份权限、会话恢复、缺失与错误 Key 拦截、完整五人对局、刺杀命中/失手、连续五次否决、重复末票、任务票隐私、并发重开、同房第二局、房主移交、中途作废和移出／发牌冲突。单元测试另外覆盖自定义板子、扩展角色、任务牌限制、揭露者与湖中仙女的隐私边界。集成测试会创建房间，仅允许本地地址；可用环境变量 `AVALON_TEST_URL` 指定地址，默认 http://localhost:5173 。

`npm start` 在本地预览构建产物；它使用与开发服务器相同的本地数据库。

GitHub Actions 已包含单元测试、类型检查和构建，未配置自动上线。

## 房主 Key

仅创建新房间需要 Key。服务器检查 Key 摘要，未配置时拒绝建房；不能仅靠绕过前端获得建房权限。朋友扫码加入、查看自己的身份、投票、移交房主和同房重开仍依赖原房间权限，无需输入 Key。Key 可重复使用；不会写入房间状态、日志或浏览器本地存储。

为你自己的部署生成 10 个高强度随机 Key 并发布摘要：

```sh
node scripts/host-keys.mjs generate work/my-host-keys.txt
node scripts/host-keys.mjs publish work/my-host-keys.txt
```

第一条只写入本地忽略目录，已存在的文件不会覆盖；第二条需要 Cloudflare 登录，并替换 `HOST_KEY_HASHES` Secret 的允许列表。未包含在新列表中的旧 Key 无法再建新房，已建立的房间仍可正常使用。明文 Key 请私下保存和分享；不要上传 GitHub。换机部署不需要复制正式 Key，Cloudflare 会保留已有 Secret。新账号首次部署还需发布自己的 Key 摘要；不要将 `.dev.vars.example` 的测试摘要发布到正式环境。

## 同房再开与手机入口

结束后由房主点击「同房再来一局」。确认后保留房间码、玩家、座位和角色配置，清除上一局身份与记录，所有人重新准备后再发身份。请先完成复盘。重开不会延长房间的 24 小时有效期；旧局延迟请求不会修改新局。

房主展开「房间管理」后，可以选择玩家并移交房主，当前座位、身份和进度均保留，原房主随即失去管理权限。发身份前还可以移出其他玩家，空出座位；这不是封禁，对方可以再次加入。发身份后不能直接移出玩家。

有人离场、无法继续对局时，房主可以选择「中止本局」，确认后作废当前对局，不判胜负、不揭晓身份，清除本局身份和记录。所有人回到未准备的大厅，保留房间码、座位和配置，再移出离场玩家、邀请补位并重新准备。中止不延长房间有效期；旧投票、旧管理请求及重复中止不会影响新局。房主失去设备会话时，其他人不能擅自接管，需要另建房间。

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

`deploy` 会先构建再发布，终端会输出正式的 workers.dev 地址。克隆到新电脑后重新登录同一个 Cloudflare 账号即可继续部署，线上 D1 数据仍保存在 Cloudflare。

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

备份可能包含玩家昵称、身份等数据，`backups/` 已被 Git 忽略。不要上传到公开仓库。玩家身份由浏览器 HttpOnly Cookie 绑定；克隆代码不复制玩家会话，清除 Cookie 后不能仅凭昵称恢复原座位。

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
- `app/api/room/route.ts`：房间接口、Cookie 会话、输入校验及访问限制。
- `lib/host-key.ts`、`scripts/host-keys.mjs`：房主 Key 验证、生成与发布。
- `HANDOFF.md`：架构、部署凭据边界与新会话交接。
- `lib/game.ts`：角色配置、发牌、线索投影、游戏操作。
- `lib/room-store.ts`：D1 存储和并发更新。
- `db/`、`drizzle/`：数据库结构与迁移。
- `tests/`：游戏规则及多玩家接口测试。
- `wrangler.jsonc`、`vite.config.ts`、`scripts/`：独立开发、构建与部署。
- `AVALON.md`：产品范围、身份保护机制和后续阶段。

框架使用 React、TypeScript 和 Cloudflare Vinext（当前为 beta）。后续升级前请运行测试与构建；本仓库已锁定目前验证过的版本。
