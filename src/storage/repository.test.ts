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

it('旧版本只在成功保存后升级；迁移后配额失败保全原文件', async () => {
  const { serializeSnapshot } = await import('./snapshot');
  const workspace = { ledger: createDemoLedger(), currentPeriod: 'oct' };
  const legacy = JSON.parse(serializeSnapshot(workspace)); legacy.schemaVersion = 1;
  const raw = JSON.stringify(legacy), storage = fakeStorage(raw);
  const repository = new LocalStorageRepository(() => storage);
  expect(repository.load().workspace).toEqual(workspace);
  expect(storage.getItem()).toBe(raw);
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('quota'); };
  expect(() => repository.save(workspace)).toThrow(/未保存/);
  expect(storage.getItem()).toBe(raw);
  storage.setItem = write;
  repository.save(workspace);
  expect(JSON.parse(storage.getItem()!).schemaVersion).toBe(3);
});
