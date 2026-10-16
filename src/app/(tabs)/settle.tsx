import { type Href, useRouter } from 'expo-router';

import { formatCents, useBudget } from '@/state/BudgetContext';
import { NativeScreen } from '@/ui/NativeScreen';

export default function SettleScreen() {
  const router = useRouter();
  const { ledger } = useBudget();
  const sections = ledger.statements.length
    ? ledger.statements.map((statement) => ({
        title: statement.accountId,
        value: formatCents(statement.amount),
        description: `到期日 ${statement.dueOn} · ${statement.allocations.length} 条预算分配`,
        status: statement.status === 'settled' ? '已结算预算' : statement.status === 'cancelled' ? '已取消' : '待完成',
      }))
    : [{ title: '暂无账单', description: '新建账单时需要一次完成总额与资金池分配核对。' }];

  return (
    <NativeScreen
      title="账单结算"
      description="结算扣减消费预算；实际还信用卡不会再次扣减预算。"
      sections={sections}
      actions={[{
        label: '新建并结算账单',
        systemImage: 'doc.badge.plus',
        disabled: ledger.periods.length === 0 || ledger.pools.length === 0,
        onPress: () => router.push('/statement/new' as Href),
      }]}
    />
  );
}
