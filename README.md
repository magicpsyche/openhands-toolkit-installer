# OpenHands Toolkit 安装 / 更新

在 Ubuntu/Debian VPS 的完整 root 登录终端执行，无需 GitHub 登录、clone 或传文件：

```bash
(
  installer=$(mktemp /root/openhands-install.XXXXXX.sh) || exit
  trap 'rm -f "$installer"' EXIT
  curl -fL --retry 2 https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/install.sh -o "$installer" && bash "$installer"
)
```

下载使用 root 私有目录中的随机临时文件，避免 `/tmp` 同名文件的权限或所有权冲突；运行结束自动删除。

新节点安装和已有节点更新使用同一条命令。更新先备份旧程序目录，保留用户目录中的认证、API Key、会话和本机代理配置；完成后重启 Canvas。请在允许中断任务时更新。程序更新失败会恢复旧程序目录，系统包和 SDK 由对应模块处理。

国内节点可选择 Xray 透明分流，VLESS 由本人隐藏输入；国外节点可跳过 Xray。原生 Codex 不安装快捷函数、不需要代理变量。透明分流只处理本机 HTTP/HTTPS TCP，维护中的受限网站规则集（`geosite:blocked-in-cn`）及 AI 补充域名走 VLESS，其余默认直连；显式代理入口也使用相同规则。

订阅授权只显示说明，由你手动执行：

```bash
codex login
claude auth login
```

完成后终端显示 Backend 地址和 API Key，也可从二级菜单或命令查看：

```bash
openhands
openhands connection
```

安装后直接输入 `openhands` 打开管理菜单，`openhands status` 查看状态；重新登录 SSH 后仍可使用。若 `/usr/local/bin/openhands` 已被其他程序占用，会保留原命令，此时使用 `/opt/agent-node/linux/agent-node.sh server` 打开菜单。

菜单分为安装更新、服务管理、网络分流、Canvas 修复、连接与登录。旧版本已经打开的终端如仍有 Codex 函数，执行一次 `unset -f codex`，或重新登录 SSH。

安装包内置完整项目源码，不包含节点 URI、登录文件或密钥。主项目仓库继续私有。源码版本：`d43037055b3a48c17f629d426f50cdc683385eb4`。上游许可证随源码保留。下载完整文件后运行，不使用 `curl | bash`，以保留向导输入。

已有程序目录可带参数重跑；首次非交互安装时，把这些参数加在下载命令的 `bash "$installer"` 后：

```bash
/opt/agent-node/install.sh --proxy --tailscale
/opt/agent-node/install.sh --no-proxy --no-tailscale
```

校验：将 `install.sh` 与 `install.sh.sha256` 保存到同一目录，运行 `sha256sum -c install.sh.sha256`。

## Linux 控制端（Ubuntu/Debian，含 WSL）

在普通用户终端执行；系统依赖会通过 sudo 安装，不要用 root 启动整个控制端安装：

```bash
(
  installer=$(mktemp "$HOME/openhands-install.XXXXXX.sh") || exit
  trap 'rm -f "$installer"' EXIT
  curl -fL --retry 2 https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/install.sh -o "$installer" && bash "$installer" --control --tailscale
)
```

暂不加入 Tailscale 时使用 `--control --no-tailscale`。安装完成后可用 `~/.local/bin/openhands` 管理控制端；重新登录后通常可直接输入 `openhands`。`openhands connection` 显示访问地址，`openhands update` 更新控制端。

程序目录为 `~/.local/share/agent-node/toolkit`，服务为 `~/.config/systemd/user/agent-canvas.service`；仅安装控制端前端及 UI 修复，不安装 Agent CLI 或配置后端。前端监听 `0.0.0.0:8000`，浏览器填写已有 VPS Backend 地址和 API Key。WSL 内完成 Tailscale 登录后，可用 `http://WSL的Tailscale-IP:8000` 访问，Windows 和 WSL 需保持运行。

重新执行同一条命令可以覆盖更新：旧程序目录会备份，用户配置和认证保留，控制端服务会重启。控制端需要 Linux、systemd 用户会话和 sudo 权限；不提供 Windows 原生控制端安装。

规则集每日北京时间 04:30 由 Xray 自动下载并热重载。

仅更新部署脚本和菜单：`openhands toolkit-update`，或安装更新子菜单第 5 项。此项备份并替换工具包，不安装依赖或重启服务。`openhands update` 仍为完整部署更新。
