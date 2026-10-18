import { getPoolBalance, type BudgetLedger } from './budget';

export function exactSum(values: number[]): number {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('汇总或模拟金额超出安全范围，请减少模拟额度。');
  return Number(total);
}
export function summarizePeriod(ledger: BudgetLedger, periodId: string) {
  const index = ledger.periods.findIndex(p => p.id === periodId);
  if (index < 0) throw new Error('请先选择有效预算周期。');
  const period = ledger.periods[index];
  const rows = ledger.pools.map(pool => {
    const entries = ledger.entries.filter(e => e.periodId === periodId && e.poolId === pool.id);
    const opening = index > 0 ? getPoolBalance(ledger, pool.id, ledger.periods[index - 1].id) : 0;
    const closing = getPoolBalance(ledger, pool.id, periodId);
    const funding = exactSum(entries.filter(e => (e.kind === 'income_allocation' || e.kind === 'income_reversal')).map(e => e.amount));
    const settled = -exactSum(entries.filter(e => e.kind === 'statement_settlement' || e.kind === 'reversal').map(e => e.amount));
    const transferred = exactSum(entries.filter(e => e.kind === 'transfer_in' || e.kind === 'transfer_out').map(e => e.amount));
    return { poolId: pool.id, name: pool.name, active: pool.active, opening, closing, funding, settled, transferred };
  });
  const sum = (field: 'opening' | 'closing' | 'funding' | 'settled' | 'transferred') => exactSum(rows.map(row => row[field]));
  return { period, rows, opening: sum('opening'), closing: sum('closing'), funding: sum('funding'), settled: sum('settled'), transferred: sum('transferred') };
}
export type PeriodSummary = ReturnType<typeof summarizePeriod>;
export function comparePeriods(ledger: BudgetLedger, throughPeriodId: string, limit = 6) {
  const index = ledger.periods.findIndex(p => p.id === throughPeriodId);
  if (index < 0) return [];
  return ledger.periods.slice(Math.max(0, index - limit + 1), index + 1).map(p => summarizePeriod(ledger, p.id));
}
export type Assumption = { poolId: string; grant: number; spend: number };
export function forecastBudget(ledger: BudgetLedger, fromPeriodId: string, count: number, assumptions: Assumption[], includeScheduled: boolean) {
  const index = ledger.periods.findIndex(p => p.id === fromPeriodId);
  if (index < 0 || !Number.isInteger(count) || count < 1 || count > 6) throw new Error('请选择起始周期和 1 至 6 个模拟周期。');
  const ids = new Set<string>();
  for (const a of assumptions) {
    if (ids.has(a.poolId) || !ledger.pools.some(p => p.id === a.poolId && p.active)) throw new Error('模拟资金池无效或重复。');
    ids.add(a.poolId);
    if (![a.grant, a.spend].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 10000000000)) throw new Error('模拟金额须为非负整数分，单项最多一亿元。');
  }
  const balances = new Map(ledger.pools.map(p => [p.id, getPoolBalance(ledger, p.id, fromPeriodId)]));
  return Array.from({ length: count }, (_, offset) => {
    const scheduledPeriod = ledger.periods[index + offset + 1];
    const rows = ledger.pools.map(pool => {
      const assumption = assumptions.find(a => a.poolId === pool.id);
      const opening = balances.get(pool.id)!;
      const scheduled = includeScheduled && scheduledPeriod ? exactSum(ledger.entries.filter(e => e.poolId === pool.id && e.periodId === scheduledPeriod.id).map(e => e.amount)) : 0;
      const grant = assumption?.grant ?? 0, spend = assumption?.spend ?? 0;
      const closing = exactSum([opening, scheduled, grant, -spend]);
      balances.set(pool.id, closing);
      return { poolId: pool.id, name: pool.name, opening, scheduled, grant, spend, closing };
    });
    return { label: scheduledPeriod ? scheduledPeriod.name || scheduledPeriod.startsOn : `模拟第 ${offset + 1} 期（未建周期）`, rows, total: exactSum(rows.map(row => row.closing)) };
  });
}
