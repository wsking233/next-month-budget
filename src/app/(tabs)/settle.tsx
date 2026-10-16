import { useBudget } from '@/state/BudgetContext';
import { NativeScreen } from '@/ui/NativeScreen';

export default function SettleScreen() {
  const budget = useBudget();

  return (
    <NativeScreen
      title="账单结算"
      description="账单总额与预算分配严格核对；还信用卡不会再次扣减消费预算。"
      sections={[
        {
          title: '演示账单',
          value: '¥6,200.00',
          description: '脱敏演示：日常 ¥2,800.00，数码 ¥3,400.00。',
          status: budget.isSettled ? '已结算' : budget.hasStatement ? '待结算' : '未登记',
        },
      ]}
      actions={[
        {
          label: '4. 登记演示账单',
          systemImage: 'doc.badge.plus',
          disabled: !budget.hasAllocation || budget.hasStatement,
          onPress: budget.recordDemoStatement,
        },
        {
          label: '5. 核对并结算',
          systemImage: 'checkmark.circle',
          disabled: !budget.hasStatement || budget.isSettled,
          onPress: budget.settleDemoStatement,
        },
      ]}
      error={budget.error}
    />
  );
}
