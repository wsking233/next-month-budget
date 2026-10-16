import { NativeScreen } from '@/ui/NativeScreen';

export default function PoolsScreen() {
  return (
    <NativeScreen
      title="资金池"
      description="集中查看每个资金池的余额、拨款与结转状态。"
      sections={[
        {
          title: '资金池列表',
          description: '以后会在这里创建、排序、编辑和停用资金池。',
          status: '空',
        },
        {
          title: '显式调拨',
          description: '资金池之间的转移会作为独立操作呈现，并保留原因与记录。',
        },
      ]}
    />
  );
}
