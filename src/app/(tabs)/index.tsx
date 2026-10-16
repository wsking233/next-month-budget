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

  return (
    <NativeScreen
      title="本期总览"
      description="数据目前只保存在内存，重启应用后会重置。"
      sections={[
        {
          title: '当前周期',
          value: latestPeriod ? `${latestPeriod.startsOn} — ${latestPeriod.endsOn}` : '尚未建立',
          description: latestPeriod ? `${ledger.pools.length} 个资金池` : '先建立预算周期，再创建资金池和拨款。',
        },
        {
          title: '预算可用总额',
          value: formatCents(available),
          description: '这是预算余额汇总，不代表银行账户可提现现金。',
        },
        {
          title: '待处理账单',
          value: `${pending} 项`,
          description: pending ? '存在已登记但尚未完成分配的账单。' : '当前没有待结算账单。',
        },
      ]}
      actions={latestPeriod ? [] : [{
        label: '建立第一个预算周期',
        systemImage: 'calendar.badge.plus',
        onPress: () => router.push('/period/new' as Href),
      }]}
    />
  );
}
