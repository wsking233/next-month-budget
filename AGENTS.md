# Codex 协作说明｜下月再说

## 产品与技术方向
这是个人预算资金池管理工具，不是传统逐笔记账产品。2026-10-17 已决定放弃旧 iOS / Expo / React Native 优先路线。

后续以 **React + TypeScript 标准 Web App** 为唯一首版前端，响应式兼容手机、平板及桌面浏览器；不得擅自恢复 Expo、Expo Router、React Native、SwiftUI、原生标签栏或 iOS 编译/签名流程。PWA 尚待确认；部署采用 GitHub Pages + GitHub Actions；首版纯前端，UI 使用 Tailwind CSS + shadcn/ui。

## 工作准则
1. 开发前先读 README 及 docs/02、03、04、05、10。
2. 优先保证账务准确：负数结转、账单去重、分配总额一致、显式调拨、更正审计。
3. 账务金额使用整数分；区分预算、负债、还款和现金资产。
4. `src/domain/` 纯 TypeScript 领域逻辑与 React/UI、存储解耦；保留并扩充其测试。
5. 已确认决策、临时假设、待验证问题不得混淆；不要硬编码示例财务数据。
6. 无需用户授权不得引入服务端、账号体系、真实银行数据。
7. 业务规则变更同步更新 PRD、业务规则及决策文档。
8. 阶段计划详见 `docs/13-web-development-roadmap.md`。Phase 2 业务页面与交互原型已实现；未经指定不得提前实施 Phase 3 或后续阶段。
9. 本地数据采用 localStorage + JSON 备份，不接服务器、远程数据库或登录。

10. 仅保留 main 分支，直接在 main 开发、测试和发布；Pages 使用 Actions artifact，不创建部署分支。
