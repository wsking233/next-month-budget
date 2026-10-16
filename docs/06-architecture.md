# 技术架构与平台决策

## 已确定方向
- **目标平台**：当前仅支持 iPhone；全部界面以真机表现为准，不保留 Web/Android 预览。
- **客户端**：React Native + Expo + TypeScript。
- **路由**：Expo Router。
- **原生界面**：导航使用系统 Native Tabs/Native Stack；可由系统表达的控件优先使用 `@expo/ui/swift-ui`，不以 React Native 样式仿制 UIKit/SwiftUI 控件。
- **本地数据**：优先考虑 Expo SQLite。
- **架构**：独立领域计算模块 + 数据访问层 + UI 展示层。
- **后端**：首版不要求；无用户登录、无银行 API。
- **部署/调试**：可在无 Mac 条件下使用 Expo 开发工作流及 EAS 云构建；iOS 真机分发需核实实际签名条件和会员成本。
- **SwiftUI**：通过 `@expo/ui` 渐进使用真实 SwiftUI 组件；预算图表等没有系统等价物的业务视图才使用自定义 React Native UI。

## 首版交付定义
可在个人 iPhone 上独立使用；离线可用；重启后数据保留；有备份与恢复能力；关键预算计算有测试覆盖。

## 工程质量
1. 预算核心逻辑使用纯函数或可预测状态转换。
2. 关键余额场景构建自动化测试，覆盖跨期/负数/调拨/重复结算/退款纠正。
3. 数据库操作有事务保证；结算提交是原子操作。
4. 明确 Schema 版本和升级迁移方案。
5. 不以 Web 预览代替原生验收；导航、布局、动态字体、深浅色和交互反馈必须在 iPhone 真机验证。
6. 备份要有可恢复性测试、格式版本与完整性校验。
7. 避免日志、分析、错误报告泄露个人财务细节。

## 当前工程范围（2026-10-16）
用户已授权工程初始化：按用户最新要求采用 Expo SDK 57、React Native 0.86、React 19.2、TypeScript、Expo Router 57 与 Expo UI。当前工程仅保留 iOS 真机开发及 iOS JavaScript 打包验证；Web/Android 预览入口与 VS Code Web 调试配置已移除。此前的 SDK 54 目标已由用户更正为 SDK 57。
`src/domain` 与 `src/data` 预留分层；本次不实现领域计算和数据库，Expo SQLite 在实现持久化时接入。
没有 CI/CD、环境密钥或服务器资源。iOS JS 打包不能替代 iPhone 真机验收。
