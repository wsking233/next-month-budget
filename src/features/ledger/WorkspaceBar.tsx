import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLedger } from './context';
import { Field, Modal, Select } from './ui';

export function WorkspaceBar() {
  const { ledger, currentPeriod, mode, selectPeriod, enterDemo, exitDemo, reset } = useLedger();
  const [confirm, setConfirm] = useState<'reset' | 'sample' | null>(null);
  return <>
    <div className="mb-6 rounded-2xl border border-border bg-accent p-4"><p className="text-sm font-semibold">{mode === 'demo' ? '独立演示账本' : '内存账本'} · 尚未保存，刷新即丢失</p><p className="mt-1 text-xs leading-6">{mode === 'demo' ? '样例与内存账本相互隔离；可随时返回，不会覆盖你创建的账本。' : '当前操作已接入账务规则，但刷新或关闭页面后数据全部丢失。备份尚未开放，请使用测试数据。'}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => mode === 'demo' ? setConfirm('sample') : enterDemo()}>{mode === 'demo' ? '重新加载演示数据' : '查看独立演示'}</Button>{mode === 'demo' && <Button variant="outline" onClick={exitDemo}>返回内存账本</Button>}<Button variant="ghost" onClick={() => setConfirm('reset')}>清空当前账本</Button></div></div>
    {ledger.periods.length > 0 && <div className="mb-6 max-w-md"><Field label="查看预算周期"><Select value={currentPeriod} onChange={e => selectPeriod(e.target.value)}>{!currentPeriod && <option value="">请选择周期</option>}{ledger.periods.map(p => <option key={p.id} value={p.id}>{p.name || p.startsOn} · {p.startsOn} — {p.endsOn}</option>)}</Select></Field></div>}
    {confirm && <Modal title={confirm === 'reset' ? '清空当前账本？' : '重新加载演示数据？'} close={() => setConfirm(null)}><p className="mb-6 text-sm leading-7">此操作会{confirm === 'reset' ? '删除当前工作区全部内存数据' : '替换当前演示操作'}，无法撤销。{mode === 'demo' && '用户内存账本不会受到影响。'}</p><div className="flex flex-wrap justify-end gap-3"><Button variant="outline" onClick={() => setConfirm(null)}>取消</Button><Button onClick={() => { if (confirm === 'reset') reset(); else enterDemo(); setConfirm(null); }}>确认清除并继续</Button></div></Modal>}
  </>;
}
