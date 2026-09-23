# 发布清单

自动检查通过之后，才把这个版本拿去聚会。

## 每次上正式环境之前

在 GitHub 的 Actions 里手动运行 Deploy，目标选 production，并勾上 device check。没勾会停住。

用一台 iPhone 和一台 Android，对着**即将发布的这个版本**做完：

- 先安装到主屏幕，再加入同一个房间
- 看身份、表决、出任务牌
- 锁屏再回来，座位还在
- 刷新之后座位还在
- 同房再开，大家回到未准备，并要重新看身份
- 断网时按一次投票：应看到「上一动作没送出」；恢复网络后再按一次

## 密钥

推到 `main` 会自动迁移并部署 staging。仓库 Secret `CLOUDFLARE_OAUTH_REFRESH_TOKEN` 已配置；若改用长期 API 令牌，放到 `CLOUDFLARE_API_TOKEN`。正式环境只走上面的手动步骤。

锁屏提醒还要在 staging 和正式环境分别设置 `VAPID_PRIVATE_KEY`，值在本机 `work/vapid-private.txt`，不要写进仓库或聊天。
