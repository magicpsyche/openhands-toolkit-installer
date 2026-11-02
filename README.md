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

国内节点可选择 Xray 透明分流，VLESS 由本人隐藏输入；国外节点可跳过 Xray。原生 Codex 不安装快捷函数、不需要代理变量。透明分流只处理本机 HTTP/HTTPS TCP，AI 域名走 VLESS，其余透明流量直连。

订阅授权只显示说明，由你手动执行：

```bash
codex login
claude auth login
```

完成后终端显示 Backend 地址和 API Key，也可从二级菜单或命令查看：

```bash
/opt/agent-node/linux/agent-node.sh server
/opt/agent-node/linux/agent-node.sh server connection
```

菜单分为安装更新、服务管理、网络分流、Canvas 修复、连接与登录。旧版本已经打开的终端如仍有 Codex 函数，执行一次 `unset -f codex`，或重新登录 SSH。

安装包内置完整项目源码，不包含节点 URI、登录文件或密钥。主项目仓库继续私有。源码版本：`723d1cb6900b01a77f50ea709582ea73d133c42f`。上游许可证随源码保留。下载完整文件后运行，不使用 `curl | bash`，以保留向导输入。

已有程序目录可带参数重跑；首次非交互安装时，把这些参数加在下载命令的 `bash "$installer"` 后：

```bash
/opt/agent-node/install.sh --proxy --tailscale
/opt/agent-node/install.sh --no-proxy --no-tailscale
```

校验：将 `install.sh` 与 `install.sh.sha256` 保存到同一目录，运行 `sha256sum -c install.sh.sha256`。
