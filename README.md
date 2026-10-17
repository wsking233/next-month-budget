# 下月再说 · Next Month Budget

> 想花就花，有数就行。

个人预算资金池管理工具，以预算周期、资金池结转和多信用卡账单集中结算为核心。

## 当前状态

Phase 3 内存账务闭环已实现：创建周期与资金池、预算拨款、账单登记及按池/周期拆分结算、显式调拨、分配更正、撤销、账单资料修改、资金池编辑停用及审计记录。余额来自领域流水，正负结转按所选周期计算，历史更正会影响后续余额。默认空账本，独立演示样例不会覆盖用户账本。

**当前仅在内存保存，刷新或关闭页面即丢失。请使用测试数据；Phase 4 本地保存及备份恢复尚未实施，不适合长期录入个人财务数据。** 不接入登录、后端、云同步或银行数据。

技术栈：React 19、React Router 7、Vite 8、Tailwind CSS 4、shadcn/ui 组件约定、Zustand；测试使用 Vitest + Testing Library + Playwright。领域层保持纯 TypeScript，账务金额为整数分，汇总使用精确整数运算，UI 显示人民币元。

## 安装与启动

要求 Node.js 24 LTS + npm 11，版本约定见 `.nvmrc`、`.node-version`。

```bash
# 使用 nvm 时，先执行 nvm install && nvm use
npm ci
npm run dev
```

开发服务监听 `0.0.0.0:5173`（固定端口），云环境转发 5173 即可访问。无需环境变量或后端服务。支持 Dev Containers 的平台可直接使用仓库配置；其他平台设置见 [云开发环境准备](docs/14-cloud-development.md)。

## 检查与构建

```bash
npm run setup          # 锁文件安装 + ESLint、类型、测试、构建检查
npm run lint
npm run typecheck
npm test               # 领域 + React 路由、主题测试
npm run test:watch
npm run build          # 类型检查并输出 dist/
npm run preview        # 在 0.0.0.0:4173 预览构建结果
```

可选浏览器验收（需要额外安装 Chromium 及系统依赖；不在自动安装脚本内）：

```bash
npx playwright install --with-deps chromium
npm run build
npm run test:browser
```

受限环境如已安装系统 Chromium，可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser` 验收；CI 默认使用 Playwright 配套版本。

`dist/` 是普通静态站点，资源使用相对路径，Hash 路由支持 GitHub Pages 的仓库子路径和刷新访问，例如 `/next-month-budget/#/pools`，无需 SPA fallback。

## CI/CD 与 GitHub Pages

仅在 `main` 分支开发、测试和发布。推送 `main` 或手动运行 `Check and deploy Pages` 后，GitHub Actions 依次安装锁定依赖、执行 ESLint / 类型检查 / 单元测试 / 构建，并在生产构建上执行三种屏幕宽度的 Chromium 验收。全部通过后上传 Pages artifact 并部署；不创建 `gh-pages` 分支，无需个人访问令牌。

仓库管理员需在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，并允许仓库运行 Actions。发布地址为 https://wsking233.github.io/next-month-budget/ 。部署结果以 Actions 的 `deploy` 作业和 `github-pages` environment 为准。

浏览器测试使用 `npm run preview`，请先构建；CI 会自动构建并安装 Chromium。失败时可在 Actions 下载 `browser-test-results`。

## 项目结构

- `src/domain/`：纯 TypeScript 预算模型，金额使用整数分，与 UI 和存储解耦
- `src/components/`：响应式布局及 shadcn/ui 风格基础组件
- `src/features/ledger/`：六个业务页面、表单、Zustand 内存工作区与审计展示
- `src/fixtures/`：主动加载的独立样例账本
- `src/lib/money.ts`：整数分输入解析与精确金额展示
- `src/pages/config.ts`：六个功能区域的导航与页面文案
- `src/index.css`：Tailwind 入口、颜色 token、主题与基础样式
- `tests/browser/`：375 / 768 / 1440px 布局与路由验收
- `components.json`：shadcn/ui 配置，别名为 `@/*`
- `docs/`：产品、业务规则、模型、路线图与阶段交付说明

## 业务与开发文档

- [产品需求](docs/02-requirements-prd.md)
- [预算业务规则](docs/03-budget-business-rules.md)
- [信用卡结算](docs/04-credit-card-settlement.md)
- [数据模型](docs/05-data-model.md)
- [决策记录](docs/10-decisions-and-open-questions.md)
- [六阶段开发路线图](docs/13-web-development-roadmap.md)
- [Phase 1 交付与手动验收](docs/15-phase-1-delivery.md)
- [Phase 2 交付与手动验收](docs/16-phase-2-delivery.md)
- [Phase 3 交付与手动验收](docs/17-phase-3-delivery.md)

预算余额不等于银行现金余额；跨池调拨必须显式留痕。浏览器本地存储与备份在 Phase 4 实现，当前账本和主题均只在内存中。按用户约定，日常推送不查询 GitHub Actions 状态 API；仅发布异常时排查。
