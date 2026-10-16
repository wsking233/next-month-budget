import { type Href, useRouter } from 'expo-router';

import { getPoolBalance } from '@/domain/budget';
import { formatCents, useBudget } from '@/state/BudgetContext';
import { NativeScreen } from '@/ui/NativeScreen';

export default function HomeScreen() {
  const router = useRouter();
  const { ledger, latestPeriod } = useBudget();
  const available = latestPeriod
    ? ledger.pools.reduce((sum, pool) => sum + getPoolBalance(ledger, pool.id, latestPeriod.id), 0)
    : 0;
  const pending = ledger.statements.filter((statement) => statement.status === 'recorded').length;
  const isReady = Boolean(latestPeriod && ledger.pools.length);

  return (
    <NativeScreen
      title="本期预算"
      description={latestPeriod ? `${latestPeriod.startsOn} — ${latestPeriod.endsOn}` : '先完成一次初始设置，之后只需回来查看和结算。'}
      sections={[
        {
          title: '可用预算',
          value: formatCents(available),
          description: latestPeriod ? `${ledger.pools.length} 个资金池，点击查看余额` : '尚未完成初始设置',
          status: '预算额度，不代表银行账户现金',
          systemImage: 'chart.pie.fill' as const,
          onPress: isReady ? () => router.push('/(tabs)/pools' as Href) : () => router.push('/settings' as Href),
        },
        {
          title: '账单状态',
          value: `${pending} 项`,
          description: pending ? '存在已登记但尚未完成分配的账单。' : '当前没有待结算账单。',
          systemImage: pending ? 'exclamationmark.circle.fill' as const : 'checkmark.circle.fill' as const,
          onPress: () => router.push('/(tabs)/settle' as Href),
        },
      ]}
      actions={[
        {
          label: '结算新账单',
          systemImage: 'creditcard.fill',
          prominent: true,
          disabled: !isReady,
          onPress: () => router.push('/statement/new' as Href),
        },
        {
          label: isReady ? '设置与管理' : '完成初始设置',
          systemImage: 'gearshape',
          onPress: () => router.push('/settings' as Href),
        },
      ]}
    />
  );
}
