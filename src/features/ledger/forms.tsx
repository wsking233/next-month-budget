import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { allocateIncome, cancelSettlement, correctSettlement, createBudgetPeriod, createBudgetPool, recordStatement, reviseStatement, settleStatement, transferBudget, updateBudgetPool, type Allocation, type BudgetPool, type Statement } from '@/domain/budget';
import { money, parseMoney } from '@/lib/money';
import { useLedger } from './context';
import { Field, Input, Modal, Select } from './ui';

export type FormKind = 'period' | 'pool' | 'funding' | 'statement' | 'transfer';
const titles = { period: '创建预算周期', pool: '创建资金池', funding: '预算拨款', statement: '登记账单', transfer: '资金池调拨' };
export function LedgerForm({ kind, close, editing, completed }: { kind: FormKind; close: () => void; editing?: Statement; completed?: () => void }) {
  const { ledger, currentPeriod, execute } = useLedger();
  const [error, setError] = useState('');
  const pools = ledger.pools.filter(p => p.active);
  const periods = ledger.periods;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const id = crypto.randomUUID();
    const amount = parseMoney(text('amount'));
    const failure = execute(l => {
      if (kind === 'pool') return createBudgetPool(l, { id, name: text('name') });
      if (kind === 'period') {
        if (!text('name')) throw new Error('请输入周期名称');
        return createBudgetPeriod(l, { id, name: text('name'), startsOn: text('start'), endsOn: text('end') });
      }
      if (amount === null || amount <= 0) throw new Error('金额须大于 0 且最多两位小数，上限一亿元');
      if (kind === 'funding') return allocateIncome(l, { id, periodId: text('period'), poolId: text('pool'), amount });
      if (kind === 'transfer') return transferBudget(l, { id, periodId: text('period'), fromPoolId: text('from'), toPoolId: text('to'), amount, reason: text('reason') });
      const creditAccountId = editing?.creditAccountId || text('creditAccount');
      const accountName = ledger.credit?.accounts.find(a => a.id === creditAccountId)?.name;
      const patch = { ...(creditAccountId ? { creditAccountId } : {}), accountId: editing?.creditAccountId ? editing.accountId : accountName || text('account'), fingerprint: text('reference'), amount, statementOn: text('date'), dueOn: text('due') };
      return editing ? reviseStatement(l, editing.id, patch, text('reason')) : recordStatement(l, { id, ...patch });
    }, kind === 'period' ? id : undefined);
    if (failure) setError(failure); else (completed ?? close)();
  }
  const periodField = <Field label="预算周期"><Select name="period" required defaultValue={currentPeriod}><option value="">请选择</option>{periods.map(p => <option key={p.id} value={p.id}>{p.name || p.startsOn}</option>)}</Select></Field>;
  return <Modal title={editing ? '修改账单资料' : titles[kind]} close={close}><form className="grid gap-5" onSubmit={submit}>
    {(kind === 'period' || kind === 'pool') && <Field label={kind === 'pool' ? '资金池名称' : '周期名称'}><Input name="name" required maxLength={40} placeholder={kind === 'pool' ? '例如：学习成长' : '例如：十二月预算'} /></Field>}
    {kind === 'period' && <div className="grid gap-4 sm:grid-cols-2"><Field label="开始日期"><Input type="date" name="start" required /></Field><Field label="结束日期"><Input type="date" name="end" required /></Field></div>}
    {kind === 'pool' && <p className="text-sm text-muted-foreground">新资金池预算余额为 ¥0.00。创建后，请单独进行拨款。</p>}
    {(kind === 'funding' || kind === 'transfer') && periodField}
    {kind === 'funding' && <><Field label="资金池"><Select name="pool" required><option value="">请选择</option>{pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field><p className="text-xs leading-6 text-muted-foreground">拨款是预算额度分配，不代表真实银行转账。</p></>}
    {kind === 'transfer' && <><Field label="来源资金池"><Select name="from" required><option value="">请选择</option>{pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field><Field label="目标资金池"><Select name="to" required><option value="">请选择</option>{pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field><p className="text-xs leading-6 text-muted-foreground">来源和去向必须不同，调拨同时生成一出一入流水，预算总额不变。允许负预算，不代表银行转账。</p></>}
    {kind === 'statement' && <>{Boolean(ledger.credit?.accounts.length) && <Field label="关联信用卡账户（可选）" hint="不选时沿用原账户名称；已有账户关联不能改换，可在设置中维护账户名称。"><Select name="creditAccount" defaultValue={editing?.creditAccountId ?? ''} disabled={Boolean(editing?.creditAccountId)}><option value="">保留账户文字，不关联</option>{ledger.credit?.accounts.filter(a => a.active || a.id === editing?.creditAccountId).map(a => <option key={a.id} value={a.id}>{a.name}{a.active ? '' : '（已停用）'}</option>)}</Select></Field>}<Field label="账户名称" hint="未关联信用卡时必填；使用稳定名称，不填写卡号"><Input name="account" maxLength={40} defaultValue={editing?.accountId} /></Field><Field label="账单标识"><Input name="reference" required maxLength={60} placeholder="同账户内不可重复" defaultValue={editing?.fingerprint} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="账单日"><Input name="date" type="date" required defaultValue={editing?.statementOn} /></Field><Field label="还款日"><Input name="due" type="date" required defaultValue={editing?.dueOn} /></Field></div>{editing && <p className="text-xs leading-6 text-muted-foreground">修改后回到待分配状态，需要重新核对结算。原资料、撤销和修改原因保留在历史记录。</p>}</>}
    {(kind === 'funding' || kind === 'statement' || kind === 'transfer') && <Field label="金额（元）" hint="最多两位小数，上限一亿元"><Input name="amount" inputMode="decimal" required placeholder="0.00" defaultValue={editing ? (editing.amount / 100).toFixed(2) : ''} /></Field>}
    {(kind === 'transfer' || editing) && <Field label="操作原因"><Input name="reason" required maxLength={200} /></Field>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={close}>取消</Button><Button type="submit">{editing ? '确认修改资料' : kind === 'funding' ? '确认拨款' : kind === 'transfer' ? '确认调拨' : '确认添加'}</Button></div>
  </form></Modal>;
}

type Draft = { id: string; poolId: string; periodId: string; value: string };
export function AllocationForm({ statement, close, completed }: { statement: Statement; close: () => void; completed?: () => void }) {
  const { ledger, execute } = useLedger();
  const correcting = statement.status === 'settled';
  const pools = ledger.pools.filter(p => p.active);
  const suggested = ledger.periods.find(p => p.startsOn <= statement.dueOn && p.endsOn >= statement.dueOn)?.id ?? '';
  const newRow = (): Draft => ({ id: crypto.randomUUID(), poolId: pools[0]?.id ?? '', periodId: suggested, value: '' });
  const [rows, setRows] = useState<Draft[]>(() => correcting ? statement.allocations.map(a => ({ ...a, value: (a.amount / 100).toFixed(2) })) : [newRow()]);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const allocations: Allocation[] = rows.map(r => ({ id: r.id, poolId: r.poolId, periodId: r.periodId, amount: parseMoney(r.value) ?? 0 }));
  const total = allocations.reduce((sum, a) => sum + BigInt(a.amount), 0n);
  const difference = BigInt(statement.amount) - total;
  const valid = total <= BigInt(Number.MAX_SAFE_INTEGER) && difference === 0n && rows.every(r => parseMoney(r.value) !== null && parseMoney(r.value)! > 0 && pools.some(p => p.id === r.poolId) && ledger.periods.some(p => p.id === r.periodId)) && (!correcting || !!reason.trim());
  const update = (id: string, field: keyof Omit<Draft, 'id'>, value: string) => { setConfirming(false); setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r)); };
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    if (!confirming) return setConfirming(true);
    const failure = execute(l => correcting ? correctSettlement(l, statement.id, allocations, reason) : settleStatement(l, statement.id, allocations));
    if (failure) setError(failure); else (completed ?? close)();
  }
  return <Modal title={correcting ? '更正账单分配' : '拆分与核对'} close={close}><form onSubmit={submit} className="grid gap-5"><div><p className="font-medium break-words">{statement.accountId} · {statement.fingerprint}</p><p className="mt-1 text-sm text-muted-foreground">还款日 {statement.dueOn} · 预算结算不代表还款</p></div>
    <p className="text-xs leading-6 text-muted-foreground">暂按还款日所在周期建议归属，可手动改为其他周期。无匹配周期时请先创建；跨期拆分请逐行选择。{correcting && '更正将先冲销旧分配，再记入新分配，并重算后续周期余额。'}</p>
    {rows.map((row, index) => <fieldset key={row.id} className="grid gap-4 rounded-xl border border-border p-4"><legend className="px-2 text-sm">分配 {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2"><Field label={`资金池 ${index + 1}`}><Select value={row.poolId} onChange={e => update(row.id, 'poolId', e.target.value)} required><option value="">请选择</option>{pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}{!pools.some(p => p.id === row.poolId) && row.poolId && <option value={row.poolId} disabled>原资金池已停用，请重新选择</option>}</Select></Field><Field label={`归属周期 ${index + 1}`}><Select value={row.periodId} onChange={e => update(row.id, 'periodId', e.target.value)} required><option value="">请选择</option>{ledger.periods.map(p => <option key={p.id} value={p.id}>{p.name || p.startsOn}</option>)}</Select></Field></div><Field label={`分配金额 ${index + 1}（元）`}><Input inputMode="decimal" required value={row.value} onChange={e => update(row.id, 'value', e.target.value)} placeholder="0.00" /></Field>{rows.length > 1 && <Button variant="ghost" type="button" onClick={() => { setRows(rs => rs.filter(r => r.id !== row.id)); setConfirming(false); }}>删除分配 {index + 1}</Button>}</fieldset>)}
    <Button variant="outline" type="button" onClick={() => { setRows(rs => [...rs, newRow()]); setConfirming(false); }}>添加分配行</Button>
    {correcting && <Field label="更正原因"><Input required maxLength={200} value={reason} onChange={e => { setReason(e.target.value); setConfirming(false); }} /></Field>}
    <dl aria-live="polite" className="grid gap-3 rounded-xl bg-muted p-4 text-sm"><div className="flex justify-between gap-2"><dt>账单总额</dt><dd className="money">{money(statement.amount)}</dd></div><div className="flex justify-between gap-2"><dt>已分配</dt><dd className="money">{money(total)}</dd></div><div className="flex justify-between gap-2 font-semibold"><dt>待核对差额</dt><dd className="money">{money(difference)}</dd></div></dl>
    {!valid && <p className="text-sm text-muted-foreground">每行填写有效资金池、周期及正数金额，差额为零后可核对。{correcting && '请填写更正原因。'}</p>}
    {confirming && <div role="status" className="rounded-xl bg-accent p-4 text-sm leading-7"><p>核对预览：{correcting ? '先冲销旧分配，再按下列分配记入' : '从所选资金池扣减'} {money(total)} 的预算，账单标记为「已结算」，还款状态不变。</p><ul className="mt-2">{allocations.map(a => <li key={a.id}>{pools.find(p => p.id === a.poolId)?.name} · {ledger.periods.find(p => p.id === a.periodId)?.name} · {money(a.amount)}</li>)}</ul></div>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={close}>取消</Button><Button type="submit" disabled={!valid}>{confirming ? (correcting ? '确认更正' : '确认结算') : '核对分配'}</Button></div>
  </form></Modal>;
}

export function CancelForm({ statement, close, completed }: { statement: Statement; close: () => void; completed?: () => void }) {
  const { execute } = useLedger();
  const [reason, setReason] = useState(''), [error, setError] = useState('');
  return <Modal title="撤销账单结算" close={close}><form className="grid gap-5" onSubmit={e => {
    e.preventDefault();
    const failure = execute(l => cancelSettlement(l, statement.id, reason));
    if (failure) setError(failure); else (completed ?? close)();
  }}><p className="text-sm leading-7">将冲销 {statement.accountId} · {money(statement.amount)} 的当前结算分配，重新计算受影响周期及以后余额。原记录保留，账单标记为已撤销，不改变实际还款。之后可修改资料，再重新结算。</p><Field label="撤销原因"><Input required value={reason} maxLength={200} onChange={e => setReason(e.target.value)} /></Field>{error && <p role="alert">{error}</p>}<div className="flex justify-end gap-3"><Button variant="outline" type="button" onClick={close}>取消</Button><Button type="submit" disabled={!reason.trim()}>确认撤销结算</Button></div></form></Modal>;
}

export function PoolForm({ pool, close, completed }: { pool: BudgetPool; close: () => void; completed?: () => void }) {
  const { execute, currentPeriod } = useLedger();
  const [error, setError] = useState('');
  return <Modal title="编辑资金池" close={close}><form className="grid gap-5" onSubmit={e => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const failure = execute(l => updateBudgetPool(l, pool.id, String(data.get('name')), data.get('active') === 'on', currentPeriod));
    if (failure) setError(failure); else (completed ?? close)();
  }}><Field label="资金池名称"><Input name="name" required maxLength={40} defaultValue={pool.name} /></Field><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="active" defaultChecked={pool.active} className="size-5" />启用此资金池</label><p className="text-xs leading-6 text-muted-foreground">无流水时可直接停用；已有流水时，所选周期余额须为零且没有后续净变动或有效账单分配。请先调拨或更正账单处理余额；历史流水不会删除，停用后禁止新拨款、调拨和结算。</p>{error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}<div className="flex justify-end gap-3"><Button variant="outline" type="button" onClick={close}>取消</Button><Button type="submit">保存资金池</Button></div></form></Modal>;
}
