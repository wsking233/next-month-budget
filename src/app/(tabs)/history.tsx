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
  const { ledger, resetAll } = useBudget();
  const sections = ledger.audit.length
    ? ledger.audit.map((event, index) => ({
        title: `${index + 1}. ${auditNames[event.kind]}`,
        description: `对象：${event.subjectId}`,
        status: event.reason,
      }))
    : [{ title: '暂无记录', description: '周期、资金池、拨款和结算操作会依次出现在这里。' }];

  return (
    <NativeScreen
      title="操作记录"
      description="当前是内存原型；审计记录会在应用重启后重置。"
      sections={sections}
      actions={[{
        label: '清空全部内存数据',
        systemImage: 'trash',
        disabled: ledger.audit.length === 0,
        onPress: resetAll,
      }]}
    />
  );
}
