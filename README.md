# 麦力 Super Agent · 安装与更新

在 Ubuntu/Debian VPS 的完整 root 登录终端运行，无需 GitHub 登录：

```bash
(
  installer=$(mktemp "$HOME/openhands-install.XXXXXX.sh") || exit
  trap 'rm -f "$installer"' EXIT
  curl -fL --retry 2 https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/install.sh -o "$installer" && bash "$installer"
)
```

运行后选择角色：

1. **VPS 后端**：安装到 `/opt/agent-node`，运行 Agent Server。国内节点可选 Xray，明文输入本机 VLESS 链接；国外节点可跳过。可加入 Tailscale 并填写网关地址自动登记。安装后打印后端地址与 API Key，原生 Codex / Claude 订阅登录由用户手动执行。
2. **VPS 控制端＋统一网关**：安装到 `/opt/agent-node-gateway`，使用 littlemai Logo，产品名为“麦力 Super Agent”。电脑和手机连接 Tailscale 后通过同一个 HTTPS 地址操作各后端。网关不运行 Agent Server、Agent CLI 或 Xray。
3. **仅共享记忆的设备**：Linux 独立设备仅运行 Syncthing，向网关发送本机记忆与按需共享的 Skill。它不提供控制端网页。

自动化可使用 `--server`、`--gateway`、`--memory-device`。网关支持 `--config /private/config.json`、`--build /verified/build` 和 `--domain op.example.com`。后端在安装时与网关配对，控制端“后端管理”确认连接成功后启动共享策略。

## 更新

已有节点再次运行同一命令并选择相同角色。部署会备份旧程序，保留认证、密钥、会话和网络配置。后端完整更新会重启 Canvas；网关构建新静态版本并 reload Nginx，浏览器刷新后生效。

只更新脚本：后端运行 `openhands toolkit-update` 或选择菜单“获取脚本更新”。`--toolkit-only` 同样只替换已安装工具包，不安装组件、构建 UI 或重启服务。规则集自动更新与脚本更新相互独立；启用 Xray 后，每日北京时间 04:30 自动获取维护中的受限网站规则集。

## 控制端与附件

后端管理和统一机密使用弹窗页签，切换保留未保存表单，关闭后保留会话草稿和连接。统一机密加密保存，自动分发所有已连接后端，离线恢复后重试。

单张图片最多 10MiB，其他单个文件最多 20MiB，一次发送合计最多 20MiB。模型与推理力度分别选择，运行状态位于输入框底部。

默认入口只允许指定 Tailscale 账号。自有域名使用 Cloudflare DNS 验证与自动续期，仍限制为 Tailscale 私网。私有网关配置、DNS Token、后端 API Key 和 VLESS 节点均不包含在安装包中。

## 共享记忆与 Skill

网关保存所有来源的记忆，各 VPS 只接收其他来源副本。Syncthing 负责传输，无需 rsync 或同步用 SSH。外部记忆位于 `$CODEX_HOME/peer_memories`，Skill 位于 `~/.agents/peer_skills`；通过索引按需查阅，不会自动启用所有 Skill。部署器在 AGENTS.md 中写入读取机制并保留用户原有内容。

Linux 独立设备：

```bash
bash install.sh --memory-device --gateway-url https://你的网关 --id desktop \
  --codex-home /实际/Codex目录 --skills-root "$HOME/.agents/skills"
```

Windows 原生设备在 PowerShell 使用独立安装器，路径替换为实际 Codex 目录：

```powershell
$script = Join-Path $env:TEMP ([IO.Path]::GetRandomFileName() + '.ps1')
Invoke-WebRequest https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/install-memory-device.ps1 -OutFile $script
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -Gateway https://你的网关 -Id desktop -CodexHome 'D:\Users\yourname\.codex'
Remove-Item $script
```

设备接入后在网关“记忆与 Skill 共享设备”中启用。不同操作系统的 Skill 依赖仍需分别核实；文件同步不安装运行依赖。

## 安装包校验

安装包只含已提交源码与上游许可证，无需克隆仓库。源码版本：`a9bfcbdea04e2aaabba5eddf006304fe7fcc69a2`。

将 `install.sh` 与 `install.sh.sha256` 放在同一目录，运行 `sha256sum -c install.sh.sha256`。
