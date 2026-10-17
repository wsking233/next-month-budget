# 云开发环境准备

本次只准备开发环境，未执行完整 Phase 1。架构仍遵循 [Web 开发计划](13-web-development-roadmap.md)：React + TypeScript + Vite，浏览器本地存储，无后端、登录、远程数据库。

## 自动创建（Codespaces / Dev Containers）

从仓库创建 Codespace 或使用 VS Code 的 Reopen in Container。工具读取 `.devcontainer/devcontainer.json`，使用 Node.js 24 LTS 镜像和其自带的 npm 11，并自动运行：

```bash
bash scripts/setup.sh
```

脚本根据 `package-lock.json` 执行 `npm ci`，随后运行 TypeScript 检查与现有领域测试。失败即退出，不修改已有本地配置或注入演示账本。创建后重复执行同一命令可重新安装并验证。

## 其他云平台（包括 Codex 云环境）

仓库文件不会自行创建云机器。若平台支持 Dev Container，选择该配置；若不支持，在平台设置中选择 Node.js 24 LTS + npm 11，并将仓库根目录下的安装命令设为 `bash scripts/setup.sh`。不要将该命令设为每次终端启动命令。

使用 nvm 的环境可先执行 `nvm install && nvm use`；`.nvmrc` 和 `.node-version` 均指定 Node 24 系列，允许安全补丁升级。`.npmrc` 会拒绝不匹配的 Node/npm 主版本。镜像首次拉取需要访问 Microsoft Container Registry，依赖安装需要访问 npm 注册表；受限网络请在平台配置中允许这些来源，不关闭 TLS 校验。

## 当前可运行命令

```bash
npm run setup       # 安装锁定依赖并检查
npm run typecheck   # 当前只检查 src/domain
npm test            # 单次执行现有领域测试
npm run test:watch  # 交互式测试
npm run check       # 类型检查 + 测试
```

当前还没有 Web 页面、`npm run dev` 或 `npm run build`。本次不为尚未存在的入口配置自动启动，也不将 Phase 1 标为完成。后续 Phase 1 需扩充 TypeScript 和 Vitest 配置以覆盖 React/DOM 测试，添加 Vite 与对应依赖及脚本，并更新锁文件。

## 预留端口与环境变量

Dev Container 预留 5173（Vite 开发）及 4173（预览），不会自动启动服务。Phase 1 后在云环境手动运行 `npm run dev -- --host 0.0.0.0`，必要时预览运行 `npm run preview -- --host 0.0.0.0`。保持转发端口私有。

当前不需要环境变量或密钥。`.env.example` 仅记录约定，不伪造服务地址或密钥。以后有公开配置需求时可手动复制为 `.env.local`；已有文件不会被安装脚本覆盖。`VITE_` 变量可被浏览器读取，不能存储秘密或真实财务数据；`.env*` 本地文件已忽略，仅提交示例文件。

## 验证边界

提交前验证锁文件安装、脚本语法、类型检查与原有领域测试。Dev Container 的镜像拉取、容器构建和 Codespaces 自动生命周期仍需在支持的平台上实际创建后验证；不能把本地脚本通过当作云环境已经创建。
