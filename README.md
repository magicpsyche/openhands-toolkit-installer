# OpenHands Toolkit 安装 / 更新

Ubuntu/Debian（含 systemd WSL）使用同一个下载入口，无需 GitHub 登录：

```bash
(
  installer=$(mktemp "$HOME/openhands-install.XXXXXX.sh") || exit
  trap 'rm -f "$installer"' EXIT
  curl -fL --retry 2 https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/install.sh -o "$installer" && bash "$installer"
)
```

运行后选择角色：

1. **后端**：VPS 完整 root 登录终端，安装到 `/opt/agent-node`。可选 Xray 分流及 Tailscale。VLESS 由用户隐藏输入，原生订阅登录由用户手动执行。安装后显示后端地址和 API Key。
2. **本地控制端**：Linux / WSL 普通用户，安装到 `~/.local/share/agent-node/toolkit`，本机访问 `http://localhost:8000`。
3. **VPS 控制端＋统一网关**：专用 VPS 的完整 root 登录终端，安装到 `/opt/agent-node-gateway`。加入现有 Tailscale 网络，配置允许访问的账号与后端连接信息。手机连接 Tailscale 后打开输出的 HTTPS 地址，选择不同后端操作；不依赖本地电脑开机。
4. **仅共享记忆的设备**：Linux 安装时选择第 4 项或传入 `--memory-device --gateway-url https://你的网关`。独立的 Syncthing 只发送本机 memories_v2，由网关转发给已连接的后端。

自动化使用 `--server`、`--control`、`--gateway`。网关支持 `--config /private/config.json`，也可用 `--build /verified/build` 导入已验证前端；不提供 build 时从固定基线构建。私有配置必须为 0600，网关默认保存在 `/etc/agent-node-gateway/config.json`。

网关统一转发网页、API、实时消息与文件，使用原生工作区 Cookie；只允许指定 Tailscale 账号访问。后端密钥保存在私有配置及受身份保护的浏览器启动响应，公开安装包与静态构建不含密钥。网关不启动 Agent Server、Agent CLI 或 Xray，不覆盖其他 HTTPS 根入口。

原 `http://wsl` HTTP 80 自动发布、安装向导 CORS 管理和远程文件签名链接补丁已撤回，模型、截图、侧问、计量修复保留。旧后端完整更新将校验并恢复此前受管工作区 SDK 文件，备份并移除明确的 wsl 来源，保留其他自定义配置。本地控制端继续使用 localhost。

本版补充 Codex 与原生 CLI 共用 ~/.codex 的配置和持久记忆、会话概览中的环境/注入上下文、原生 Skill 快捷调用和标题同步。后端与控制端均需更新；运行中的旧 ACP 进程需在任务结束后重新打开。记忆整理仍由原生 Codex 异步执行，开关生效不等于已经生成记忆。

已有节点再次运行同一条命令并选择相同角色即可更新。认证、密钥、会话及网络配置保留；完整更新会重启所选角色相关服务，网关切换静态版本并 reload Nginx。`--toolkit-only` 只替换部署工具包，不安装依赖、构建 UI 或重启服务。

安装包内置已提交源码，保留上游许可证，不包含节点 URI、登录文件、后端密钥或私有网关配置。源码版本：`ac5a1e91afae194d964d33afbda7035407470866`。

校验：将 `install.sh` 与 `install.sh.sha256` 放在同一目录，运行 `sha256sum -c install.sh.sha256`。

网关静态副本使用现有备用字体，避免 Google Fonts 外部样式阻塞国内页面；安装时等待首次 HTTPS 证书就绪。默认使用私人 Serve，不启用 Funnel 公网发布。可选 `--domain op.example.com`：使用 Cloudflare DNS 验证签发正式证书、仅监听 Tailscale 地址，并通过 LocalAPI WhoIs 校验访问账号；原 Tailscale 长地址继续可用。证书每日自动检查续期。域名必须由你管理，DNS 专用 Token 以 0600 权限保存在 VPS，不能放入安装包。

本版修复：概览及运行环境默认展开，完整保留后端环境快照与原生 Skill 信息，区分网关入口和实际主机；计划模式在创建中、断线和手机停靠输入框下均可退出，新会话恢复普通模式，旧计划助手的延迟响应不串入新会话。

本版同时修复慢请求在切换后端时误绑定会话地址/密钥的问题，网关复用后端 TCP 连接；透明分流排除 Tailscale 原生传输。限制 NAT 后端可按源码 `docs/gateway-tunnel.md` 显式配置专用 SSH 隧道，默认安装不创建隧道。

网关已支持网页后端管理：在左侧后端选择菜单点击“管理后端”（或访问 `/gateway/`），新增、编辑、删除、验证连接并自动应用转发配置。标识留空可自动生成；编辑时密钥留空保留，不回显已保存密钥。失败回滚，等待规则生效后才返回成功，不重启后端。

网关入口复用左侧原有“管理后端”和“添加后端”，手机触屏与桌面点击均支持；已移除右下角浮动按钮。

附件规则更新：单张图片 10MiB，其他单个文件 20MiB，一次发送合计 20MiB。大图片组合使用现有 HTTP 接口提交，单独允许等待 120 秒以适应较慢的后端链路，后端兼容补丁支持 32MiB 会话回显帧及 64MiB 有限队列，避免大图导致断连和一直发送中。已有后端需完整更新或应用后端补丁后重启；控制端/网关需更新网页。已缓存的固定服务依赖优先使用本地缓存启动，缓存不足仍可在线安装。

当前更新：两套记忆同时启用，补齐 ACP 的 OpenHands 笔记维护指引。Canvas Codex 与原生 CLI 统一使用 ~/.codex，共用配置、记忆、历史数据库和同账号认证，支持凭证刷新回写。完整更新或 config-apply 自动停止 Canvas、备份并迁移旧身份目录，失败恢复数据；已经迁移则跳过，旧目录和备份保留。菜单调整为安装、配置和补丁、网络分流、持久化、连接与登录、获取脚本更新。已安装且满足版本要求的组件跳过安装。

已有后端执行 `openhands toolkit-update` 获取工具包，然后执行 `openhands config-apply` 迁移旧 Codex 目录、启用记忆、应用后端补丁并重启。只获取脚本不会重启。记忆配置一致会跳过写入。

当前新增：纯 Skill 快捷调用能正确结束发送确认；会话运行和连接状态常驻显示，手机可见。Syncthing 在各 VPS 间共享独立记忆副本，网关收集所有来源，每个后端只接收其他来源。新 VPS 安装后端时加入网关所有者的 Tailscale 网络，并填写私人网关 HTTPS 地址。节点会出现在“管理后端”的待连接列表。点击“连接”且后端与 API Key 验证通过后，下一轮刷新开始同步。同步依赖 Syncthing，无需 rsync。之后共享名单自动刷新，部署更新保留配对。`openhands memory-sync-status` 查看同步状态。

当前新增：左下角显示所选后端的 CPU 核数及使用率、内存已用/总量及占比，页面可见时每 10 秒刷新。已有节点先运行 `openhands toolkit-update`，任务空闲时运行 `bash /opt/agent-node/linux/canvas/resources-update.sh --restart`；网关需更新 UI。

界面调整：会话运行状态收进输入框底部工具栏；模型和推理力度分别选择，手机窄屏的“更多输入操作”也提供两个独立入口。已有网关通过同一安装命令选择网关角色更新，后端无需为这次界面调整重启。

Codex ACP 会话的“压缩上下文”按钮调用当前线程的原生 `/compact`，收到完成事件后显示结果。

左下角状态修复：网关托管后端连续探测失败后，控制端仍会定期验证。验证成功后自动清除旧离线标记。


Windows 只共享记忆时，在 PowerShell 运行下面的独立入口。需要已登录的 Tailscale 和 Node.js 18+，记忆目录替换为本机实际路径：

```powershell
$script = Join-Path $env:TEMP ([IO.Path]::GetRandomFileName() + '.ps1')
Invoke-WebRequest https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/install-memory-device.ps1 -OutFile $script
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -Gateway https://op.example.com -Id desktop -CodexHome 'D:\Users\yourname\.codex'
Remove-Item $script
```

在网关“仅共享记忆的设备”列表启用该来源。Windows 登录时自动运行 `AgentNode-CodexMemory` 计划任务；设备只发送自己的记忆，VPS 将文件保存到 `$CODEX_HOME/peer_memories/desktop/memories_v2/`。设备证书和状态位于 Codex 主目录同级 `.agent-node-memory-device`，不包含在安装包中。暂停与移除都从网关管理页操作。
