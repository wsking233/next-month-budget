import type { AuditEvent, BudgetLedger, Statement } from './budget';
import { exactSum } from './analytics';
export type CreditAccount = { id: string; name: string; active: boolean };
export type Repayment = { id: string; statementId: string; reference: string; paidOn: string; amount: number; status: 'recorded' | 'cancelled'; cancellationReason?: string };
export type CreditBook = { accounts: CreditAccount[]; repayments: Repayment[] };
export const emptyCredit = (): CreditBook => ({ accounts: [], repayments: [] });
const describeMoney = (amount: number) => { const value = BigInt(amount); return `¥${value / 100n}.${String(value % 100n).padStart(2, '0')}`; };
function audit(ledger: BudgetLedger, kind: AuditEvent['kind'], subjectId: string, description: string, reason?: string) {
  return [...ledger.audit, { id: `${kind}:${subjectId}:${ledger.audit.length + 1}`, kind, subjectId, description, createdAt: new Date().toISOString(), ...(reason ? { reason } : {}) }];
}
export function accountName(ledger: BudgetLedger, statement: Statement) { return ledger.credit?.accounts.find(a => a.id === statement.creditAccountId)?.name ?? statement.accountId; }
export function repaymentSummary(ledger: BudgetLedger, statement: Statement) {
  const records = (ledger.credit?.repayments ?? []).filter(r => r.statementId === statement.id);
  const paid = exactSum(records.filter(r => r.status === 'recorded').map(r => r.amount));
  return { records, paid, outstanding: statement.amount - paid, label: paid === 0 ? '还款未记录' : paid === statement.amount ? '已还清' : '部分已还' };
}
export function saveCreditAccount(ledger: BudgetLedger, input: CreditAccount): BudgetLedger {
  const credit = ledger.credit ?? emptyCredit();
  const name = input.name.trim();
  if (!input.id.trim() || !name || name.length > 40) throw new Error('账户名称不能为空且不能超过40字');
  if (credit.accounts.some(a => a.id !== input.id && a.name === name)) throw new Error('信用卡账户名称不能重复');
  const previous = credit.accounts.find(a => a.id === input.id);
  const account = { ...input, name };
  return { ...ledger, credit: { ...credit, accounts: previous ? credit.accounts.map(a => a.id === input.id ? account : a) : [...credit.accounts, account] }, audit: audit(ledger, previous ? 'credit_account_updated' : 'credit_account_created', input.id, `${previous ? `${previous.name} → ` : ''}${name} · ${input.active ? '启用' : '停用'}；历史账单及还款保留`) };
}
export function linkStatementAccount(ledger: BudgetLedger, statementId: string, accountId: string, reason: string): BudgetLedger {
  const statement = ledger.statements.find(s => s.id === statementId);
  const account = ledger.credit?.accounts.find(a => a.id === accountId && a.active);
  if (!statement || !account) throw new Error('账单或启用的信用卡账户不存在');
  if (statement.creditAccountId) throw new Error('账单已关联账户，不可重复关联');
  if (!reason.trim() || reason.trim().length > 200) throw new Error('请填写不超过200字的关联原因');
  if (ledger.statements.some(s => s.id !== statementId && s.creditAccountId === accountId && s.fingerprint === statement.fingerprint)) throw new Error('目标账户已有同标识账单，不能合并重复账单');
  return { ...ledger, statements: ledger.statements.map(s => s.id === statementId ? { ...s, creditAccountId: accountId } : s), audit: audit(ledger, 'statement_account_linked', statementId, `${statement.accountId} · ${statement.fingerprint} → ${account.name}；原名称与财务流水保留`, reason.trim()) };
}
export function recordRepayment(ledger: BudgetLedger, input: Omit<Repayment, 'status' | 'cancellationReason'>): BudgetLedger {
  const credit = ledger.credit ?? emptyCredit(), statement = ledger.statements.find(s => s.id === input.statementId);
  if (!statement) throw new Error('账单不存在');
  const reference = input.reference.trim();
  if (!input.id.trim() || credit.repayments.some(r => r.id === input.id)) throw new Error('还款记录标识已使用或无效');
  if (!reference || reference.length > 100 || credit.repayments.some(r => r.statementId === input.statementId && r.reference === reference)) throw new Error('还款标识不能为空或在此账单内重复；撤销后仍保留标识');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn) || !Number.isFinite(Date.parse(`${input.paidOn}T00:00:00Z`)) || new Date(`${input.paidOn}T00:00:00Z`).toISOString().slice(0, 10) !== input.paidOn) throw new Error('实际还款日期无效');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error('还款金额须为正整数分');
  if (BigInt(repaymentSummary(ledger, statement).paid) + BigInt(input.amount) > BigInt(statement.amount)) throw new Error('累计还款不能超过账单总额');
  exactSum([...credit.repayments.filter(r => r.status === 'recorded').map(r => r.amount), input.amount]);
  const record: Repayment = { ...input, reference, status: 'recorded' };
  return { ...ledger, credit: { ...credit, repayments: [...credit.repayments, record] }, audit: audit(ledger, 'repayment_recorded', input.id, `${accountName(ledger, statement)} · ${statement.fingerprint} · ${reference} · 实际还款 ${describeMoney(input.amount)} · ${input.paidOn}；不扣预算`) };
}
export function cancelRepayment(ledger: BudgetLedger, id: string, reason: string): BudgetLedger {
  const credit = ledger.credit ?? emptyCredit(), record = credit.repayments.find(r => r.id === id);
  if (!record || record.status !== 'recorded') throw new Error('还款不存在或已撤销');
  if (!reason.trim() || reason.trim().length > 200) throw new Error('请填写不超过200字的撤销原因');
  return { ...ledger, credit: { ...credit, repayments: credit.repayments.map(r => r.id === id ? { ...r, status: 'cancelled', cancellationReason: reason.trim() } : r) }, audit: audit(ledger, 'repayment_cancelled', id, `${record.reference} · 撤销已记录还款 ${describeMoney(record.amount)}；保留原记录，不改变预算，不代表银行退款`, reason.trim()) };
}
