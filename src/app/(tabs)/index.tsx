import { NativeScreen } from '@/ui/NativeScreen';

export default function HomeScreen() {
  return (
    <NativeScreen
      title="本期总览"
      description="预算、待处理事项和下一个关键日期会集中在这里。"
      sections={[
        {
          title: '可用预算',
          value: '尚未设置',
          description: '完成基础设置后显示本期汇总。',
        },
        {
          title: '资金池概览',
          description: '快速查看正余额、负余额和本期拨款状态。',
          status: '待设置',
        },
        {
          title: '待处理账单',
          description: '需要分类、确认或临近还款日的账单会出现在这里。',
          status: '0 项',
        },
      ]}
    />
  );
}
