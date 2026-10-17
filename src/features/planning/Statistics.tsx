import { useId, useState } from 'react';
import { comparePeriods, summarizePeriod } from '@/domain/analytics';
import type { BudgetLedger } from '@/domain/budget';
import { money } from '@/lib/money';
import { Empty, Field, Panel, Select } from '@/features/ledger/ui';

function Trend({ points }: { points: { name: string; value: number }[] }) {
  const title = useId();
  const min = Math.min(0, ...points.map(p => p.value)), max = Math.max(0, ...points.map(p => p.value));
  const span = max - min || 1;
  const y = (value: number) => 165 - ((value - min) / span) * 140;
  const x = (i: number) => 40 + i * (480 / Math.max(points.length - 1, 1));
  return <svg role="img" aria-labelledby={title} viewBox="0 0 560 210" className="h-auto w-full"><title id={title}>预算期末余额趋势；精确金额见下方周期明细</title><line x1="30" x2="530" y1={y(0)} y2={y(0)} stroke="var(--border)" strokeDasharray="4 4" /><text x="4" y={y(0) - 5} fill="var(--muted-foreground)" fontSize="11">0</text><polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="3" />{points.map((p, i) => <g key={i}><circle cx={x(i)} cy={y(p.value)} r="5" fill="var(--primary)"><title>{p.name}：{money(p.value)}</title></circle><text x={x(i)} y="196" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">{i + 1}</text></g>)}</svg>;
}
export function Statistics({ ledger, periodId }: { ledger: BudgetLedger; periodId: string }) {
  const [pool, setPool] = useState('all');
  if (!ledger.periods.some(p => p.id === periodId) || !ledger.pools.length) return <Panel title="预算复盘"><Empty title="有了周期与资金池，再回看预算变化">统计直接来自账本；未开始时不展示示例金额。</Empty></Panel>;
  const summary = summarizePeriod(ledger, periodId);
  const history = comparePeriods(ledger, periodId);
  const selectedPool = ledger.pools.find(p => p.id === pool);
  const points = history.map(s => ({ name: s.period.name || s.period.startsOn, value: selectedPool ? s.rows.find(r => r.poolId === pool)!.closing : s.closing }));
  const distribution = summary.funding;
  return <>
    <Panel title="本期预算收支桥梁"><p className="mb-5 text-sm leading-7 text-muted-foreground">上期结转 + 本期拨款 − 预算结算 + 净调拨 = 期末预算余额。结算包含更正与冲销后的有效分配，不代表实际还款或现金消费。</p><dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['上期结转', summary.opening], ['本期拨款', summary.funding], ['预算结算额', summary.settled], ['期末预算余额', summary.closing]].map(([label, amount]) => <div key={label} className="min-w-0 rounded-xl bg-muted p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="money mt-3 break-words text-xl font-semibold">{money(Number(amount))}</dd></div>)}</dl></Panel>
    <Panel title="结转趋势与多周期对比" action={<Field label="趋势资金池"><Select value={pool} onChange={e => setPool(e.target.value)}><option value="all">全部资金池</option>{ledger.pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>}><p className="text-xs leading-6 text-muted-foreground">截至所选周期的最近六期；横轴序号对应下方周期。负余额保留在零线下方，已停用资金池仍计入历史。</p><Trend points={points} /><div className="grid gap-3">{history.map((s, i) => <article key={s.period.id} className="rounded-xl border border-border p-4"><h3 className="text-sm font-medium">{i + 1} · {s.period.name || s.period.startsOn}</h3><p className="mt-1 text-xs text-muted-foreground">{s.period.startsOn} — {s.period.endsOn}</p><dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">{[['结转', selectedPool ? s.rows.find(r => r.poolId === pool)!.opening : s.opening], ['拨款', selectedPool ? s.rows.find(r => r.poolId === pool)!.funding : s.funding], ['预算结算', selectedPool ? s.rows.find(r => r.poolId === pool)!.settled : s.settled], ['期末余额', points[i].value]].map(([label, amount]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="money mt-1 break-words font-medium">{money(Number(amount))}</dd></div>)}</dl></article>)}</div></Panel>
    <Panel title="本期拨款分布"><p className="mb-5 text-xs leading-6 text-muted-foreground">分母为本期实际录入的预算拨款总额，不是现金资产或余额占比；负预算不进入比例计算。</p>{distribution === 0 ? <Empty title="本期还没有拨款">拨款后将按资金池显示额度分配。</Empty> : <ul className="grid gap-4">{summary.rows.map(row => <li key={row.poolId}><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{row.name}</span><span className="money">{money(row.funding)} · {(row.funding / distribution * 100).toFixed(1)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${row.funding / distribution * 100}%` }} /></div></li>)}</ul>}</Panel>
  </>;
}
