# OpenHands Toolkit 安装 / 更新

控制端和后端使用同一个下载入口，无需 GitHub 登录或拉取仓库。支持 Ubuntu/Debian Linux（含启用 systemd 的 WSL）。

```bash
(
  installer=$(mktemp "$HOME/openhands-install.XXXXXX.sh") || exit
  trap 'rm -f "$installer"' EXIT
  curl -fL --retry 2 https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/install.sh -o "$installer" && bash "$installer"
)
```

运行后选择：

1. **后端**：在 VPS 的完整 root 登录终端运行，安装到 `/opt/agent-node`。可选 Xray 分流和 Tailscale；VLESS 由用户隐藏输入。原生 Codex/Claude 订阅登录由用户手动执行，完成后显示 Backend 地址和 API Key。
2. **控制端**：在 Linux / WSL 普通用户终端运行，系统依赖通过 sudo 安装。程序放在 `~/.local/share/agent-node/toolkit`，前端通过用户 systemd 服务运行。可选启用 Tailscale 的 HTTP 80 端口入口。

控制端前端仅监听 `127.0.0.1:8000`；Tailscale Serve 将 Tailnet 内的 HTTP 80 端口转发到前端，访问 `http://节点别名`（例如 `http://wsl`）或 `http://Tailscale-IP`，不需要带端口。入口使用 `--bg` 持久配置，Node 保持普通用户运行。其他设备浏览器需填写 VPS Backend 地址和 API Key。Tailscale 登录尚未完成时，登录后执行 `openhands tailscale-up` 即可补全入口。已有其他 Serve 服务会保留；80 端口被其他服务占用时拒绝覆盖。

本机仍可访问 `http://localhost:8000`。Windows 和 WSL 需要保持运行。后端不变，仍使用其原有监听地址、端口及 API Key。

自动化可显式指定角色，跳过角色选择：

```bash
bash install.sh --server --no-proxy --no-tailscale
bash install.sh --control --tailscale
```

把参数加在上面下载命令的 `bash "$installer"` 后即可。已有节点重新运行同一条命令可以更新：先备份旧程序，再覆盖程序目录，保留用户配置、认证、密钥和会话，完成后重启所选角色的 Canvas。更新会中断该服务的当前连接；程序更新失败会恢复旧程序目录，系统包和 SDK 由各模块处理。

安装后用 `openhands` 打开二级管理菜单，`openhands connection` 查看地址，`openhands update` 按当前角色更新。后端命令位于 `/usr/local/bin/openhands`，控制端命令位于 `~/.local/bin/openhands`；控制端如尚未加入 PATH，可先使用完整路径或重新登录终端。已有同名其他程序会保留。

原生授权由用户手动执行：

```bash
codex login
claude auth login
```

国内后端节点可配置 Xray 透明分流；国外节点可跳过。原生 Codex 不安装快捷函数、不需要代理变量。下载使用当前用户主目录的随机临时文件，避免 `/tmp` 同名文件权限冲突；下载完整文件后运行，不使用 `curl | bash`。

安装包内置完整已提交源码，不包含节点 URI、登录文件或密钥。主项目继续保持私有；上游许可证随源码保留。源码版本：`e7e9e2c2085dde9916b2c15943a26051812e4407`。

校验：将 `install.sh` 与 `install.sh.sha256` 保存到同一目录，运行 `sha256sum -c install.sh.sha256`。

规则集每日北京时间 04:30 由 Xray 自动下载并热重载。

仅更新部署脚本和菜单：`openhands toolkit-update`，或安装更新子菜单第 5 项。此项备份并替换工具包，不安装依赖或重启服务。`openhands update` 仍为完整部署更新。
