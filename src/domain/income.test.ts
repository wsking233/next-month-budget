import { describe, expect, it } from 'vitest';
import { createDemoLedger } from '@/fixtures/demo-ledger';
import { getPoolBalance, settleStatement } from './budget';
import { applyIncome, cancelIncome, saveBudgetTemplate } from './income';
import { summarizePeriod } from './analytics';
import { parseSnapshot, serializeSnapshot } from '@/storage/snapshot';
const input = () => ({ id: 'salary', periodId: 'oct', reference: '十月工资', receivedOn: '2026-10-10', amount: 100000, plannedSavings: 30000, allocations: [{ poolId: 'daily', amount: 50000 }] });
describe('固定预算与收入', () => {
  it('模板编辑不影响流水，收入多笔独立应用且守恒', () => {
    const before = createDemoLedger();
    const template = saveBudgetTemplate(before, { allocations: [{ poolId: 'daily', amount: 50000 }], plannedSavings: 30000 });
    expect(template.entries).toEqual(before.entries);
    const next = applyIncome(template, input());
    expect(next.planning?.incomes[0].amount).toBe(100000);
    expect(getPoolBalance(next, 'daily', 'oct')).toBe(400000);
    expect(getPoolBalance(before, 'daily', 'oct')).toBe(350000);
    const bonus = applyIncome(next, { ...input(), id: 'bonus', reference: '奖金', amount: 1000, plannedSavings: 0, allocations: [] });
    expect(bonus.planning?.incomes).toHaveLength(2);
    expect(parseSnapshot(serializeSnapshot({ ledger: bonus, currentPeriod: 'oct' })).workspace.ledger).toEqual(bonus);
  });
  it('收入不足、重复标识、无效日期及停用池失败不产生部分流水', () => {
    const before = createDemoLedger();
    const raw = JSON.stringify(before);
    expect(() => applyIncome(before, { ...input(), amount: 79999 })).toThrow(/收入不足/);
    expect(() => applyIncome(before, { ...input(), allocations: [{ poolId: 'daily', amount: 1 }, { poolId: 'missing', amount: 1 }] })).toThrow();
    expect(() => applyIncome(before, { ...input(), receivedOn: '2026-02-30' })).toThrow();
    expect(JSON.stringify(before)).toBe(raw);
    const next = applyIncome(before, input());
    expect(() => applyIncome(next, { ...input(), id: 'other', reference: ' 十月工资 ' })).toThrow(/重复/);
    expect(() => applyIncome(next, { ...input(), reference: '其他' })).toThrow(/已使用/);
    const inactive = { ...before, pools: before.pools.map(p => ({ ...p, active: false })) };
    expect(() => saveBudgetTemplate(inactive, { allocations: input().allocations, plannedSavings: 0 })).toThrow(/停用/);
  });
  it('未来拨款隔离；撤销追加冲销，不抹去支出，负余额跨期保留', () => {
    const before = createDemoLedger();
    let next = applyIncome(before, { ...input(), periodId: 'nov', allocations: [{ poolId: 'travel', amount: 50000 }] });
    expect(getPoolBalance(next, 'travel', 'oct')).toBe(0);
    next = settleStatement(next, 'a', [{ id: 'x', poolId: 'travel', periodId: 'nov', amount: 260000 }]);
    const cancelled = cancelIncome(next, 'salary', '收入录错');
    expect(getPoolBalance(cancelled, 'travel', 'nov')).toBe(-260000);
    expect(cancelled.entries.slice(0, next.entries.length)).toEqual(next.entries);
    expect(summarizePeriod(cancelled, 'nov').funding).toBe(0);
    expect(() => cancelIncome(cancelled, 'salary', '重复')).toThrow(/已经撤销/);
    expect(() => applyIncome(cancelled, { ...input(), id: 'retry', periodId: 'nov' })).toThrow(/重复/);
    expect(parseSnapshot(serializeSnapshot({ ledger: cancelled, currentPeriod: 'nov' })).workspace.ledger).toEqual(cancelled);
  });
  it('整数分边界与累计溢出受保护', () => {
    const before = createDemoLedger();
    expect(() => applyIncome(before, { ...input(), amount: 1.1 })).toThrow();
    expect(() => applyIncome(before, { ...input(), plannedSavings: Number.MAX_SAFE_INTEGER, allocations: [{ poolId: 'daily', amount: 1 }] })).toThrow();
    const next = applyIncome(before, { ...input(), amount: Number.MAX_SAFE_INTEGER, plannedSavings: 0, allocations: [] });
    expect(() => applyIncome(next, { ...input(), id: 'extra', reference: 'extra', amount: 1, plannedSavings: 0, allocations: [] })).toThrow(/安全范围/);
  });
  it('恢复拒绝收入缺失、错拨款、重复冲销及审计损坏', () => {
    const ledger = cancelIncome(applyIncome(createDemoLedger(), input()), 'salary', '更正');
    const raw = serializeSnapshot({ ledger, currentPeriod: 'oct' });
    for (const mutate of [
      (s: typeof ledger) => { s.planning!.incomes[0].amount = 1; },
      (s: typeof ledger) => { s.planning!.incomes[0].allocations[0].amount++; },
      (s: typeof ledger) => { s.planning!.incomes = []; },
      (s: typeof ledger) => { s.entries.pop(); },
      (s: typeof ledger) => { s.planning!.incomes[0].status = 'applied'; },
      (s: typeof ledger) => { s.planning!.incomes[0].cancellationReason = '错原因'; },
    ]) {
      const snapshot = JSON.parse(raw); mutate(snapshot.workspace.ledger);
      expect(() => parseSnapshot(JSON.stringify(snapshot))).toThrow();
    }
  });
});
