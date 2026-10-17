import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLedger } from './context';
import { Field, Modal, Select } from './ui';

export function WorkspaceBar() {
  const { ledger, currentPeriod, mode, persistence, selectPeriod, enterDemo, exitDemo, reset, reload } = useLedger();
  const [confirm, setConfirm] = useState<'reset' | 'sample' | null>(null);
  const [error, setError] = useState('');
  return <>
    <div className="mb-6 rounded-2xl border border-border bg-accent p-4"><p className="text-sm font-semibold">{mode === 'demo' ? '独立演示账本 · 刷新即清空' : '本地账本 · 自动保存在此浏览器'}</p><p className="mt-1 text-xs leading-6">{mode === 'demo' ? '演示操作不写入本地；返回后保留你的本地账本。' : '仅本机浏览器保存，不跨设备同步。请在设置中定期导出备份。'}</p>{mode === 'memory' && persistence.kind === 'ready' && <p role="status" className="mt-1 text-xs leading-6">{persistence.savedAt ? `已保存 · ${new Date(persistence.savedAt).toLocaleString('zh-CN')}` : '尚无本地账本，首次操作成功后自动保存。'}</p>}
      {mode === 'memory' && persistence.kind !== 'ready' && <div role="alert" className="mt-3 rounded-xl border border-border bg-card p-3 text-sm leading-7"><p>{persistence.message}</p><p>{persistence.kind === 'blocked' ? '已暂停写入，原始存储保留。请重新读取，或在设置中选择有效备份恢复。' : '本次操作未生效，原账本保留。请处理存储问题后重新提交，或先导出已有账本。'}</p><Button className="mt-2" variant="outline" onClick={() => reload()}>重新读取本地账本</Button></div>}
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => mode === 'demo' ? setConfirm('sample') : enterDemo()}>{mode === 'demo' ? '重新加载演示数据' : '查看独立演示'}</Button>{mode === 'demo' && <Button variant="outline" onClick={exitDemo}>返回本地账本</Button>}<Button variant="ghost" onClick={() => { setError(''); setConfirm('reset'); }}>清空当前账本</Button></div></div>
    {ledger.periods.length > 0 && <div className="mb-6 max-w-md"><Field label="查看预算周期"><Select value={currentPeriod} onChange={e => selectPeriod(e.target.value)}>{!currentPeriod && <option value="">请选择周期</option>}{ledger.periods.map(p => <option key={p.id} value={p.id}>{p.name || p.startsOn} · {p.startsOn} — {p.endsOn}</option>)}</Select></Field></div>}
    {confirm && <Modal title={confirm === 'reset' ? '清空当前账本？' : '重新加载演示数据？'} close={() => setConfirm(null)}><p className="mb-6 text-sm leading-7">此操作会{confirm === 'reset' ? (mode === 'demo' ? '清空当前演示数据' : '清空并覆盖此浏览器保存的账本及全部历史记录') : '替换当前演示操作'}，无法撤销。{mode === 'demo' ? '用户本地账本不会受到影响。' : '建议先取消并在设置中导出备份。'}不会删除其他网站数据。</p>{error && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{error}</p>}<div className="flex flex-wrap justify-end gap-3"><Button variant="outline" onClick={() => setConfirm(null)}>取消</Button><Button onClick={() => {
      if (confirm === 'sample') { enterDemo(); setConfirm(null); return; }
      const failure = reset();
      if (failure) setError(failure); else setConfirm(null);
    }}>确认清除并继续</Button></div></Modal>}
  </>;
}
