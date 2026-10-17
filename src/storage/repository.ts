import { createLedger } from '@/domain/budget';
import { parseSnapshot, serializeSnapshot, type Workspace } from './snapshot';
export const STORAGE_KEY = 'next-month-budget:ledger';
export const emptyWorkspace = (): Workspace => ({ ledger: createLedger(), currentPeriod: '' });
export interface LedgerRepository {
  load(): { workspace: Workspace; savedAt: string | null };
  save(workspace: Workspace): string;
  readRaw(): string | null;
}
export class LocalStorageRepository implements LedgerRepository {
  private expected: string | null | undefined;
  constructor(private readonly storage: () => Pick<Storage, 'getItem' | 'setItem'> = () => window.localStorage) {}
  readRaw(): string | null {
    try { return this.storage().getItem(STORAGE_KEY); }
    catch { throw new Error('无法读取浏览器存储。请检查浏览器权限或隐私模式；原数据未被覆盖。'); }
  }
  load() {
    const raw = this.readRaw();
    this.expected = raw;
    if (raw === null) return { workspace: emptyWorkspace(), savedAt: null };
    const snapshot = parseSnapshot(raw);
    return { workspace: snapshot.workspace, savedAt: snapshot.savedAt };
  }
  save(workspace: Workspace): string {
    const raw = serializeSnapshot(workspace);
    if (this.expected === undefined) throw new Error('尚未成功读取本地存储，请先重新读取；原数据未被覆盖。');
    if (this.readRaw() !== this.expected) throw new Error('本地账本已被其他页面更新。请重新读取后再操作，避免覆盖其他修改。');
    try { this.storage().setItem(STORAGE_KEY, raw); }
    catch { throw new Error('本次操作未保存：浏览器空间不足或拒绝存储。原账本已保留，请导出备份或释放空间后重试。'); }
    this.expected = raw;
    return JSON.parse(raw).savedAt as string;
  }
}
