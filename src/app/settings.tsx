import { NativeScreen } from '@/ui/NativeScreen';

export default function SettingsScreen() {
  return (
    <NativeScreen
      title="偏好设置"
      description="集中管理预算周期与显示偏好。"
      sections={[
        {
          title: '预算周期',
          description: '周期起始规则仍待确认，本轮仅保留设置入口。',
          status: '待设置',
        },
        {
          title: '显示与格式',
          description: '币种、金额格式和提醒偏好将按需添加。',
        },
      ]}
    />
  );
}
