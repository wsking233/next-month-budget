import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Statement } from '@/domain/budget';
import { accountName, cancelRepayment, linkStatementAccount, recordRepayment, repaymentSummary, type Repayment } from '@/domain/credit';
import { money, parseMoney } from '@/lib/money';
import { useLedger } from './context';
import { Field, Input, Modal, Select } from './ui';
export function Repayments({ statement }: { statement: Statement }) {
  const { ledger } = useLedger();
  const summary = repaymentSummary(ledger, statement);
  const [form, setForm] = useState<'pay' | 'link' | null>(null);
  const [cancelling, setCancelling] = useState<Repayment | null>(null);
  return <div className="mt-4 border-t border-border pt-4"><p className="text-sm">{summary.label} · 已还 {money(summary.paid)} · 未还 {money(summary.outstanding)}</p><p className="mt-2 text-xs text-muted-foreground">按手工记录计算，不代表银行核对结果；还款不扣预算。</p><div className="mt-3 flex flex-wrap gap-2">{summary.outstanding > 0 && <Button variant="outline" onClick={() => setForm('pay')}>登记实际还款</Button>}{!statement.creditAccountId && <Button variant="ghost" onClick={() => setForm('link')}>关联信用卡账户</Button>}</div>{summary.records.length > 0 && <ul className="mt-3 grid gap-3">{summary.records.map(r => <li key={r.id} className="min-w-0 rounded-lg bg-muted p-3 text-xs leading-6"><p className="break-words">{r.reference} · {r.paidOn} · {money(r.amount)} · {r.status === 'recorded' ? '有效还款' : '已撤销还款'}</p>{r.status === 'recorded' ? <Button variant="ghost" onClick={() => setCancelling(r)}>撤销还款记录</Button> : <p className="break-words">原因：{r.cancellationReason}</p>}</li>)}</ul>}{form && <RepaymentForm key={form} kind={form} statement={statement} close={() => setForm(null)} />}{cancelling && <CancelRepayment record={cancelling} close={() => setCancelling(null)} />}</div>;
}
function RepaymentForm({ kind, statement, close }: { kind: 'pay' | 'link'; statement: Statement; close: () => void }) {
  const { ledger, execute } = useLedger();
  const [id] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [target, setTarget] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const summary = repaymentSummary(ledger, statement);
  return <Modal title={kind === 'pay' ? '登记实际还款' : '关联信用卡账户'} close={close}><form className="grid gap-5" onSubmit={e => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    if (kind === 'link' && !confirmed) { setConfirmed(true); return; }
    const failure = execute(l => {
      if (kind === 'link') return linkStatementAccount(l, statement.id, target, text('reason'));
      const amount = parseMoney(text('amount'));
      if (amount === null || amount <= 0) throw new Error('请输入有效正数金额，最多两位小数且不超过一亿元');
      return recordRepayment(l, { id, statementId: statement.id, reference: text('reference'), paidOn: text('date'), amount });
    });
    if (failure) setError(failure); else close();
  }}><p className="break-words text-sm leading-7">{accountName(ledger, statement)} · {statement.fingerprint}<br />账单 {money(statement.amount)} · 已还 {money(summary.paid)} · 未还 {money(summary.outstanding)}</p>{kind === 'pay' ? <><p className="text-sm leading-7">仅登记已发生的实际还款，可分次记录。累计不能超过账单总额，不改变预算结算。录错可撤销并保留原因。</p><Field label="还款标识" hint="填写本次还款批次，账单内唯一；撤销后也不可复用"><Input name="reference" required maxLength={100} /></Field><Field label="实际还款日期"><Input name="date" type="date" required /></Field><Field label="实际还款金额（元）"><Input name="amount" inputMode="decimal" required value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></Field><Button type="button" variant="outline" onClick={() => { const cents = BigInt(summary.outstanding); setPaymentAmount(`${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`); }}>填入当前未还金额</Button><p className="text-xs text-muted-foreground">填充仅修改输入，仍需填写实际日期、唯一标识并确认；提交时按最新账单重新校验。</p></> : <><p className="text-sm leading-7">原账户文字「{statement.accountId}」将保留。这里只建立关联，不合并账单、不改变金额和还款记录。</p><Field label="目标信用卡账户"><Select value={target} required onChange={e => { setTarget(e.target.value); setConfirmed(false); }}><option value="">请选择启用账户</option>{ledger.credit?.accounts.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field><Field label="关联原因"><Input name="reason" required maxLength={200} onChange={() => setConfirmed(false)} /></Field>{confirmed && <p role="status">确认将此账单关联到「{ledger.credit?.accounts.find(a => a.id === target)?.name}」。如目标已有同标识账单，将拒绝关联。</p>}</>}{error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}<div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={close}>取消</Button><Button type="submit">{kind === 'pay' ? '确认记录还款' : confirmed ? '确认关联账户' : '预览账户关联'}</Button></div></form></Modal>;
}
function CancelRepayment({ record, close }: { record: Repayment; close: () => void }) {
  const { execute } = useLedger();
  const [error, setError] = useState('');
  return <Modal title="撤销还款记录" close={close}><form className="grid gap-5" onSubmit={e => {
    e.preventDefault(); const reason = String(new FormData(e.currentTarget).get('reason') ?? '');
    const failure = execute(l => cancelRepayment(l, record.id, reason));
    if (failure) setError(failure); else close();
  }}><p className="text-sm leading-7">撤销 {record.reference} · {money(record.amount)} 的手工记录，未还金额将重新计算。保留原记录及原因，不改变预算、不代表银行退款。</p><Field label="还款撤销原因"><Input name="reason" required maxLength={200} /></Field>{error && <p role="alert">{error}</p>}<Button type="submit">确认撤销还款</Button></form></Modal>;
}
