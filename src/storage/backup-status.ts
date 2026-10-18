import type { BudgetLedger } from '@/domain/budget';
export const BACKUP_STATUS_KEY = 'next-month-budget:backup-status';
export type BackupStatus = { version: 1; generatedAt: string | null; digest: string | null; reminders: boolean };
export const emptyBackupStatus = (): BackupStatus => ({ version: 1, generatedAt: null, digest: null, reminders: true });
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function readBackupStatus(storage: PreferenceStorage = window.localStorage): BackupStatus {
  try {
    const value = JSON.parse(storage.getItem(BACKUP_STATUS_KEY) ?? 'null');
    if (!value || value.version !== 1 || typeof value.reminders !== 'boolean' || (value.digest !== null && (typeof value.digest !== 'string' || !/^[a-f0-9]{64}$/.test(value.digest))) || (value.generatedAt !== null && (typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt)))) || (!value.generatedAt && value.digest)) return emptyBackupStatus();
    return { version: 1, generatedAt: value.generatedAt, digest: value.digest, reminders: value.reminders };
  } catch { return emptyBackupStatus(); }
}
export function writeBackupStatus(status: BackupStatus, storage: PreferenceStorage = window.localStorage) { storage.setItem(BACKUP_STATUS_KEY, JSON.stringify(status)); }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
// Only ledger content matters. Selected period, theme and snapshot timestamps are excluded.
export async function hashLedger(ledger: BudgetLedger, subtle: SubtleCrypto = crypto.subtle): Promise<string> {
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(ledger))));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
