import { type Href, useRouter } from 'expo-router';

import { useBudget } from '@/state/BudgetContext';
import { NativeScreen } from '@/ui/NativeScreen';

export default function SettingsScreen() {
  const router = useRouter();
  const { ledger, latestPeriod } = useBudget();

  return (
    <NativeScreen
      title="设置与管理"
      description="这些项目通常只需偶尔调整，不占用日常导航。"
      sections={[
        {
          title: '预算周期',
          description: latestPeriod ? `${latestPeriod.startsOn} — ${latestPeriod.endsOn}` : '尚未建立预算周期',
          status: `${ledger.periods.length} 个周期`,
          systemImage: 'calendar',
          onPress: () => router.push('/(tabs)/plan' as Href),
        },
        {
          title: '资金池与拨款',
          description: '管理分类预算、创建资金池和本期拨款。',
          status: `${ledger.pools.length} 个资金池`,
          systemImage: 'wallet.bifold.fill',
          onPress: () => router.push('/(tabs)/pools' as Href),
        },
        {
          title: '操作记录',
          description: '查看拨款、结算、调拨与更正的审计时间线。',
          status: `${ledger.audit.length} 条记录`,
          systemImage: 'clock.arrow.circlepath',
          onPress: () => router.push('/(tabs)/history' as Href),
        },
      ]}
      actions={[
        { label: '备份与恢复', systemImage: 'externaldrive', onPress: () => router.push('/backup' as Href) },
        { label: '关于下月再说', systemImage: 'info.circle', onPress: () => router.push('/about' as Href) },
      ]}
    />
  );
}
