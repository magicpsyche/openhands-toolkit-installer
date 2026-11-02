# OpenHands Toolkit 安装入口

新 Ubuntu/Debian VPS 在完整 root 登录终端执行，无需 GitHub 登录或提前 clone：

```bash
curl -fL --retry 2 https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/install.sh -o /tmp/install-openhands.sh && bash /tmp/install-openhands.sh
```

向导会询问是否配置 VLESS 分流、加入 Tailscale，以及登录 Codex/Claude，然后自动安装环境、Agent、工具链、Canvas 后端与兼容补丁，启动服务并检查就绪。账号授权由本人完成，节点 URI 隐藏输入。安装依赖需要联网。

安装包内置完整项目源码，不含节点密钥、认证文件或 VLESS 节点。主项目仓库继续保持私有。源码版本：`04438dbdf666a2dc8d0b4eee9cb6b9d7ddeb1173`。上游补丁的 MIT 许可证随源码保留。

先完整下载再执行，终端输入用于向导；不要通过 `curl | bash` 运行。首次安装解包到 `/opt/agent-node`，目标目录或 Canvas 服务已存在时拒绝覆盖。已有节点应使用模块更新。

可选参数：

```bash
bash /tmp/install-openhands.sh --proxy --tailscale --login codex
bash /tmp/install-openhands.sh --no-proxy --no-tailscale --login none
```

校验下载：

```bash
mkdir -p /tmp/agent-node-download
cd /tmp/agent-node-download
curl -fLO https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/install.sh
curl -fLO https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/install.sh.sha256
sha256sum -c install.sh.sha256
bash install.sh
```

安装源码包不含 Git 历史；后续要执行 Git 同步更新，需要单独配置私有仓库访问权限和完整 clone。本仓库用于分发安装包。
