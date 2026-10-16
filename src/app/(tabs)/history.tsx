import { useBudget } from '@/state/BudgetContext';
import { NativeScreen } from '@/ui/NativeScreen';

const auditNames = {
  period_created: '建立预算周期',
  pool_created: '创建资金池',
  income_allocated: '预算拨款',
  statement_recorded: '登记账单',
  statement_settled: '确认结算',
  budget_transferred: '资金池调拨',
  settlement_cancelled: '取消结算',
  settlement_corrected: '更正结算',
} as const;

export default function HistoryScreen() {
  const budget = useBudget();
  const sections = budget.ledger.audit.length
    ? budget.ledger.audit.map((event, index) => ({
        title: `${index + 1}. ${auditNames[event.kind]}`,
        description: `对象：${event.subjectId}`,
        status: event.reason,
      }))
    : [{ title: '记录时间线', description: '完成演示操作后，这里会显示不可静默覆盖的审计记录。', status: '暂无记录' }];

  return (
    <NativeScreen
      title="操作记录"
      description="每次拨款、登记和结算都留下独立记录。"
      sections={sections}
      actions={[{
        label: '重置全部演示数据',
        systemImage: 'arrow.counterclockwise',
        disabled: budget.ledger.audit.length === 0,
        onPress: budget.resetDemo,
      }]}
      error={budget.error}
    />
  );
}
