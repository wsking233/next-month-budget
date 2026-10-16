import { type Href, useRouter } from 'expo-router';

import { getPoolBalance } from '@/domain/budget';
import { formatCents, useBudget } from '@/state/BudgetContext';
import { NativeScreen } from '@/ui/NativeScreen';

export default function PoolsScreen() {
  const router = useRouter();
  const { ledger, latestPeriod } = useBudget();
  const sections = ledger.pools.length && latestPeriod
    ? ledger.pools.map((pool) => ({
        title: pool.name,
        value: formatCents(getPoolBalance(ledger, pool.id, latestPeriod.id)),
        description: '累计至当前周期的预算余额。',
        status: pool.active ? '使用中' : '已停用',
      }))
    : [{ title: '还没有资金池', description: '资金池用于承载分类预算；创建后仍需单独拨款。' }];

  return (
    <NativeScreen
      title="资金池"
      description="正余额和负余额都会跨期保留，不会自动从其他资金池补足。"
      sections={sections}
      actions={[
        {
          label: '新建资金池',
          systemImage: 'plus.circle',
          onPress: () => router.push('/pool/new' as Href),
        },
        {
          label: '预算拨款',
          systemImage: 'arrow.down.circle',
          disabled: !latestPeriod || ledger.pools.length === 0,
          onPress: () => router.push('/allocation/new' as Href),
        },
      ]}
    />
  );
}
