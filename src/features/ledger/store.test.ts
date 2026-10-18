import { describe, expect, it } from 'vitest';
import { createBudgetPeriod, createBudgetPool, allocateIncome } from '@/domain/budget';
import { createLedgerStore as makeStore } from './store';
import { LocalStorageRepository } from '@/storage/repository';
import { serializeSnapshot } from '@/storage/snapshot';
import { createDemoLedger } from '@/fixtures/demo-ledger';
function createLedgerStore() {
  let raw: string | null = null;
  return makeStore(new LocalStorageRepository(() => ({ getItem: () => raw, setItem: (_key, value) => { raw = value; } })));
}

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

describe('持久化事务与恢复保护', () => {
  function harness(initial: string | null = null) {
    let raw = initial, denyRead = false, denyWrite = false;
    const repository = new LocalStorageRepository(() => ({
      getItem: () => { if (denyRead) throw new Error('SecurityError'); return raw; },
      setItem: (_key, value) => { if (denyWrite) throw new Error('QuotaExceededError'); raw = value; },
    }));
    return { repository, raw: () => raw, denyRead: (value: boolean) => { denyRead = value; }, denyWrite: (value: boolean) => { denyWrite = value; } };
  }
  it('保存失败不会改变内存、审计或原始存储；释放空间后可重试', () => {
    const h = harness(), store = makeStore(h.repository);
    expect(store.getState().execute(l => createBudgetPool(l, { id: 'first', name: '原资金池' }))).toBeNull();
    const previous = store.getState().memory, raw = h.raw();
    h.denyWrite(true);
    expect(store.getState().execute(l => createBudgetPool(l, { id: 'next', name: '新资金池' }))).toContain('未保存');
    expect(store.getState().memory).toBe(previous);
    expect(h.raw()).toBe(raw);
    expect(store.getState().persistence.kind).toBe('error');
    h.denyWrite(false);
    expect(store.getState().execute(l => createBudgetPool(l, { id: 'next', name: '新资金池' }))).toBeNull();
    expect(makeStore(h.repository).getState().memory.ledger.pools).toHaveLength(2);
  });
  it('读取损坏或不兼容快照时暂停写入，显式恢复有效备份才替换原始数据', () => {
    const h = harness('{bad'), store = makeStore(h.repository);
    expect(store.getState().persistence.kind).toBe('blocked');
    expect(store.getState().execute(l => createBudgetPool(l, { id: 'no', name: '不应保存' }))).toContain('尚未安全读取');
    expect(h.raw()).toBe('{bad');
    expect(store.getState().restore('{bad-new')).toContain('JSON');
    expect(h.raw()).toBe('{bad');
    const valid = serializeSnapshot({ ledger: createDemoLedger(), currentPeriod: 'oct' }, true);
    expect(store.getState().restore(valid)).toBeNull();
    expect(store.getState().memory.ledger.pools).toHaveLength(3);
    expect(store.getState().persistence.kind).toBe('ready');
  });
  it('恢复与清空保存失败时均保留原账本，演示操作不触及本地存储', () => {
    const h = harness(), store = makeStore(h.repository);
    store.getState().execute(l => createBudgetPool(l, { id: 'mine', name: '用户数据' }));
    const original = store.getState().memory, raw = h.raw();
    h.denyWrite(true);
    expect(store.getState().restore(serializeSnapshot({ ledger: createDemoLedger(), currentPeriod: 'oct' }))).toContain('未保存');
    expect(store.getState().memory).toBe(original);
    expect(store.getState().reset()).toContain('未保存');
    expect(h.raw()).toBe(raw);
    store.getState().enterDemo();
    expect(store.getState().execute(l => createBudgetPool(l, { id: 'demo', name: '演示更改' }))).toBeNull();
    store.getState().reset();
    store.getState().exitDemo();
    expect(store.getState().memory).toBe(original);
    expect(h.raw()).toBe(raw);
  });
  it('读取权限恢复后可重新加载；外部变更暂停写入而非自动覆盖', () => {
    const h = harness();
    h.denyRead(true);
    const store = makeStore(h.repository);
    expect(store.getState().persistence.kind).toBe('blocked');
    h.denyRead(false);
    expect(store.getState().reload()).toBeNull();
    store.getState().execute(l => createBudgetPool(l, { id: 'saved', name: '已保存' }));
    store.getState().externalChange();
    expect(store.getState().execute(l => createBudgetPool(l, { id: 'blocked', name: '阻止覆盖' }))).toContain('尚未安全读取');
    expect(store.getState().reload()).toBeNull();
    expect(store.getState().memory.ledger.pools).toHaveLength(1);
  });
});

describe('独占编辑与恢复预览', () => {
  function harness() {
    let raw: string | null = null;
    const repository = new LocalStorageRepository(() => ({ getItem: () => raw, setItem: (_key, value) => { raw = value; } }));
    const store = makeStore(repository, true);
    return { store, raw: () => raw };
  }
  it('未取得编辑锁前不调用领域操作、不清空、不恢复，重新读取也不能绕过锁', () => {
    const { store, raw } = harness();
    let invoked = false;
    const saved = serializeSnapshot({ ledger: createDemoLedger(), currentPeriod: 'oct' });
    expect(store.getState().execute(l => { invoked = true; return l; })).toContain('其他标签页');
    expect(invoked).toBe(false);
    expect(store.getState().reset()).toContain('其他标签页');
    expect(store.getState().restore(saved)).toContain('其他标签页');
    expect(store.getState().reload()).toBeNull();
    expect(store.getState().writer).toBe('waiting');
    expect(raw()).toBeNull();
    store.setState({ writer: 'failed' });
    expect(store.getState().execute(l => l)).toContain('编辑锁');
    expect(raw()).toBeNull();
  });
  it('等待期间可操作独立演示；取得权限后才保存正式账本', () => {
    const { store, raw } = harness();
    store.getState().enterDemo();
    expect(store.getState().execute(l => createBudgetPool(l, { id: 'demo', name: '演示新池' }))).toBeNull();
    expect(raw()).toBeNull();
    store.getState().exitDemo();
    store.setState({ writer: 'available' });
    expect(store.getState().execute(l => createBudgetPool(l, { id: 'real', name: '正式新池' }))).toBeNull();
    expect(raw()).not.toBeNull();
    expect(store.getState().memory.ledger.pools.map(p => p.id)).toEqual(['real']);
  });
  it('旧恢复预览不能覆盖新账务，重新核对后可恢复', () => {
    const store = createLedgerStore();
    const initial = store.getState().memory.ledger;
    const backup = serializeSnapshot({ ledger: createDemoLedger(), currentPeriod: 'oct' });
    store.getState().execute(l => createBudgetPool(l, { id: 'new', name: '预览后新增' }));
    const updated = store.getState().memory;
    expect(store.getState().restore(backup, initial)).toContain('预览后账本已变化');
    expect(store.getState().memory).toBe(updated);
    expect(store.getState().restore(backup, updated.ledger)).toBeNull();
  });
  it('只读查看周期不写入本地，查看动作不改变账务内容', () => {
    const { store, raw } = harness();
    store.getState().enterDemo();
    const workspace = store.getState().demo;
    store.setState({ memory: workspace, mode: 'memory' });
    const period = workspace.ledger.periods.at(-1)!.id;
    store.getState().selectPeriod(period);
    expect(store.getState().memory.currentPeriod).toBe(period);
    expect(store.getState().memory.ledger).toBe(workspace.ledger);
    expect(raw()).toBeNull();
  });
});
