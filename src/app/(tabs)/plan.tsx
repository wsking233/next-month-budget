import { NativeScreen } from '@/ui/NativeScreen';

export default function PlanScreen() {
  return (
    <NativeScreen
      title="未来计划"
      description="查看未来各期预算，以及负余额预计何时被后续拨款抵扣。"
      sections={[
        {
          title: '周期时间线',
          description: '各预算周期的计划收入、拨款和计划储蓄将在这里展开。',
          status: '未生成',
        },
        {
          title: '余额预测',
          description: '预测只展示预算变化，不会将预算额度描述成真实现金资产。',
        },
      ]}
    />
  );
}
