import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDemoLedger } from '@/fixtures/demo-ledger';
import { createBudgetPool } from '@/domain/budget';
import { BACKUP_STATUS_KEY, emptyBackupStatus, hashLedger, readBackupStatus, writeBackupStatus } from './backup-status';
const subtle = webcrypto.subtle as unknown as SubtleCrypto;
describe('备份提示偏好与账本摘要', () => {
  it('摘要忽略对象字段顺序，真实账务变更改变摘要，不暴露内容', async () => {
    const ledger = createDemoLedger();
    const digest = await hashLedger(ledger, subtle);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    const reordered = Object.fromEntries(Object.entries(ledger).reverse()) as typeof ledger;
    expect(await hashLedger(reordered, subtle)).toBe(digest);
    expect(await hashLedger(createBudgetPool(ledger, { id: 'new', name: '新增资金池' }), subtle)).not.toBe(digest);
    expect(ledger.pools).toHaveLength(3);
  });
  it('独立存储时间、摘要与开关，损坏或受限偏好安全回退', () => {
    let raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (key: string, value: string) => { expect(key).toBe(BACKUP_STATUS_KEY); raw = value; } };
    const status = { version: 1 as const, generatedAt: '2026-10-18T00:00:00.000Z', digest: 'a'.repeat(64), reminders: false };
    writeBackupStatus(status, storage);
    expect(readBackupStatus(storage)).toEqual(status);
    expect(raw).not.toContain('ledger');
    for (const invalid of ['{bad', '{}', '{"version":9}', JSON.stringify({ ...status, digest: 'not-a-hash' }), JSON.stringify({ ...status, generatedAt: null })]) {
      raw = invalid; expect(readBackupStatus(storage)).toEqual(emptyBackupStatus());
    }
    expect(readBackupStatus({ ...storage, getItem: () => { throw new Error('denied'); } })).toEqual(emptyBackupStatus());
    expect(() => writeBackupStatus(status, { ...storage, setItem: () => { throw new Error('quota'); } })).toThrow();
  });
});
