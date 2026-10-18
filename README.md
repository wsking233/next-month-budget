# 下月再说 · Next Month Budget

> 想花就花，有数就行。

个人预算资金池管理工具，以预算周期、资金池结转和多信用卡账单集中结算为核心。

## 当前状态

Phase 5 统计与预算规划已实现：概览提供预算收支桥梁、结转趋势、多周期对比与拨款分布；预算计划提供手工假设驱动的只读模拟。账务操作自动保存到当前浏览器，刷新和关闭重开可恢复；支持 JSON 导出、严格校验导入与覆盖确认。保留周期、资金池、拨款、账单结算、调拨、更正、撤销及审计闭环，演示样例与本地账本隔离。

数据仅在此浏览器保存，不跨设备同步；清理站点数据、隐私模式或换设备可能丢失，请定期导出备份。备份是未加密 JSON，需妥善保管。没有登录、后端、云同步或银行数据接入。当前版本 0.8.0，六阶段路线图已完成；下一轮已加入建账引导、组合筛选、主题持久化，以及固定金额模板、收入分配预览与可审计撤销。

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
npx playwright install --with-deps chromium firefox webkit
npm run build
npm run test:browser      # Chromium
npm run test:browser:all  # Chromium + Firefox + WebKit
```

受限环境如已安装系统 Chromium，可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser` 验收；CI 使用三种 Playwright 配套浏览器；本机运行全部浏览器前需完成各自安装。

`dist/` 是普通静态站点，资源使用相对路径，Hash 路由支持 GitHub Pages 的仓库子路径和刷新访问，例如 `/next-month-budget/#/pools`，无需 SPA fallback。

## CI/CD 与 GitHub Pages

仅在 `main` 分支开发、测试和发布。推送 `main` 或手动运行 `Check and deploy Pages` 后，GitHub Actions 依次安装锁定依赖、执行 ESLint / 类型检查 / 单元测试 / 构建，并在生产构建上执行 Chromium / Firefox / WebKit 回归和 WCAG 自动审计。全部通过后上传 Pages artifact 并部署；不创建 `gh-pages` 分支，无需个人访问令牌。

仓库管理员需在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，并允许仓库运行 Actions。发布地址为 https://wsking233.github.io/next-month-budget/ 。部署结果以 Actions 的 `deploy` 作业和 `github-pages` environment 为准。

浏览器测试使用 `npm run preview`，请先构建；CI 会自动构建并安装 Chromium。失败时可在 Actions 下载 `browser-test-results`。

## 保存、备份与恢复

- 本地账本每次操作先校验并写入，成功后才更新界面；空间不足或存储被禁用时，本次操作不生效，原账本和表单输入保留。处理权限或空间问题后可重新提交。
- 在「设置 → 本地保存与备份」导出 JSON。恢复时先选择文件，通过版本、引用、金额、结算冲销、调拨守恒与审计校验后，再确认整体覆盖；取消或校验失败不会修改原账本。导入不合并、不重复入账。
- 当前快照版本为 2，单文件最大 2 MB。版本 1 先按旧格式严格校验，再在内存无损升级；读取不改写原始存储，后续保存成功才写出版本 2。新备份无法用于旧版应用，其他未知版本拒绝读取；本地数据损坏时暂停写入，可下载原始存储留存、重新读取、从有效备份恢复或明确清空。
- 演示模式不写入本地，不能作为用户备份导出。请返回本地账本后备份。
- 请避免多个标签页同时编辑。检测到其他页面更新后会暂停旧页写入，需重新读取。该保护不构成跨标签页事务或云同步。
- 本地保存不等于离线应用；尚未实现 Service Worker，不能保证无网络首次访问或静态资源缓存。

## 项目结构

- `src/domain/`：纯 TypeScript 预算模型与统计/模拟计算，金额使用整数分，与 UI 和存储解耦
- `src/components/`：响应式布局及 shadcn/ui 风格基础组件
- `src/features/ledger/`：六个业务页面、表单、Zustand 工作区、保存状态与备份恢复
- `src/features/planning/`：统计图表、精确明细及只读规划
- `src/storage/`：版本化快照、Zod / 账务一致性校验与 LocalStorageRepository
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
- [下一轮开发计划](docs/21-next-development-plan.md)
- [v0.7 日常使用体验交付](docs/22-v0.7-delivery.md)
- [v0.8 固定预算与收入交付](docs/23-v0.8-delivery.md)
- [Phase 1 交付与手动验收](docs/15-phase-1-delivery.md)
- [Phase 2 交付与手动验收](docs/16-phase-2-delivery.md)
- [Phase 3 交付与手动验收](docs/17-phase-3-delivery.md)
- [Phase 4 交付与手动验收](docs/18-phase-4-delivery.md)
- [Phase 5 交付与统计口径](docs/19-phase-5-delivery.md)
- [Phase 6 质量与兼容验收](docs/20-phase-6-delivery.md)
- [版本记录](CHANGELOG.md)

预算余额不等于银行现金余额；跨池调拨必须显式留痕。账本自动保存在当前浏览器，主题偏好独立保存在当前浏览器，不进入账本备份。按用户约定，日常推送不查询 GitHub Actions 状态 API；仅发布异常时排查。
