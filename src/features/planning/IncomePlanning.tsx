import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { applyIncome, cancelIncome, emptyPlanning, saveBudgetTemplate, type BudgetTemplate } from '@/domain/income';
import { exactSum } from '@/domain/analytics';
import { money, parseMoney } from '@/lib/money';
import { useLedger } from '@/features/ledger/context';
import { Empty, Field, Input, Modal, Panel, Select } from '@/features/ledger/ui';

export function IncomePlanning() {
  const { ledger, currentPeriod } = useLedger();
  const planning = ledger.planning ?? emptyPlanning();
  const [form, setForm] = useState<'template' | 'income' | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState(currentPeriod);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const visible = planning.incomes.filter(i => (!periodFilter || i.periodId === periodFilter) && (statusFilter === 'all' || i.status === statusFilter) && i.reference.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const active = planning.incomes.filter(i => i.periodId === currentPeriod && i.status === 'applied');
  return <Panel title="收入与固定预算计划"><p className="mb-4 text-sm leading-7 text-muted-foreground">模板仅保存计划，确认收入分配后才拨款。收入不足需手动调整；未分配金额不是实际储蓄，计划储蓄也不代表银行存款。已有手工拨款不会自动抵扣本次计划，请避免重复拨款。</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => setForm('template')}>编辑固定金额模板</Button><Button disabled={!currentPeriod} onClick={() => setForm('income')}>登记收入并分配</Button></div><dl className="my-5 grid gap-4 sm:grid-cols-3">{[['已登记实际收入', exactSum(active.map(i => i.amount))], ['收入关联拨款', exactSum(active.flatMap(i => i.allocations.map(a => a.amount)))], ['计划储蓄目标', exactSum(active.map(i => i.plannedSavings))]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="money mt-2 break-words font-semibold">{money(Number(value))}</dd></div>)}</dl><p className="mb-4 text-xs text-muted-foreground">以上仅汇总所选周期的有效收入记录；预算拨款统计仍包含独立手工拨款。</p><div className="mb-4 grid gap-4 sm:grid-cols-2"><Field label="收入归属周期筛选"><Select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}><option value="">全部周期</option>{ledger.periods.map(p => <option key={p.id} value={p.id}>{p.name || p.startsOn}</option>)}</Select></Field><Field label="收入状态筛选"><Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">全部状态</option><option value="applied">已应用</option><option value="cancelled">已撤销</option></Select></Field><Field label="搜索收入标识"><Input type="search" value={search} onChange={e => setSearch(e.target.value)} /></Field></div><Button variant="outline" onClick={() => { setPeriodFilter(currentPeriod); setStatusFilter('all'); setSearch(''); }}>重置收入筛选</Button><p role="status" className="my-4 text-sm text-muted-foreground">匹配 {visible.length} / {planning.incomes.length} 笔收入；筛选不改变上方所选周期汇总。</p>{visible.length === 0 && <Empty title="暂无匹配的收入">可调整筛选，或登记本期实际收入。</Empty>}<div className="grid gap-3">{visible.map(i => <article key={i.id} className="min-w-0 rounded-xl border border-border p-4"><h3 className="break-words font-medium">{i.reference} · {i.status === 'applied' ? '已应用' : '已撤销'}</h3><p className="mt-2 text-sm">{ledger.periods.find(p => p.id === i.periodId)?.name || i.periodId} · {i.receivedOn} · 收入 {money(i.amount)}</p><p className="mt-2 text-sm">拨款 {money(exactSum(i.allocations.map(a => a.amount)))} · 计划储蓄 {money(i.plannedSavings)} · 未分配 {money(i.amount - exactSum([i.plannedSavings, ...i.allocations.map(a => a.amount)]))}</p>{i.status === 'applied' && <Button className="mt-3" variant="outline" onClick={() => setCancelling(i.id)}>撤销此收入及拨款</Button>}</article>)}</div>{form && <IncomeForm kind={form} close={() => setForm(null)} />}{cancelling && <CancelIncome id={cancelling} close={() => setCancelling(null)} />}</Panel>;
}
function IncomeForm({ kind, close }: { kind: 'template' | 'income'; close: () => void }) {
  const { ledger, currentPeriod, execute } = useLedger();
  const template = ledger.planning?.template ?? emptyPlanning().template;
  const pools = ledger.pools.filter(p => p.active);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(pools.map(p => [p.id, decimal(template.allocations.find(a => a.poolId === p.id)?.amount ?? 0)])));
  const [savings, setSavings] = useState(decimal(template.plannedSavings));
  const [income, setIncome] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState('');
  const [preview, setPreview] = useState(false);
  const [previewLedger, setPreviewLedger] = useState(ledger);
  const [error, setError] = useState('');
  const [copiedFrom, setCopiedFrom] = useState('');
  let planPreview: BudgetTemplate | null = null;
  try { planPreview = plan(); } catch { /* Invalid drafts stay editable. */ }
  const id = useState(() => crypto.randomUUID())[0];
  function plan(): BudgetTemplate {
    const saved = parseMoney(savings);
    const allocations = pools.map(p => ({ poolId: p.id, amount: parseMoney(values[p.id] ?? '') }));
    if (saved === null || saved < 0 || allocations.some(a => a.amount === null || a.amount < 0)) throw new Error('计划金额须为非负数、最多两位小数且不超过一亿元');
    return { plannedSavings: saved, allocations: allocations.filter(a => a.amount! > 0).map(a => ({ poolId: a.poolId, amount: a.amount! })) };
  }
  function copyPeriod() {
    try {
      setValues(Object.fromEntries(pools.map(p => [p.id, decimal(exactSum(ledger.entries.filter(e => e.poolId === p.id && e.periodId === currentPeriod && (e.kind === 'income_allocation' || e.kind === 'income_reversal')).map(e => e.amount)))])));
      setCopiedFrom(ledger.periods.find(p => p.id === currentPeriod)?.name || currentPeriod);
      setPreview(false); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '无法复制'); }
  }
  return <Modal title={kind === 'template' ? '固定金额模板' : '收入分配核对'} close={close}><form className="grid gap-5" onChange={() => setPreview(false)} onSubmit={event => {
    event.preventDefault(); setError('');
    try {
      const draft = plan();
      if (kind === 'template') {
        const failure = execute(l => saveBudgetTemplate(l, draft));
        if (failure) setError(failure); else close();
        return;
      }
      const amount = parseMoney(income);
      if (amount === null || amount <= 0) throw new Error('请输入有效正数收入');
      const input = { id, periodId: currentPeriod, reference, receivedOn: date, amount, ...draft };
      // Pure validation/preview: no store or storage writes until confirmation.
      applyIncome(ledger, input);
      if (!preview || previewLedger !== ledger) { setPreviewLedger(ledger); setPreview(true); return; }
      const failure = execute(l => applyIncome(l, input));
      if (failure) setError(failure); else close();
    } catch (e) { setError(e instanceof Error ? e.message : '无法应用计划'); }
  }}>
    <p className="text-sm leading-7">归属周期：{ledger.periods.find(p => p.id === currentPeriod)?.name || '未选择'}。日期与归属周期独立，可手动安排多笔收入。不会自动抵扣已有手工拨款。</p>
    {kind === 'income' && <><Field label="收入标识" hint="例如工资月份或奖金批次，同周期内不可重复"><Input required maxLength={200} value={reference} onChange={e => setReference(e.target.value)} /></Field><Field label="实际收到日期"><Input type="date" required value={date} onChange={e => setDate(e.target.value)} /></Field><Field label="实际收入（元）"><Input inputMode="decimal" required value={income} onChange={e => setIncome(e.target.value)} /></Field></>}
    <Button type="button" variant="outline" disabled={!currentPeriod} onClick={copyPeriod}>复制所选周期净拨款</Button>
    <p className="text-xs leading-6 text-muted-foreground">复制用于编辑计划，不修改历史；保存模板后不会自动给下一周期拨款。停用池不接受新拨款。</p>
    {copiedFrom && <p className="text-sm text-muted-foreground">已复制来源周期「{copiedFrom}」的净拨款（原拨款加收入冲销净额），未复制收入或储蓄目标；当前金额仍可编辑。</p>}
    {planPreview ? <div className="rounded-xl bg-muted p-4 text-sm leading-7"><p>当前计划预览：拨款合计 {money(exactSum(planPreview.allocations.map(a => a.amount)))} · 计划储蓄 {money(planPreview.plannedSavings)} · 合计需收入 {money(exactSum([planPreview.plannedSavings, ...planPreview.allocations.map(a => a.amount)]))}</p><p>预览不写入账本，不自动抵扣已有拨款。</p></div> : <p className="text-sm text-muted-foreground">计划金额尚未有效填写，完成后显示合计。</p>}
    {template.allocations.some(a => !pools.some(p => p.id === a.poolId)) && <p className="text-sm text-muted-foreground">模板含停用资金池，其拨款不纳入本次表单。请核对剩余金额后再保存或确认。</p>}
    {pools.map(p => <Field key={p.id} label={`${p.name}拨款（元）`}><Input inputMode="decimal" required value={values[p.id] ?? '0.00'} onChange={e => setValues(v => ({ ...v, [p.id]: e.target.value }))} /></Field>)}
    <Field label="计划储蓄（元）"><Input inputMode="decimal" required value={savings} onChange={e => setSavings(e.target.value)} /></Field>
    {preview && previewLedger === ledger && <div role="status" className="rounded-xl bg-accent p-4 text-sm leading-7"><p>核对：收入 {money(parseMoney(income)!)}；拨款 {money(exactSum(plan().allocations.map(a => a.amount)))}；计划储蓄 {money(plan().plannedSavings)}；未分配 {money(parseMoney(income)! - exactSum([plan().plannedSavings, ...plan().allocations.map(a => a.amount)]))}。</p><p>确认后整体保存收入与拨款。计划储蓄不是实际现金存款。</p></div>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={close}>取消</Button><Button type="submit">{kind === 'template' ? '保存模板' : preview && previewLedger === ledger ? '确认收入及拨款' : '预览收入分配'}</Button></div>
  </form></Modal>;
}
function CancelIncome({ id, close }: { id: string; close: () => void }) {
  const { execute } = useLedger();
  const [reason, setReason] = useState(''), [error, setError] = useState('');
  return <Modal title="撤销收入及拨款" close={close}><form className="grid gap-5" onSubmit={e => {
    e.preventDefault(); const failure = execute(l => cancelIncome(l, id, reason));
    if (failure) setError(failure); else close();
  }}><p className="text-sm leading-7">追加冲销本次收入关联的拨款，保留原记录。已结算支出不会撤销，未来预算可能变负；收入标识仍保留。修正后请用新标识重新登记，不代表实际银行退款。</p><Field label="收入撤销原因"><Input required maxLength={200} value={reason} onChange={e => setReason(e.target.value)} /></Field>{error && <p role="alert">{error}</p>}<Button type="submit">确认撤销收入</Button></form></Modal>;
}
function decimal(cents: number) { const value = BigInt(cents); return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`; }
