import { NativeScreen } from '@/ui/NativeScreen';

export default function HistoryScreen() {
  return (
    <NativeScreen
      title="操作记录"
      description="结算、拨款、调拨和更正会按时间集中呈现。"
      sections={[
        {
          title: '记录时间线',
          description: '这里会保留操作类型、影响周期和变更原因；已结算内容不会被静默覆盖。',
          status: '暂无记录',
        },
      ]}
    />
  );
}
