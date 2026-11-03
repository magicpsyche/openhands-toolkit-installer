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

自动化使用 `--server`、`--control`、`--gateway`。网关支持 `--config /private/config.json`，也可用 `--build /verified/build` 导入已验证前端；不提供 build 时从固定基线构建。私有配置必须为 0600，网关默认保存在 `/etc/agent-node-gateway/config.json`。

网关统一转发网页、API、实时消息与文件，使用原生工作区 Cookie；只允许指定 Tailscale 账号访问。后端密钥保存在私有配置及受身份保护的浏览器启动响应，公开安装包与静态构建不含密钥。网关不启动 Agent Server、Agent CLI 或 Xray，不覆盖其他 HTTPS 根入口。

原 `http://wsl` HTTP 80 自动发布、安装向导 CORS 管理和远程文件签名链接补丁已撤回，模型、截图、侧问、计量修复保留。旧后端完整更新将校验并恢复此前受管工作区 SDK 文件，备份并移除明确的 wsl 来源，保留其他自定义配置。本地控制端继续使用 localhost。

本版补充 Codex 记忆配置继承与按登录身份持久化、会话概览中的环境/注入上下文、原生 Skill 快捷调用和标题同步。后端与控制端均需更新；运行中的旧 ACP 进程需在任务结束后重新打开。记忆整理仍由原生 Codex 异步执行，开关生效不等于已经生成记忆。

已有节点再次运行同一条命令并选择相同角色即可更新。认证、密钥、会话及网络配置保留；完整更新会重启所选角色相关服务，网关切换静态版本并 reload Nginx。`--toolkit-only` 只替换部署工具包，不安装依赖、构建 UI 或重启服务。

安装包内置已提交源码，保留上游许可证，不包含节点 URI、登录文件、后端密钥或私有网关配置。源码版本：`a7b5b95497da8f2b3c88278d9653ec35c963c36b`。

校验：将 `install.sh` 与 `install.sh.sha256` 放在同一目录，运行 `sha256sum -c install.sh.sha256`。

网关静态副本使用现有备用字体，避免 Google Fonts 外部样式阻塞国内页面；安装时等待首次 HTTPS 证书就绪。默认使用私人 Serve，不启用 Funnel 公网发布。可选 `--domain op.example.com`：使用 Cloudflare DNS 验证签发正式证书、仅监听 Tailscale 地址，并通过 LocalAPI WhoIs 校验访问账号；原 Tailscale 长地址继续可用。证书每日自动检查续期。域名必须由你管理，DNS 专用 Token 以 0600 权限保存在 VPS，不能放入安装包。

本版修复：概览及运行环境默认展开，完整保留后端环境快照与原生 Skill 信息，区分网关入口和实际主机；计划模式在创建中、断线和手机停靠输入框下均可退出，新会话恢复普通模式，旧计划助手的延迟响应不串入新会话。

本版同时修复慢请求在切换后端时误绑定会话地址/密钥的问题，网关复用后端 TCP 连接；透明分流排除 Tailscale 原生传输。限制 NAT 后端可按源码 `docs/gateway-tunnel.md` 显式配置专用 SSH 隧道，默认安装不创建隧道。

网关已支持网页后端管理：打开 `/gateway/` 或控制端右下角“网关管理”，新增、编辑、删除、验证连接并自动应用转发配置。标识留空可自动生成；编辑时密钥留空保留，不回显已保存密钥。失败回滚，等待规则生效后才返回成功，不重启后端。
