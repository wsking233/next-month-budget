# 下月再说 · Next Month Budget

> 想花就花，有数就行。

个人预算资金池管理工具，以预算周期、资金池结转和多信用卡账单集中结算为核心。不是要求每天逐笔记账的记账 App。

## 当前状态（2026-10-17）

**产品规划与领域模型阶段。** 已清理旧 Expo / React Native / iOS 工程、导航界面、构建脚本和平台限定计划。暂不包含可运行的 Web 前端、Node 工程或本地存储实现。

新开发方向：**标准 React + TypeScript Web App**，Web 优先，以响应式布局适配手机、平板和桌面浏览器。后续需要离线能力时再评估 PWA / 浏览器持久化方案，不提前绑定具体部署、数据库或组件库。

## 已保留内容

- `docs/01-product-vision.md`：产品愿景和成功标准
- `docs/02-requirements-prd.md`：产品需求及核心验收
- `docs/03-budget-business-rules.md`：资金池余额、结转、调拨及账务不变量
- `docs/04-credit-card-settlement.md`：信用卡账单、还款与预算归属
- `docs/05-data-model.md`：领域概念实体与关系
- `docs/09-competitor-analysis.md`：竞品观察
- `docs/10-decisions-and-open-questions.md`：最新已定方向、待确认项
- `docs/12-interaction-flow.md`：与平台无关的业务交互流程
- `src/domain/budget.ts` 和 `src/domain/budget.test.ts`：纯 TypeScript 预算业务模型及测试

## 核心原则

1. 预算拨款不是账户之间的实际转账；预算余额不是银行现金余额。
2. 正负预算跨期滚存，禁止自动无痕跨池调拨。
3. 账单金额分配必须全额匹配，结算可追溯且不得重复扣减。
4. 金额以整数分表示，避免浮点误差。
5. 业务逻辑与页面、浏览器存储和后端服务解耦。
6. 示例金额与日期仅用于验证，不硬编码、不上传真实个人财务数据。

## 开发计划

[Web App 六阶段开发路线图](docs/13-web-development-roadmap.md)：Phase 1 工程与布局、Phase 2 交互原型、Phase 3 业务模型、Phase 4 localStorage 与备份、Phase 5 统计规划、Phase 6 质量与发布。目前仅规划，尚未实施。

## 下一阶段

在保留并复核现有领域规则的基础上，重新初始化 React + TypeScript Web 工程；先完成跨屏幕尺寸的布局、路由、基础页面骨架，再逐步接入业务逻辑与持久化。旧 Expo 工程完整保存在归档分支，避免历史代码丢失。
