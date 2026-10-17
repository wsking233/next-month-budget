import { describe, expect, it } from 'vitest';
import { createDemoLedger } from '@/fixtures/demo-ledger';
import { allocateIncome, cancelSettlement, correctSettlement, settleStatement, transferBudget } from './budget';
import { comparePeriods, forecastBudget, summarizePeriod } from './analytics';

function fixture() {
  let ledger = createDemoLedger();
  ledger = settleStatement(ledger, 'a', [{ id: 'a1', poolId: 'digital', periodId: 'oct', amount: 260000 }]);
  ledger = allocateIncome(ledger, { id: 'future', poolId: 'digital', periodId: 'nov', amount: 200000 });
  return ledger;
}
describe('统计与只读规划', () => {
  it('分项恒等式、负余额和调拨守恒；排除未来拨款', () => {
    const ledger = transferBudget(fixture(), { id: 't', periodId: 'oct', fromPoolId: 'daily', toPoolId: 'digital', amount: 10000, reason: '显式调拨' });
    const summary = summarizePeriod(ledger, 'oct');
    expect(summary.funding).toBe(550000);
    expect(summary.settled).toBe(260000);
    expect(summary.closing).toBe(290000);
    expect(summary.transferred).toBe(0);
    expect(summary.rows.find(r => r.poolId === 'digital')?.closing).toBe(-50000);
    for (const row of summary.rows) expect(row.closing).toBe(row.opening + row.funding - row.settled + row.transferred);
    expect(summarizePeriod(ledger, 'nov').opening).toBe(290000);
    expect(comparePeriods(ledger, 'oct')).toHaveLength(1);
  });
  it('历史更正与撤销更新图表及后续结转，不双重扣减', () => {
    const ledger = correctSettlement(fixture(), 'a', [{ id: 'new', poolId: 'travel', periodId: 'nov', amount: 260000 }], '调整周期');
    expect(summarizePeriod(ledger, 'oct').settled).toBe(0);
    expect(summarizePeriod(ledger, 'nov').settled).toBe(260000);
    const cancelled = cancelSettlement(ledger, 'a', '撤销');
    expect(summarizePeriod(cancelled, 'nov').settled).toBe(0);
    expect(summarizePeriod(cancelled, 'nov').closing).toBe(750000);
  });
  it('只读模拟支持未来已入账净变动，手工假设叠加且原账本不变', () => {
    const ledger = fixture(), before = structuredClone(ledger);
    const result = forecastBudget(ledger, 'oct', 2, [{ poolId: 'digital', grant: 10001, spend: 1 }], true);
    expect(result[0].rows.find(r => r.poolId === 'digital')?.closing).toBe(150000);
    expect(result[1].rows.find(r => r.poolId === 'digital')?.closing).toBe(160000);
    expect(forecastBudget(ledger, 'oct', 1, [], false)[0].rows.find(r => r.poolId === 'digital')?.closing).toBe(-60000);
    expect(ledger).toEqual(before);
  });
  it('无周期不生成虚假统计；零流水保持零，未来比较不越界', () => {
    const ledger = createDemoLedger();
    ledger.entries = [];
    expect(summarizePeriod(ledger, 'nov').closing).toBe(0);
    expect(comparePeriods(ledger, 'missing')).toEqual([]);
    expect(() => summarizePeriod(ledger, 'missing')).toThrow();
  });
  it('拒绝非法假设和溢出，保持原账本', () => {
    const ledger = fixture();
    expect(() => forecastBudget(ledger, 'oct', 7, [], true)).toThrow();
    expect(() => forecastBudget(ledger, 'oct', 1, [{ poolId: 'daily', grant: -1, spend: 0 }], true)).toThrow();
    expect(() => forecastBudget(ledger, 'oct', 1, [{ poolId: 'missing', grant: 0, spend: 0 }], true)).toThrow();
    const big = allocateIncome(createDemoLedger(), { id: 'max', poolId: 'travel', periodId: 'nov', amount: Number.MAX_SAFE_INTEGER - 550000 });
    expect(() => forecastBudget(big, 'nov', 1, [{ poolId: 'travel', grant: 1, spend: 0 }], true)).toThrow(/安全/);
  });
});
