import { useEffect, useRef, useState } from 'react';
import type { BudgetLedger } from '@/domain/budget';
import { BACKUP_STATUS_KEY, emptyBackupStatus, hashLedger, readBackupStatus, writeBackupStatus, type BackupStatus } from '@/storage/backup-status';
export function useBackupStatus(ledger: BudgetLedger, enabled: boolean) {
  const [status, setStatus] = useState(() => { try { return readBackupStatus(); } catch { return emptyBackupStatus(); } });
  const current = useRef(status);
  const [comparison, setComparison] = useState<{ ledger: BudgetLedger; digest: string | null } | null>(null);
  const [warning, setWarning] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    hashLedger(ledger).then(digest => { if (!cancelled) setComparison({ ledger, digest }); }).catch(() => { if (!cancelled) setComparison({ ledger, digest: null }); });
    return () => { cancelled = true; };
  }, [ledger, enabled]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== BACKUP_STATUS_KEY && event.key !== null) return;
      try { current.current = readBackupStatus(); } catch { current.current = emptyBackupStatus(); }
      setStatus(current.current);
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  function remember(next: BackupStatus) {
    current.current = next; setStatus(next); setWarning('');
    try { writeBackupStatus(next); }
    catch { setWarning('备份提示状态仅在本页保留，未能保存偏好；账本与文件生成不受影响。'); }
  }
  async function generated(exportedLedger: BudgetLedger, generatedAt: string) {
    let digest: string | null = null;
    try { digest = await hashLedger(exportedLedger); } catch { /* Export still works without digest support. */ }
    remember({ ...current.current, generatedAt, digest });
  }
  const digest = comparison?.ledger === ledger ? comparison.digest : undefined;
  return { status, warning, generated, toggle: () => remember({ ...current.current, reminders: !current.current.reminders }), comparison: !enabled ? 'disabled' : !status.generatedAt ? 'never' : digest === undefined ? 'checking' : digest === null || status.digest === null ? 'unknown' : digest === status.digest ? 'unchanged' : 'changed' };
}
