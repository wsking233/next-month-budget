import { ChartNoAxesCombined, CircleDollarSign, History, LayoutDashboard, ReceiptText, Settings2 } from 'lucide-react';

export const pages = [
  { path: '/', title: '概览', subtitle: '给每一笔预算，一个清晰的去处。', description: '预算周期、资金池余额与待处理账单，将在这里一目了然。', icon: LayoutDashboard },
  { path: '/pools', title: '资金池', subtitle: '按自己的生活方式，安排预算。', description: '在这里管理资金池，查看预算余额与跨期结转。', icon: CircleDollarSign },
  { path: '/statements', title: '账单', subtitle: '账单集中处理，预算归属清晰。', description: '在这里登记信用卡账单，并按资金池和预算周期核对分配。', icon: ReceiptText },
  { path: '/plans', title: '预算计划', subtitle: '为下一期的生活，留好余地。', description: '在这里安排预算周期与拨款计划。', icon: ChartNoAxesCombined },
  { path: '/history', title: '历史记录', subtitle: '每一次预算变化，都有迹可循。', description: '在这里回看拨款、调拨、结算与更正记录。', icon: History },
  { path: '/settings', title: '设置', subtitle: '让预算工具，更适合你。', description: '周期偏好、数据备份与恢复，将在这里管理。', icon: Settings2 },
];
