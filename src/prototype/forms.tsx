import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useDemo } from './store';
import { Field, Input, Modal, Select } from './ui';
import { money, parseMoney, type Allocation, type Statement } from './model';

export type FormKind = 'period' | 'pool' | 'funding' | 'statement';
const titles = { period: '创建预算周期', pool: '创建资金池', funding: '模拟拨款', statement: '登记账单' };
export function DemoForm({ kind, close }: { kind: FormKind; close: () => void }) {
  const { state, setState } = useDemo();
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const id = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const name = text('name');
    const amount = parseMoney(text('amount'));
    if (kind === 'pool') {
      if (!name || state.pools.some(p => p.name === name)) return setError('请输入不重复的资金池名称。');
      setState(s => ({ ...s, pools: [...s.pools, { id, name, opening: 0 }], activities: [{ id, kind: '创建', detail: `资金池 · ${name}（未拨款）`, date: today }, ...s.activities] }));
    } else if (kind === 'period') {
      const start = text('start'), end = text('end');
      if (!name || !start || !end || start > end) return setError('请输入名称，结束日期不能早于开始日期。');
      if (state.periods.some(p => start <= p.end && end >= p.start)) return setError('预算周期不能重叠，请调整日期。');
      setState(s => ({ ...s, currentPeriod: id, periods: [...s.periods, { id, name, start, end }], activities: [{ id, kind: '创建', detail: `预算周期 · ${name}`, date: today }, ...s.activities] }));
    } else if (kind === 'funding') {
      const pool = state.pools.find(p => p.id === text('pool')), period = state.periods.find(p => p.id === text('period'));
      if (!pool || !period || amount === null || amount <= 0) return setError('请选择周期、资金池，金额须大于 0 且最多两位小数。');
      setState(s => ({ ...s, activities: [{ id, kind: '拨款', detail: `${pool.name} · ${period.name}`, date: today, amount, poolId: pool.id, periodId: period.id }, ...s.activities] }));
    } else {
      const account = text('account'), reference = text('reference'), date = text('date'), due = text('due');
      if (!account || !reference || !date || !due || amount === null || amount <= 0) return setError('请填写完整，金额须大于 0 且最多两位小数。');
      if (due < date) return setError('还款日不能早于账单日。');
      if (state.statements.some(s => s.account === account && s.reference === reference)) return setError('该账户的账单标识已存在。');
      setState(s => ({ ...s, statements: [...s.statements, { id, account, reference, date, due, amount, allocations: [], settled: false }] }));
    }
    close();
  }
  return <Modal title={titles[kind]} close={close}><form className="grid gap-5" onSubmit={submit}>
    {(kind === 'period' || kind === 'pool') && <Field label={kind === 'pool' ? '资金池名称' : '周期名称'}><Input name="name" required maxLength={40} placeholder={kind === 'pool' ? '例如：学习成长' : '例如：十二月预算'} /></Field>}
    {kind === 'period' && <div className="grid gap-4 sm:grid-cols-2"><Field label="开始日期"><Input type="date" name="start" required /></Field><Field label="结束日期"><Input type="date" name="end" required /></Field></div>}
    {kind === 'pool' && <p className="text-sm text-muted-foreground">新资金池预算余额为 ¥0.00。创建后，请单独进行拨款。</p>}
    {kind === 'funding' && <><Field label="预算周期"><Select name="period" required defaultValue={state.currentPeriod}><option value="">请选择</option>{state.periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field><Field label="资金池"><Select name="pool" required><option value="">请选择</option>{state.pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field><p className="text-xs leading-6 text-muted-foreground">拨款是预算额度分配，不代表真实银行转账。</p></>}
    {kind === 'statement' && <><Field label="账户名称"><Input name="account" required maxLength={40} placeholder="使用演示名称，不填写卡号" /></Field><Field label="账单标识"><Input name="reference" required maxLength={60} placeholder="同账户内不可重复" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="账单日"><Input name="date" type="date" required /></Field><Field label="还款日"><Input name="due" type="date" required /></Field></div></>}
    {(kind === 'funding' || kind === 'statement') && <Field label="金额（元）" hint="最多两位小数，上限一亿元"><Input name="amount" inputMode="decimal" required placeholder="0.00" /></Field>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={close}>取消</Button><Button type="submit">{kind === 'funding' ? '确认模拟拨款' : '添加到演示'}</Button></div>
  </form></Modal>;
}

type Draft = { id: string; poolId: string; periodId: string; value: string };
export function AllocationForm({ statement, close }: { statement: Statement; close: () => void }) {
  const { state, setState } = useDemo();
  const suggested = state.periods.find(p => p.start <= statement.due && p.end >= statement.due)?.id ?? '';
  const newRow = (): Draft => ({ id: crypto.randomUUID(), poolId: state.pools[0]?.id ?? '', periodId: suggested, value: '' });
  const [rows, setRows] = useState<Draft[]>(() => [newRow()]);
  const [confirming, setConfirming] = useState(false);
  const allocations: Allocation[] = rows.map(r => ({ poolId: r.poolId, periodId: r.periodId, amount: parseMoney(r.value) ?? 0 }));
  const total = allocations.reduce((sum, a) => sum + a.amount, 0);
  const difference = statement.amount - total;
  const valid = difference === 0 && rows.every(r => parseMoney(r.value) !== null && parseMoney(r.value)! > 0 && state.pools.some(p => p.id === r.poolId) && state.periods.some(p => p.id === r.periodId));
  const update = (id: string, field: keyof Omit<Draft, 'id'>, value: string) => { setConfirming(false); setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r)); };
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    if (!confirming) return setConfirming(true);
    setState(s => {
      if (s.statements.find(item => item.id === statement.id)?.settled) return s;
      return { ...s, statements: s.statements.map(item => item.id === statement.id ? { ...item, allocations, settled: true } : item), activities: [{ id: crypto.randomUUID(), kind: '结算', detail: `${statement.account} · ${statement.reference}（未还款）`, amount: statement.amount, date: new Date().toISOString().slice(0, 10) }, ...s.activities] };
    });
    close();
  }
  return <Modal title="拆分与核对" close={close}><form onSubmit={submit} className="grid gap-5"><div><p className="font-medium">{statement.account} · {statement.reference}</p><p className="mt-1 text-sm text-muted-foreground">还款日 {statement.due} · 预算结算不代表还款</p></div>
    <p className="text-xs leading-6 text-muted-foreground">暂按还款日所在周期建议归属，可手动改为其他周期。无匹配周期时请先创建；跨期拆分请逐行选择。</p>
    {rows.map((row, index) => <fieldset key={row.id} className="grid gap-4 rounded-xl border border-border p-4"><legend className="px-2 text-sm">分配 {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2"><Field label={`资金池 ${index + 1}`}><Select value={row.poolId} onChange={e => update(row.id, 'poolId', e.target.value)} required><option value="">请选择</option>{state.pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field><Field label={`归属周期 ${index + 1}`}><Select value={row.periodId} onChange={e => update(row.id, 'periodId', e.target.value)} required><option value="">请选择</option>{state.periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field></div><Field label={`分配金额 ${index + 1}（元）`}><Input inputMode="decimal" required value={row.value} onChange={e => update(row.id, 'value', e.target.value)} placeholder="0.00" /></Field>{rows.length > 1 && <Button variant="ghost" type="button" onClick={() => { setRows(rs => rs.filter(r => r.id !== row.id)); setConfirming(false); }}>删除分配 {index + 1}</Button>}</fieldset>)}
    <Button variant="outline" type="button" onClick={() => { setRows(rs => [...rs, newRow()]); setConfirming(false); }}>添加分配行</Button>
    <dl aria-live="polite" className="grid gap-3 rounded-xl bg-muted p-4 text-sm"><div className="flex justify-between gap-2"><dt>账单总额</dt><dd className="money">{money(statement.amount)}</dd></div><div className="flex justify-between gap-2"><dt>已分配</dt><dd className="money">{money(total)}</dd></div><div className="flex justify-between gap-2 font-semibold"><dt>待核对差额</dt><dd className="money">{money(difference)}</dd></div></dl>
    {!valid && <p className="text-sm text-muted-foreground">每行填写有效资金池、周期及正数金额，差额为零后可核对。</p>}
    {confirming && <p role="status" className="rounded-xl bg-accent p-4 text-sm leading-7">核对预览：将从所选资金池扣减 {money(total)} 的演示预算，账单标记为「演示已结算」，还款状态不变。请确认各行归属周期正确。</p>}
    <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={close}>取消</Button><Button type="submit" disabled={!valid}>{confirming ? '确认模拟结算' : '核对分配'}</Button></div>
  </form></Modal>;
}
