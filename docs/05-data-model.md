# 概念数据模型（不包含代码）

## 主要实体
| 实体 | 示例字段/作用 |
| --- | --- |
| BudgetPeriod | 唯一周期ID、开始/结束时间、状态、计划/实际收入 |
| BudgetPool | 唯一ID、名称、状态、显示顺序、期常规拨款规则 |
| BudgetEntry | 流水ID、池ID、周期ID、类型、金额（分）、关联来源、创建时间 |
| PaymentAccount | 账户ID、名称、类型（信用卡/借记卡/现金）、币种 |
| CreditCardProfile | 账户ID、账单日/还款规则、用户备注 |
| Statement | 账单ID、账户ID、账期、账单总额、到期日、状态、去重标识 |
| Allocation | 分配ID、账单ID、资金池ID、预算周期ID、金额（分） |
| Repayment | 还款记录ID、账单ID、金额、实际还款日期、支付来源 |
| BudgetTransfer | 调拨ID、来源池、目标池、金额、周期、原因 |
| IncomeRecord | 收入ID、所属预算周期、实际金额、收到时间 |
| BackupMetadata | 导出时间、Schema版本、校验信息 |

## 数据关系
- 每个 Statement 有多个 Allocation；分配的金额总和要经过严格核对。
- 每个 Pool 有多条 BudgetEntry；余额通过流水和周期规则计算，不能作为唯一事实源。
- Repayment 与 Statement 关联，不直接改变消费预算。
- Transfer 应是原子操作，同时生成配对出入流水。
- 所有关键修改保留审计信息和撤销/更正关联。

## 设计原则
- 数据存储金额使用整数“分”；本期优先人民币，未来多币种必须明确汇率策略。
- 定义明确、稳定的ID，避免用日期+展示名称做主键。
- 核心业务规则与存储、UI 解耦，便于测试和平台迁移。
- 数据迁移与备份格式需版本化。
- 不在仓库内提交真实工资、银行账单、卡号和个人财务数据。

## 尚未定案
这只是领域概念模型，不是最终SQL表结构。是否引入事件溯源、物化余额缓存等，待原型验证及性能需求明确后决定。
## Phase 3 内存实现补充

`src/domain/budget.ts` 的 BudgetLedger 持有 periods、pools、statements、entries、audit。BudgetPeriod 可带显示名称；Statement 带账单日、账户名称标识和账户内去重标识。AuditEvent 保留操作时间、主体 ID、当时资料描述及原因，描述包含结算/更正的分配明细。

余额来自按周期累计的 BudgetEntry，而非 UI 状态缓存；调拨为成对流水，更正和撤销为追加冲销流水。Zustand 分别持有用户与演示两份内存工作区及所选周期。当前没有持久化 schema、账号、云数据库或还款实体实现；其他概念实体继续按后续阶段推进。
