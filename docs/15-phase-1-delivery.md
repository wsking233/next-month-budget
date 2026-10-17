# Phase 1 交付与验收

## 已实现范围

- Vite + React + TypeScript 工程与开发、构建、预览命令。
- React Router 六个空页面：概览、资金池、账单、预算计划、历史记录、设置；未知地址显示 404，可返回概览。
- AppLayout：桌面侧栏、移动端紧凑导航、统一颜色 token、深浅主题、键盘焦点及跳至内容入口。
- Tailwind CSS 4 + shadcn/ui 配置、可复用 Button 组件及路径别名。
- ESLint、TypeScript、Vitest、Testing Library 与 Playwright 浏览器验收。
- 云环境安装脚本检查整个工程；保留 Node 24 / npm 11、Dev Container 与端口约定。
- 原有预算领域模型和测试保持不变。未实现 Mock、业务操作、Zustand 业务状态、账本存储及后续阶段。

## 变更文件范围

- 工程：package.json、package-lock.json、index.html、vite.config.ts、tsconfig.json、eslint.config.js、vitest.config.ts、components.json、playwright.config.ts。
- 页面与样式：src/main.tsx、src/App.tsx、src/index.css、src/components/、src/pages/、src/lib/utils.ts。
- 验证：src/App.test.tsx、src/test/setup.ts、tests/browser/shell.spec.ts。
- 云环境和说明：scripts/setup.sh、.env.example、.gitignore、README.md、AGENTS.md、docs/10、13、14、15。

## 已执行验证

- 完整运行 `bash scripts/setup.sh`：npm ci、ESLint、TypeScript、13 项领域/界面测试及生产构建通过。
- 原有领域测试 5 项全部通过；领域文件内容与原仓库 blob SHA 一致。
- Playwright Chromium：375 / 768 / 1440px 三组浏览器验收通过，覆盖六个直接访问路由、导航、404 返回、深浅主题与无横向溢出；无页面 JavaScript 错误。
- `npm run dev` 可启动 5173 服务；`npm run preview` 可启动 4173 服务；使用 Hash 路由访问及刷新子页面。
- 已查看移动端与桌面截图。构建输出位于 dist/，不提交生成文件、node_modules 或验收截图。

## 手动验收步骤

1. 在 Node 24 / npm 11 环境运行 `bash scripts/setup.sh`，确认检查与构建成功。
2. 运行 `npm run dev`，转发 5173 端口；分别以 375、768、1440px 宽度访问。
3. 逐个点击六个导航项，核对标题、当前导航状态；刷新深层链接，确认页面可达。
4. 切换深浅主题；按 Tab 检查焦点与跳至主要内容入口，确认无横向滚动条。
5. 访问任意未知路径，确认 404 和返回概览链接可用。
6. 执行 `npm run build && npm run preview`，转发 4173，重复检查。

## 未解决问题与边界

- 尚未在实际 Dev Container / Codespaces 上拉取镜像和验证生命周期。
- 本次只实现 Phase 1；资金池、账单等页面为空骨架，不能录入或保存真实财务数据。
- 主题选择不持久化。静态生产托管采用 GitHub Pages，Hash 路由无需 SPA fallback；自动部署配置见 README，线上状态以 GitHub Actions 为准。
- 后续阶段等待明确指令，不自动进入 Phase 2。
