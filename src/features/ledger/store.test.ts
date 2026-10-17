import { describe, expect, it } from 'vitest';
import { createBudgetPeriod, createBudgetPool, allocateIncome } from '@/domain/budget';
import { createLedgerStore } from './store';

describe('账本工作区', () => {
  it('失败操作保持 ledger 和审计对象不变，错误可显示', () => {
    const store = createLedgerStore();
    store.getState().execute(l => createBudgetPeriod(l, { id: 'p', startsOn: '2027-01-01', endsOn: '2027-01-31' }), 'p');
    store.getState().execute(l => createBudgetPool(l, { id: 'pool', name: '测试' }));
    const before = store.getState().memory;
    expect(store.getState().execute(l => allocateIncome(l, { id: 'x', periodId: 'p', poolId: 'missing', amount: 1 }))).toContain('不存在');
    expect(store.getState().memory).toBe(before);
  });
  it('演示与用户账本隔离，返回不丢用户账本，重载样例不影响用户', () => {
    const store = createLedgerStore();
    store.getState().execute(l => createBudgetPool(l, { id: 'mine', name: '我的资金池' }));
    const original = store.getState().memory;
    store.getState().enterDemo();
    expect(store.getState().mode).toBe('demo');
    store.getState().execute(l => createBudgetPool(l, { id: 'demo-new', name: '新样例' }));
    expect(store.getState().memory).toBe(original);
    store.getState().exitDemo();
    expect(store.getState().memory.ledger.pools).toHaveLength(1);
    store.getState().enterDemo();
    expect(store.getState().demo.ledger.pools).toHaveLength(3);
    store.getState().reset();
    expect(store.getState().memory).toBe(original);
    expect(createLedgerStore().getState().memory.ledger.pools).toHaveLength(0);
  });
});
