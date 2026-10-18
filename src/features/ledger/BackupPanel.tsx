import type { BudgetLedger } from '@/domain/budget';
import { useBackupStatus } from './useBackupStatus';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { MAX_BACKUP_BYTES, parseSnapshot, serializeSnapshot, type Snapshot } from '@/storage/snapshot';
import { useLedger } from './context';
import { Field, Input, Modal, Panel } from './ui';

function download(raw: string, name: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BackupPanel() {
  const { ledger, currentPeriod, mode, persistence, restore, reload, readStoredRaw } = useLedger();
  const [candidate, setCandidate] = useState<{ raw: string; snapshot: Snapshot; name: string; baseLedger: BudgetLedger } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const request = useRef(0);
  const local = mode === 'memory';
  const backup = useBackupStatus(ledger, local && persistence.readable);
  const [exporting, setExporting] = useState(false);
  const exportBackup = async () => {
    setExporting(true);
    setError(''); setMessage('');
    try {
      const raw = serializeSnapshot({ ledger, currentPeriod }, true);
      download(raw, `next-month-budget-${new Date().toISOString().slice(0, 10)}.json`);
      await backup.generated(ledger, JSON.parse(raw).exportedAt);
      setMessage('备份文件已生成，请确认浏览器已下载，并妥善保管。');
    } catch { setError('无法生成备份，请检查账本和浏览器下载设置。原账本未改变。'); }
    finally { setExporting(false); }
  };
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    const id = ++request.current;
    setCandidate(null); setMessage(''); setError(''); setReading(false);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { setError('备份文件超过 2 MB，原账本未改变。'); return; }
    setReading(true);
    try {
      const raw = await file.text();
      const snapshot = parseSnapshot(raw);
      if (id === request.current) setCandidate({ raw, snapshot, name: file.name, baseLedger: ledger });
    } catch (failure) {
      if (id === request.current) setError(failure instanceof Error ? failure.message : '文件读取失败，原账本未改变。');
    } finally { if (id === request.current) setReading(false); }
  }
  return <Panel title="本地保存与备份">
    <div className="grid gap-5 text-sm leading-7">
      {local && <p>{persistence.kind === 'ready' ? (persistence.savedAt ? `当前账本已保存于 ${new Date(persistence.savedAt).toLocaleString('zh-CN')}` : '当前尚无已保存的账本。') : `保存状态：${persistence.message}`}</p>}
      <p>账本只保存在此浏览器，不会上传或跨设备同步；请避免多标签页同时编辑。清理站点数据、隐私模式或更换设备可能丢失数据，请定期导出 JSON 备份。</p>
      <p className="text-muted-foreground">备份包含完整账本与审计记录，未加密；恢复会整体替换当前本地账本，不会合并或重复记账。只支持本应用的有效备份，大小不超过 2 MB。</p>
      {local && <div className="rounded-xl border border-border p-4"><p>{backup.status.generatedAt ? `上次生成备份文件：${new Date(backup.status.generatedAt).toLocaleString('zh-CN')}` : '尚无生成备份文件的记录。'}</p><p className="mt-2 text-xs text-muted-foreground">这里只记录文件生成，不能确认下载成功或妥善保管；提示偏好不进入账本备份。</p>{backup.status.reminders && <p className="mt-3 text-sm">{{ never: '建议生成并妥善保管第一份备份。', checking: '正在核对备份后的账务变更…', changed: '上次生成备份后有账务变更，建议再次导出。', unchanged: '当前账务内容与上次生成的备份一致，请确认文件已保管。', unknown: '无法比较备份后的变更，请按需再次导出。', disabled: '账本尚未安全读取，暂不比较备份状态。' }[backup.comparison]}</p>}<Button className="mt-3" variant="ghost" onClick={backup.toggle}>{backup.status.reminders ? '关闭页面内备份提示' : '开启页面内备份提示'}</Button>{backup.warning && <p className="mt-2 text-sm">{backup.warning}</p>}</div>}
      {!local && <p className="font-medium text-primary">演示数据不写入本地，也不能导出为用户备份。请先返回本地账本，再进行备份或恢复。</p>}
      <div className="flex flex-wrap gap-3"><Button onClick={exportBackup} disabled={!local || !persistence.readable || exporting}>导出 JSON 备份</Button><Button variant="outline" disabled={!local || reading} onClick={() => { const failure = reload(); setError(failure ?? ''); setMessage(failure ? '' : '已重新读取本地账本。'); }}>重新读取本地账本</Button></div>
      <Field label="选择 JSON 备份恢复" hint="读取并校验文件后还需确认覆盖；取消不会修改任何数据。"><Input type="file" accept="application/json,.json" disabled={!local || reading} onChange={chooseFile} /></Field>
      {reading && <p role="status">正在读取并校验备份…</p>}
      {persistence.kind === 'blocked' && local && <div className="rounded-xl border border-border p-4"><p className="mb-3">读取被阻止时，不会自动覆盖原始存储。可先下载原始文件留存，再选择有效备份恢复，或明确清空当前账本。</p><Button variant="outline" onClick={() => {
        try {
          const raw = readStoredRaw();
          if (raw === null) { setError('本地没有可下载的原始文件。'); return; }
          download(raw, 'next-month-budget-original.json'); setMessage('已生成原始存储文件，请妥善保管。'); setError('');
        } catch { setError('无法读取原始存储，原数据未被修改。'); }
      }}>下载原始存储</Button></div>}
      {message && <p role="status" className="text-primary">{message}</p>}
      {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
    </div>
    {candidate && <Modal title="确认覆盖本地账本？" close={() => setCandidate(null)}><div className="grid gap-5 text-sm leading-7"><p className="break-words">文件：{candidate.name}</p><p>源文件格式版本 {JSON.parse(candidate.raw).schemaVersion} → 当前格式版本 {candidate.snapshot.schemaVersion}。备份创建于 {new Date(candidate.snapshot.exportedAt ?? candidate.snapshot.savedAt).toLocaleString('zh-CN')}；包含 {candidate.snapshot.workspace.ledger.periods.length} 个周期、{candidate.snapshot.workspace.ledger.pools.length} 个资金池、{candidate.snapshot.workspace.ledger.statements.length} 张账单、{candidate.snapshot.workspace.ledger.entries.length} 条预算流水、{candidate.snapshot.workspace.ledger.planning?.incomes.length ?? 0} 笔收入、{candidate.snapshot.workspace.ledger.credit?.repayments.length ?? 0} 笔还款、{candidate.snapshot.workspace.ledger.audit.length} 条审计记录。</p><p>确认后将整体替换当前本地账本及历史记录。建议先取消并导出当前账本；取消不会修改数据。保存成功后才显示恢复结果。</p>{error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}<div className="flex flex-wrap justify-end gap-3"><Button variant="outline" onClick={() => setCandidate(null)}>取消恢复</Button><Button onClick={() => {
      const failure = restore(candidate.raw, candidate.baseLedger);
      if (failure) { setError(failure); return; }
      setCandidate(null); setError(''); setMessage('备份已恢复并保存到此浏览器。');
    }}>确认覆盖并恢复</Button></div></div></Modal>}
  </Panel>;
}
