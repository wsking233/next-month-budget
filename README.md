# 下月再说 · Next Month

> 想花就花，有数就行。

一个移动端优先、低频使用的个人**预算资金池管理**项目。它不是传统逐笔记账 App：先分配收入和预算，再将多张信用卡账单的合计金额分配至资金池，预算结余跨期积累，超支负余额由未来拨款弥补。

**项目阶段：工程框架已初始化，业务规则仍在需求验证中。**

## 本地开发

环境要求：Node.js `^22.13.0` 或 `^24.3.0`（推荐 Node 24 LTS）、pnpm 11.25.0。
本机默认 Node 已升级至 24.22.0 LTS，npm/npx 为 11.21.1，可直接使用 `npm run` 启动和编译。
项目按用户最新要求使用 Expo SDK 57（React Native 0.86 / React 19.2），手机上的 Expo Go 需支持 SDK 57；不要直接升级到其他 Expo SDK 大版本。
依赖安装仍使用 pnpm 及仓库锁文件；`tools.cmd` 可调用 Codex 附带的 Node/pnpm 作为备用环境，只调整当前命令的环境。

```powershell
.\tools.cmd install --frozen-lockfile
npm run web
```

浏览器打开 `http://localhost:8081`，修改 `src/app/index.tsx` 可热更新。端口被占用时以终端提示为准。
已有正常 Node/pnpm 环境时，可以直接运行 `pnpm install --frozen-lockfile`、`pnpm web`。

```powershell
npm run typecheck       # TypeScript 检查
npm run build           # Web 静态编译，输出 dist/
npm run build:ios       # iOS JS/Hermes 打包验证，不是签名安装包
npm run start           # Metro 开发服务，供兼容 SDK 的 Expo Go 连接
npm run go              # 清理缓存并启动 SDK 57 Expo Go 调试
```

Web 调试：先启动 Web，再在 VS Code 选择项目自带的 Chrome 调试配置，设置断点或使用浏览器开发者工具。
原生调试：iPhone 使用支持 SDK 57 的 Expo Go，电脑与手机连接同一局域网，运行 `npm run go` 后用手机扫描终端二维码；终端按 `j` 打开 React Native DevTools。`npm run web` 的 localhost 地址只用于电脑浏览器预览。
Windows 无法运行 iOS 模拟器或在本机编译签名 IPA；iPhone 真机安装和原生能力仍需单独验证。
Expo 工作流见 [官方开发说明](https://docs.expo.dev/get-started/start-developing/)。

### 工程目录

- `src/app/`：Expo Router 页面和导航，当前有首页与项目说明页。
- `src/domain/`：预留独立领域逻辑，业务实现前先设计关键测试案例。
- `src/data/`：预留存储接口及 Expo SQLite 平台适配；尚未初始化数据库。
- `docs/`：产品需求、业务规则和架构决策。

当前没有预算计算、真实财务数据、服务端或登录功能。

## 为什么做
基础生活费很容易掌握，但数码、旅游、人情等间歇性开支使预算和储蓄目标难以核对。目标是在不每天逐笔记账的情况下，回答：
- 本期哪些预算还剩钱？哪些已经透支？
- 多张信用卡不同还款日的账单，分别归入哪一期预算？
- 如果今天买一个新设备，未来多少个月的兴趣预算会被占用？
- 计划储蓄和实际现金资产到底有什么区别？

## 第一版的核心能力
1. 以工资周期组织月度预算，并设定储蓄目标与资金池拨款。
2. 分类资金池正余额累积、负余额自动结转抵扣。
3. 多信用卡账单登记、总额拆分、预算周期归属、结算及核对。
4. 显式资金池调拨、预算流水与更正审计，禁止无痕挪用。
5. 离线、本地优先、数据备份恢复。

## 技术方向
iOS 为主要使用平台；React Native + Expo + TypeScript，Expo Router，本地存储优先 Expo SQLite。Web 用于辅助预览。首版不需要后端、银行自动同步或商业化功能。

## 文档索引
| 文档 | 内容 |
| --- | --- |
| [产品愿景](docs/01-product-vision.md) | 问题、定位、价值与成功标准 |
| [产品需求 PRD](docs/02-requirements-prd.md) | 核心场景、首版范围与验收 |
| [预算业务规则](docs/03-budget-business-rules.md) | 资金池、正负结转、调拨、不变量 |
| [多卡账单结算](docs/04-credit-card-settlement.md) | 账单日期、还款日期、预算月份 |
| [领域数据模型](docs/05-data-model.md) | 核心实体与约束 |
| [技术架构](docs/06-architecture.md) | React Native / Expo、本地优先 |
| [UI/UX原则](docs/07-ui-ux-guidelines.md) | 移动端、极简低录入体验 |
| [开发路线图](docs/08-development-roadmap.md) | 验证、原型、开发、真机测试 |
| [竞品观察](docs/09-competitor-analysis.md) | Goodbudget、Actual Budget、YNAB |
| [决策与待确认项](docs/10-decisions-and-open-questions.md) | 区分已定方案与假设 |

## 重要边界
- 示例月收入 20,000 元、目标储蓄 13,000 元、消费预算 7,000 元，**不是软件硬编码参数**。
- 预算结算月份可能与交易发生月份不同；预算额度不等于银行账户现金。
- 真实信用卡账单、账号、交易记录等敏感财务数据不得提交仓库。
- 开发前先用脱敏的真实场景验证跨月结算规则与防重复机制。

详见 [项目决策记录](docs/10-decisions-and-open-questions.md)。
