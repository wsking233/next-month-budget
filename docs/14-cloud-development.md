# 云开发环境准备

## 平台设置

- 代码分支：`main`
- 运行时：Node.js 24 LTS + npm 11
- 工作目录：仓库根目录
- 安装命令：`bash scripts/setup.sh`
- 启动命令：`npm run dev`
- 开发端口：`5173`
- 构建命令：`npm run build`，输出目录：`dist`
- 构建预览命令：`npm run preview`，预览端口：`4173`
- 环境变量：当前无需配置；首版没有服务端、登录或远程数据库

Vite 已配置监听 `0.0.0.0`，固定端口且端口冲突时直接报错。保留 Vite 默认 Host 检查；若平台提示 blocked host，仅将平台提供的确切开发域名通过 `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` 环境变量加入，不设置全域名允许。

## Dev Containers / Codespaces

工具读取 `.devcontainer/devcontainer.json`，使用 Node.js 24 镜像，创建后执行统一安装脚本，并预留 5173 / 4173 端口。首次拉取镜像需访问 Microsoft Container Registry，安装依赖需访问 npm 注册表。受限网络通过平台配置允许这些来源，保持 TLS 校验开启。

安装脚本执行锁文件安装、ESLint、类型检查、领域与 React 测试和生产构建；失败即退出，不覆盖本地配置、不写入演示账本。脚本完成后手动执行 `npm run dev`；不要将依赖安装配置为每次终端启动命令。开发端口建议保持私有。

## 其他云平台

仓库配置不会自动创建机器。若平台不读取 Dev Container，按上面的运行时、安装命令及启动命令设置。使用 nvm 时可先运行 `nvm install && nvm use`。`.npmrc` 会检查 Node/npm 主版本；锁文件保证依赖可重复安装。

## 环境变量与数据

`.env.example` 记录公开配置约定，当前没有必填值。按需手动复制为 `.env.local`；`VITE_` 变量会被打包到浏览器中，不能存放密码、Token 或真实财务数据。环境文件默认忽略，仅提交示例文件。

Phase 1 的页面为空骨架，没有财务输入和账本保存；主题切换不持久化。localStorage 账本与 JSON 备份按 Phase 4 实现。

## 检查与边界

`npm run check` 检查代码与构建；`npm run test:browser` 需要额外安装 Playwright Chromium，验收 375 / 768 / 1440px 路由、布局和主题。普通安装脚本不下载浏览器或安装系统依赖。

Dev Container 镜像拉取及 Codespaces 生命周期尚未在实际平台创建验证。脚本和 Web 服务验证不代表已经创建新的云环境。GitHub Pages 使用 Hash 路由（如 `/#/pools`）和相对资源路径，无需 SPA fallback；CI/CD 设置见 README。
