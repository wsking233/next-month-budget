# Phase 6 质量与兼容验收

版本：0.6.0。发布方式仍是 main → GitHub Actions → Pages，无后端。

## 变更

- Playwright 增加 Chromium、Firefox、WebKit 项目；单浏览器命令保持轻量，全量命令和 CI 验证三种引擎。CI 禁止 test.only、保留失败截图/trace/HTML 报告，失败时不部署。
- axe-core 检查六页在 375 / 1440px、深浅主题下的 WCAG A/AA 自动规则，以及弹窗内容。修复浅色辅助文字对比度（原 4.34:1 不足）、首页品牌的可见文字/可访问名称不一致。
- 弹窗显式处理 Tab/Shift+Tab 首尾循环；关闭后返回触发元素，元素已移除时返回主内容。Escape 和取消不提交账务。
- 修复 Firefox 320px 传统滚动条和长名称导致的横向溢出；支持触摸入口，保留可见焦点与减少动效偏好。
- 资金池维护补齐边界：无流水可直接停用；已有流水时仍须余额清零，未来有效分配及非零净变动须处理，已冲销归零的历史保留而不阻止停用。
- 截图输出按浏览器/测试/重试隔离，避免多浏览器覆盖证据；页脚显示版本。

## 实际验证结果

- `npm run check`：ESLint、TypeScript、60 项领域/存储/统计/界面测试及生产构建通过。
- Chromium + Firefox 全量运行 46 项通过；WebKit 同一最终构建全量运行 23 项通过，合计 69 项，无跳过测试。
- 每种引擎均覆盖六页的深浅主题与手机/桌面 WCAG 自动规则、弹窗审计、焦点、窄屏及完整账务/备份/规划回归。修复了审计和 Firefox 测试实际暴露的问题，没有屏蔽失败规则。
- 本地浏览器测试在 Vite 生产构建预览运行；没有访问 GitHub Actions 状态 API，线上发布由 main 推送触发。

## 运行验收

```bash
npm ci
npm run check
npx playwright install --with-deps chromium firefox webkit
npm run test:browser       # Chromium
npm run test:browser:all   # 三浏览器
```

用系统 Chromium 时可为命令设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。首次安装系统依赖需环境本身支持包管理；本次受限云环境为 WebKit 使用用户目录公开 Debian 运行库，实际启动引擎后运行相同测试。用户目录库不在仓库内，CI 使用正常的 --with-deps，不依赖本地路径；本地仅因 ldconfig 无法登记用户库而略过其系统缓存预检。

## 验收矩阵与范围

- Chromium 154、Playwright Firefox 157、WebKit 27.2 引擎；Linux 生产预览构建。
- 六页导航、Hash 深层刷新、404 返回、375 / 768 / 1440px、320px 长文本、深浅主题。
- 从空账本建立周期/资金池、拨款、负结转、跨期分配、更正、撤销、重新结算、调拨、停用及审计。
- 本地恢复、关页重开、JSON 下载/校验/确认覆盖/取消、配额失败、损坏与未知版本、其他标签页更新保护。
- 统计与领域账本一致、负数趋势、只读模拟不写入存储、无效输入保留。
- 键盘跳转、焦点循环、Escape、触摸及自动无障碍规则。

Firefox 不支持 Playwright 触摸仿真，本项目该引擎窄屏测试使用鼠标；Chromium/WebKit 使用触摸仿真。视口和引擎测试不等于实体手机或所有 Safari 版本测试，自动 WCAG 规则也不是完整人工认证。

## 交付文件

quality.spec.ts、各浏览器测试证据路径、playwright.config.ts、工作流、依赖与锁文件；AppLayout、UI 弹窗、CSS、领域停用及测试；README、AGENTS、CHANGELOG、业务规则、PRD、决策、路线图及本交付说明。

## 手动发布核对

1. Pages 页脚为版本 0.6.0，三个宽度下六页可达，Hash 子页面刷新正常。
2. 在独立演示验证负预算、结算和只读模拟；返回本地账本确认数据不混入。
3. 操作本地账本后刷新，导出并恢复备份；只在确认后覆盖。先保存外部备份再测试清空。
4. 键盘 Tab 进入弹窗，首尾循环、Escape 返回；手机触摸及长名称无横向溢出。

## 余项边界

路线图六阶段已交付。未定案的收入拨款策略、现金/储蓄核对、还款、退款分期、提醒及 PWA 不包含在本次发布，不引入登录、云同步或银行 API。账本仍只存在当前浏览器；JSON 未加密，需定期备份。仅推送版本触发发布，按用户要求不查询 Actions 状态接口。
