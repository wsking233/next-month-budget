import { describe, expect, it } from 'vitest';
import { createDemoLedger } from '@/fixtures/demo-ledger';
import { LocalStorageRepository, STORAGE_KEY, emptyWorkspace } from './repository';
export function fakeStorage(initial: string | null = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key: string, raw: string) => { value = raw; } };
}
describe('LocalStorageRepository', () => {
  it('首次读取空账本，保存后新实例可恢复完整快照', () => {
    const storage = fakeStorage(), repository = new LocalStorageRepository(() => storage);
    expect(repository.load().savedAt).toBeNull();
    const workspace = { ledger: createDemoLedger(), currentPeriod: 'oct' };
    repository.save(workspace);
    expect(new LocalStorageRepository(() => storage).load().workspace).toEqual(workspace);
    expect(JSON.parse(storage.getItem()!).format).toBe('next-month-budget');
    expect(STORAGE_KEY).toBe('next-month-budget:ledger');
  });
  it('写入配额失败保全原快照，读取权限错误明确报告', () => {
    const storage = fakeStorage(), repository = new LocalStorageRepository(() => storage);
    repository.load(); repository.save(emptyWorkspace());
    const original = storage.getItem();
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => repository.save({ ledger: createDemoLedger(), currentPeriod: 'oct' })).toThrow(/未保存/);
    expect(storage.getItem()).toBe(original);
    expect(() => new LocalStorageRepository(() => { throw new Error('SecurityError'); }).load()).toThrow(/无法读取/);
  });
  it('损坏数据不自动覆写，并阻止过期标签页覆盖其他修改', () => {
    const damaged = fakeStorage('{bad');
    const repository = new LocalStorageRepository(() => damaged);
    expect(() => repository.load()).toThrow(/JSON/);
    expect(damaged.getItem()).toBe('{bad');
    const storage = fakeStorage(), a = new LocalStorageRepository(() => storage), b = new LocalStorageRepository(() => storage);
    a.load(); b.load();
    a.save({ ledger: createDemoLedger(), currentPeriod: 'oct' });
    expect(() => b.save(emptyWorkspace())).toThrow(/其他页面/);
  });
});
