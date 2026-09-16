# 圆桌 · 阿瓦隆助手

第一阶段：5–10 人建房、房间码/二维码邀请、昵称入座、准备、服务端发身份、私密角色线索、全员确认、同浏览器刷新恢复。

当前不包含组队投票、任务票、刺杀与整局结算；这些属于第二阶段。

## 实现

- React + TypeScript 手机界面，运行在 Cloudflare Workers 兼容的 Vinext。
- 第一阶段使用个人 Cloudflare 账户中的 D1 持久化和每 3 秒同步，后台页面暂停同步。规划中的 Durable Objects/WebSocket 尚未接入。
- 一个房间保存为一条带版本号的记录，通过条件更新、重试防止并发抢座和重复发牌。
- HttpOnly / SameSite=Strict Cookie 保存设备凭据；数据库只保存其 SHA-256 摘要。生产 HTTPS Cookie 使用 Secure。
- 房间公开响应仅含座位和准备状态；私密身份按服务器认证的设备凭据投影。房主没有特殊身份读取权限。
- 房间创建 24 小时后过期；新建房间时分批清理过期数据。房间不用于长期战绩存储。
- 同设备同浏览器的多个标签页代表同一个玩家。清除 Cookie 后无法靠昵称恢复座位。
- 页面身份默认隐藏；切后台/失焦重新遮罩。二维码仅包含房间码，不包含玩家凭据。

## 本地开发

要求 Node 22.13+，推荐 Node 24。依次运行 `npm ci`、`npm run db:migrate:local`、`npm run dev`。本地开发不需要登录任何云服务。

本机 npm 的命令脚本有路径解析问题时，直接运行 `node scripts/run-framework.mjs dev` 或 `node scripts/run-framework.mjs build`。

数据库变更使用 `npm run db:generate`，然后 `npm run db:migrate:local`。线上迁移使用 `npm run db:migrate:remote`，部署使用 `npm run deploy`，两者需要 Cloudflare 登录。

## 验证

```sh
node --experimental-transform-types --test --test-isolation=none tests/game.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node tests/integration.mjs
```

集成测试默认使用 `http://localhost:5173`，创建会自动过期的测试房间，覆盖 5/7/10 人并发入座、准备、双发牌、确认、越权访问、CSRF 和会话恢复。只在专用测试环境运行。

## 后续阶段

1. 加入明确的游戏状态机：提议队伍、组队表决、匿名任务票、胜负和刺杀。
2. 公开表决与匿名任务牌分开建模，保留复盘记录。
3. 依据实际用量选择 D1 事件同步或迁移到 Durable Objects + WebSocket。当前使用个人 Cloudflare Workers + D1，免费计划内运行；超过免费限额需调整用量或另行决定升级。
