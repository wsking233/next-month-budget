import { NativeScreen } from '@/ui/NativeScreen';

export default function AboutScreen() {
  return (
    <NativeScreen
      title="下月再说"
      description="想花就花，有数就行。"
      sections={[
        {
          title: '这是什么',
          description: '一款离线优先、移动端优先的个人预算资金池工具。它关注每期预算与集中结算，不要求逐笔记账。',
        },
        {
          title: '当前阶段',
          description: '基础页面与导航已建立，业务规则、预算计算和本地存储仍在逐步验证与实现。',
          status: '开发中',
        },
      ]}
    />
  );
}
