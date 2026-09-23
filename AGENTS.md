# 项目协作约定

用户要求按可用阶段继续开发。每完成一个阶段，验证、更新文档与 CHANGELOG、提交并推送 GitHub，再部署 Cloudflare 并验证线上版本。已有授权，不需要重复询问是否上线或推送；收费升级、破坏性操作及超出项目范围的行为另行处理。

- GitHub：`https://github.com/cyk9163/Avalon-tool.git`，当前主分支 `main`。推送前读取远端最新状态并保留用户更改，禁止强制覆盖。
- 正式地址：`https://avalon-roundtable.yunkangchen2017.workers.dev`。
- 使用个人 Cloudflare Workers + D1，保持免费方案，不重新部署到 GPT Sites。
- 使用 Node 24；`npm ci`、`npm run db:migrate:local`、`npm run dev`。
- 阶段检查：`npm run lint`（0 警告）、`npm run typecheck`、`npm test`、`npm run audit:prod`、本地 `npm run test:integration`、`npm run build`。部署后 `npm run deploy` 会自动运行 smoke test。涉及界面时检查手机排版与实际操作。
- `npm run deploy` 构建并部署。数据库结构变化时，先审查迁移，再应用线上迁移；不要更改已应用的迁移文件。
- 不提交 `.env*`、`.dev.vars*`、Cookie、令牌、数据库文件、备份、`work/` 或构建产物。
- 角色、未揭晓组队票及任务牌均在服务端授权；任务牌与玩家的关联在对局中不得向客户端公开，结局后只向本局成员公开（v1.5 起按用户要求调整）。
- 阶段交付报告包含功能、验证结果、线上地址和 GitHub 提交。若部署或推送受阻，明确区分已完成与未完成部分。
