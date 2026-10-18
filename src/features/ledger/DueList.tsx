import { useState } from 'react';
import { accountName, repaymentSummary } from '@/domain/credit';
import { money } from '@/lib/money';
import { useLedger } from './context';
import { Empty, Field, Input, Jump, Panel, Select } from './ui';
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function DueList() {
  const { ledger } = useLedger();
  const [today, setToday] = useState(localDate);
  const [range, setRange] = useState('all');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(today) && Number.isFinite(Date.parse(`${today}T00:00:00Z`)) && new Date(`${today}T00:00:00Z`).toISOString().slice(0, 10) === today;
  const until = valid ? new Date(Math.min(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000, Date.parse('9999-12-31T00:00:00Z'))).toISOString().slice(0, 10) : '';
  const statements = ledger.statements.filter(s => repaymentSummary(ledger, s).outstanding > 0 && (range === 'all' || (range === 'overdue' ? s.dueOn < today : s.dueOn >= today && s.dueOn <= until))).sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.fingerprint.localeCompare(b.fingerprint));
  return <Panel title="待还款到期列表" action={<Jump to="/statements">管理账单与还款</Jump>}><p className="mb-4 text-sm leading-7 text-muted-foreground">按手工还款记录及逐单填写的到期日计算，包含所有预算周期及已撤销预算结算的账单。仅页面内提示，无银行核对或系统通知。</p><div className="mb-4 grid gap-4 sm:grid-cols-2"><Field label="还款参考日期"><Input type="date" value={today} onChange={e => setToday(e.target.value)} /></Field><Field label="到期范围"><Select value={range} onChange={e => setRange(e.target.value)}><option value="all">全部未还</option><option value="overdue">参考日期前已到期</option><option value="week">参考日期起7天内（含首尾）</option></Select></Field></div>{!valid ? <p role="alert">请填写有效参考日期。</p> : statements.length ? <ul className="grid gap-3">{statements.map(s => <li key={s.id} className="min-w-0 rounded-xl border border-border p-4"><p className="break-words text-sm font-medium">{accountName(ledger, s)} · {s.fingerprint}</p><p className="mt-2 text-sm">{s.dueOn} · 未还 {money(repaymentSummary(ledger, s).outstanding)} · {s.dueOn < today ? '已到期未还' : s.dueOn === today ? '当日到期' : '尚未到期'}</p></li>)}</ul> : <Empty title="此范围暂无待还款账单">已还清的账单不在此列表；更改参考日期或范围可继续查看。</Empty>}</Panel>;
}
