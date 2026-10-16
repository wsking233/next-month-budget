import { formatCents, useBudget } from '@/state/BudgetContext';
import { NativeScreen } from '@/ui/NativeScreen';

export default function PoolsScreen() {
  const budget = useBudget();

  return (
    <NativeScreen
      title="资金池"
      description="创建资金池和拨款是两次明确操作；系统不会自动跨池挪用。"
      sections={[
        {
          title: '日常（演示）',
          value: formatCents(budget.dailyBalance),
          description: budget.hasPools ? '当前累计预算余额。' : '尚未创建。',
        },
        {
          title: '数码（演示）',
          value: formatCents(budget.digitalBalance),
          description: budget.hasPools ? '允许负余额并跨期保留。' : '尚未创建。',
        },
      ]}
      actions={[
        {
          label: '2. 创建两个演示资金池',
          systemImage: 'tray.2',
          disabled: !budget.hasPeriod || budget.hasPools,
          onPress: budget.createDemoPools,
        },
        {
          label: '3. 拨入演示预算',
          systemImage: 'plus.circle',
          disabled: !budget.hasPools || budget.hasAllocation,
          onPress: budget.allocateDemoBudget,
        },
      ]}
      error={budget.error}
    />
  );
}
