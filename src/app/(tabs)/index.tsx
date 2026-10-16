import { useBudget } from '@/state/BudgetContext';
import { NativeScreen } from '@/ui/NativeScreen';

export default function HomeScreen() {
  const budget = useBudget();
  const completed = [budget.hasPeriod, budget.hasPools, budget.hasAllocation, budget.hasStatement, budget.isSettled].filter(Boolean).length;

  return (
    <NativeScreen
      title="本期总览"
      description="当前是仅存于内存的脱敏演示；退出应用后不会保存，也不代表你的真实预算。"
      sections={[
        {
          title: '最短闭环',
          value: `${completed} / 5`,
          description: budget.isSettled ? '演示闭环已经完成，可在资金池和记录页核对结果。' : '请按页面顺序完成周期、资金池、拨款、账单登记和结算。',
        },
        {
          title: '数据边界',
          description: '当前没有 SQLite、账号、卡号或真实财务数据；刷新或重启会重置。',
          status: '内存演示',
        },
      ]}
      actions={[{
        label: '1. 建立脱敏演示周期',
        systemImage: 'calendar.badge.plus',
        disabled: budget.hasPeriod,
        onPress: budget.createDemoPeriod,
      }]}
      error={budget.error}
    />
  );
}
