import { type Href, useRouter } from 'expo-router';

import { useBudget } from '@/state/BudgetContext';
import { NativeScreen } from '@/ui/NativeScreen';

export default function PlanScreen() {
  const router = useRouter();
  const { ledger } = useBudget();
  const sections = ledger.periods.length
    ? ledger.periods.map((period, index) => ({
        title: `预算周期 ${index + 1}`,
        value: `${period.startsOn} — ${period.endsOn}`,
        description: '余额从上一周期连续结转；本周期拨款会生成独立流水。',
        status: index === ledger.periods.length - 1 ? '当前使用周期' : '历史周期',
      }))
    : [{ title: '尚无预算周期', description: '周期可以不是自然月，但彼此不能重叠。' }];

  return (
    <NativeScreen
      title="预算周期"
      description="低频设置页面。建立周期后，再到资金池管理中拨款。"
      sections={sections}
      actions={[{
        label: '新建预算周期',
        systemImage: 'calendar.badge.plus',
        onPress: () => router.push('/period/new' as Href),
      }]}
    />
  );
}
