# 下月再说 · Next Month Budget

> 想花就花，有数就行。

个人预算资金池管理工具，以预算周期、资金池结转和多信用卡账单集中结算为核心。

## 当前状态

v0.3.0：已实现内存账务闭环、隔离演示和审计；尚无持久化，刷新丢失，不适合保存真实数据。当前授权及后续阶段见 [自主迭代计划](docs/16-autonomous-iteration.md)，逐版交付见 [版本记录](docs/17-release-notes.md)。

技术栈：React 19、React Router 7、Vite 8、Tailwind CSS 4、shadcn/ui 组件约定；测试使用 Vitest + Testing Library。状态管理在业务接入时按路线图引入 Zustand，当前无需业务状态库。

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
npm run test:browser
```

`dist/` 是普通静态站点。正式托管需要配置 SPA fallback：未匹配静态文件的页面请求回退到 `index.html`，以支持 `/pools` 等深层链接。Vite 开发/预览服务自带该行为；`preview` 仅用于验证构建。

## 项目结构

- `src/domain/`：纯 TypeScript 预算模型，金额使用整数分，与 UI 和存储解耦
- `src/components/`：响应式布局及 shadcn/ui 风格基础组件
- `src/pages/`：概览、资金池、账单、预算计划、历史记录、设置空页面
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

预算余额不等于银行现金余额；跨池调拨必须显式留痕。后续浏览器本地存储与备份在 Phase 4 实现，当前主题切换只保存在内存中。
