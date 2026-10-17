// UI-only fixtures. Never imported by domain or loaded automatically.
export type Period = { id: string; name: string; start: string; end: string };
export type Pool = { id: string; name: string; opening: number };
export type Allocation = { poolId: string; periodId: string; amount: number };
export type Statement = { id: string; account: string; reference: string; date: string; due: string; amount: number; allocations: Allocation[]; settled: boolean };
export type Activity = { id: string; kind: '拨款' | '结算' | '创建'; detail: string; date: string; amount?: number; poolId?: string; periodId?: string };
export type DemoState = { periods: Period[]; pools: Pool[]; statements: Statement[]; activities: Activity[]; currentPeriod: string };
export const emptyDemo = (): DemoState => ({ periods: [], pools: [], statements: [], activities: [], currentPeriod: '' });
export const sampleDemo = (): DemoState => ({
  periods: [{ id: 'oct', name: '十月预算', start: '2026-10-10', end: '2026-11-09' }, { id: 'nov', name: '十一月预算', start: '2026-11-10', end: '2026-12-09' }],
  currentPeriod: 'oct',
  pools: [{ id: 'daily', name: '日常生活', opening: 80000 }, { id: 'digital', name: '数码兴趣', opening: -200000 }, { id: 'travel', name: '远行与探索', opening: 150000 }],
  statements: [
    { id: 'a', account: '演示信用卡 A', reference: 'DEMO-2026-10-A', date: '2026-10-05', due: '2026-10-25', amount: 260000, allocations: [], settled: false },
    { id: 'b', account: '演示信用卡 B', reference: 'DEMO-2026-10-B', date: '2026-10-18', due: '2026-11-08', amount: 310000, allocations: [], settled: false },
  ],
  activities: [{ id: 'seed-1', kind: '拨款', detail: '日常生活 · 十月预算', date: '2026-10-10', amount: 350000, poolId: 'daily', periodId: 'oct' }, { id: 'seed-2', kind: '拨款', detail: '数码兴趣 · 十月预算', date: '2026-10-10', amount: 200000, poolId: 'digital', periodId: 'oct' }],
});
export const money = (cents: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100);
export function parseMoney(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 10000000000 ? cents : null;
}
export function poolBalance(state: DemoState, poolId: string) {
  return (state.pools.find(p => p.id === poolId)?.opening ?? 0)
    + state.activities.filter(a => a.kind === '拨款' && a.poolId === poolId).reduce((sum, a) => sum + (a.amount ?? 0), 0)
    - state.statements.filter(s => s.settled).flatMap(s => s.allocations).filter(a => a.poolId === poolId).reduce((sum, a) => sum + a.amount, 0);
}
