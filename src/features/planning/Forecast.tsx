import { useState, type FormEvent } from 'react';
import { forecastBudget } from '@/domain/analytics';
import type { BudgetLedger } from '@/domain/budget';
import { money, parseMoney } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Empty, Field, Input, Panel, Select } from '@/features/ledger/ui';

export function Forecast({ ledger, periodId }: { ledger: BudgetLedger; periodId: string }) {
  const [values, setValues] = useState<Record<string, { grant: string; spend: string }>>({});
  const [count, setCount] = useState('3');
  const [scheduled, setScheduled] = useState(true);
  const [result, setResult] = useState<ReturnType<typeof forecastBudget> | null>(null);
  const [source, setSource] = useState<BudgetLedger | null>(null);
  const [error, setError] = useState('');
  const active = ledger.pools.filter(p => p.active);
  if (!active.length || !ledger.periods.some(p => p.id === periodId)) return <Panel title="未来拨款模拟"><Empty title="先建立周期与启用资金池">模拟以真实账本余额为起点，默认不添加财务假设。</Empty></Panel>;
  const invalidate = () => { setResult(null); setError(''); };
  function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    try {
      const assumptions = active.map(pool => {
        const grant = parseMoney(values[pool.id]?.grant ?? '0'), spend = parseMoney(values[pool.id]?.spend ?? '0');
        if (grant === null || spend === null) throw new Error('模拟金额最多两位小数，须非负且不超过一亿元。');
        return { poolId: pool.id, grant, spend };
      });
      setSource(ledger);
      setResult(forecastBudget(ledger, periodId, Number(count), assumptions, scheduled));
    } catch (failure) { setResult(null); setError(failure instanceof Error ? failure.message : '无法生成模拟，请检查输入。'); }
  }
  return <Panel title="未来拨款模拟 · 只读"><p className="mb-5 text-sm leading-7 text-muted-foreground">从所选周期期末余额出发。每期重复下列额外假设，默认全部为零。已有未来周期可计入真实流水净变动；额外拨款与结算不会抵消或替代已有流水，请勿重复填写。未分配账单不自动纳入模拟。</p><form onSubmit={submit} className="grid gap-5"><Field label="模拟周期数"><Select value={count} onChange={e => { setCount(e.target.value); invalidate(); }}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} 期</option>)}</Select></Field><label className="flex min-h-11 items-center gap-3 text-sm"><input className="size-5" type="checkbox" checked={scheduled} onChange={e => { setScheduled(e.target.checked); invalidate(); }} />计入已有未来周期流水</label>{active.map(pool => <fieldset key={pool.id} className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2"><legend className="px-2 text-sm font-medium">{pool.name}</legend>{(['grant', 'spend'] as const).map(field => <Field key={field} label={`${pool.name} · 每期额外${field === 'grant' ? '拨款' : '预算结算'}（元）`}><Input inputMode="decimal" value={values[pool.id]?.[field] ?? '0'} onChange={e => { setValues(previous => ({ ...previous, [pool.id]: { grant: previous[pool.id]?.grant ?? '0', spend: previous[pool.id]?.spend ?? '0', [field]: e.target.value } })); invalidate(); }} /></Field>)}</fieldset>)}{error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}<Button type="submit">生成只读模拟</Button></form>{result && source === ledger && <div className="mt-6 grid gap-4" aria-live="polite"><p className="rounded-xl bg-accent p-4 text-sm leading-7">模拟结果 · 未保存，未创建周期或账务流水。结果不代表现金、储蓄或实际可还款金额。</p>{result.map((period, i) => <section key={i} className="rounded-xl border border-border p-4"><h3 className="font-medium">{period.label}</h3><p className="money mt-2 text-xl font-semibold">模拟余额 {money(period.total)}</p><ul className="mt-4 grid gap-3 text-xs leading-6">{period.rows.map(row => <li key={row.poolId} className="min-w-0"><p className="font-medium">{row.name} · {money(row.closing)}</p><p className="text-muted-foreground">期初 {money(row.opening)} + 已有净变动 {money(row.scheduled)} + 额外拨款 {money(row.grant)} − 额外预算结算 {money(row.spend)}</p></li>)}</ul></section>)}</div>}</Panel>;
}
