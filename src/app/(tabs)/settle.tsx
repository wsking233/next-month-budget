import { NativeScreen } from '@/ui/NativeScreen';

export default function SettleScreen() {
  return (
    <NativeScreen
      title="账单结算"
      description="登记账单总额，再按资金池完成分类结算。"
      sections={[
        {
          title: '新建结算',
          description: '录入信用卡、账单日期、还款日期和预算归属周期。',
          status: '尚未开始',
        },
        {
          title: '待完成',
          description: '未分配、有差额或尚未确认的账单会保留在这里，不会提前扣减预算。',
          status: '0 项',
        },
      ]}
    />
  );
}
