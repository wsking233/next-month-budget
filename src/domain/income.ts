import { allocateIncome, type BudgetLedger, type AuditEvent } from './budget';
import { exactSum } from './analytics';

export type PlanLine = { poolId: string; amount: number };
export type BudgetTemplate = { allocations: PlanLine[]; plannedSavings: number };
export type IncomeRecord = {
  id: string; periodId: string; reference: string; receivedOn: string; amount: number;
  plannedSavings: number; allocations: (PlanLine & { entryId: string })[];
  status: 'applied' | 'cancelled'; cancellationReason?: string;
};
export type IncomePlanning = { template: BudgetTemplate; incomes: IncomeRecord[] };
export const emptyPlanning = (): IncomePlanning => ({ template: { allocations: [], plannedSavings: 0 }, incomes: [] });
function amount(value: number, allowZero = true) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) throw new Error('金额须为有效的非负整数分，收入须大于零');
}
function audit(ledger: BudgetLedger, kind: AuditEvent['kind'], subjectId: string, description: string, reason?: string): AuditEvent[] {
  return [...ledger.audit, { id: `${kind}:${subjectId}:${ledger.audit.length + 1}`, kind, subjectId, description, createdAt: new Date().toISOString(), ...(reason ? { reason } : {}) }];
}
function lines(ledger: BudgetLedger, allocations: PlanLine[], savings: number) {
  amount(savings);
  const ids = new Set<string>();
  for (const line of allocations) {
    if (ids.has(line.poolId) || !ledger.pools.some(p => p.id === line.poolId && p.active)) throw new Error('拨款资金池不存在、停用或重复');
    ids.add(line.poolId); amount(line.amount, false);
  }
  return exactSum([savings, ...allocations.map(a => a.amount)]);
}
export function saveBudgetTemplate(ledger: BudgetLedger, template: BudgetTemplate): BudgetLedger {
  lines(ledger, template.allocations, template.plannedSavings);
  return { ...ledger, planning: { ...(ledger.planning ?? emptyPlanning()), template: structuredClone(template) }, audit: audit(ledger, 'budget_template_saved', 'fixed', `保存固定金额模板；计划储蓄 ${format(template.plannedSavings)}；拨款 ${template.allocations.map(a => `${ledger.pools.find(p => p.id === a.poolId)?.name} ${format(a.amount)}`).join('、') || '无'}`) };
}
export function applyIncome(ledger: BudgetLedger, input: Omit<IncomeRecord, 'status' | 'allocations' | 'cancellationReason'> & { allocations: PlanLine[] }): BudgetLedger {
  const planning = ledger.planning ?? emptyPlanning();
  const reference = input.reference.trim();
  if (!input.id.trim() || planning.incomes.some(i => i.id === input.id)) throw new Error('收入标识无效或已使用');
  if (!reference || reference.length > 200 || planning.incomes.some(i => i.periodId === input.periodId && i.reference === reference)) throw new Error('收入标识不能为空或在此周期内重复；已撤销记录也保留标识');
  if (!ledger.periods.some(p => p.id === input.periodId)) throw new Error('请选择有效预算周期');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn) || !Number.isFinite(Date.parse(`${input.receivedOn}T00:00:00Z`)) || new Date(`${input.receivedOn}T00:00:00Z`).toISOString().slice(0, 10) !== input.receivedOn) throw new Error('收入日期无效');
  amount(input.amount, false);
  if (lines(ledger, input.allocations, input.plannedSavings) > input.amount) throw new Error('收入不足以覆盖拨款和计划储蓄，请手动调整后重新核对');
  exactSum([input.amount, ...planning.incomes.filter(i => i.status === 'applied').map(i => i.amount)]);
  let next = ledger;
  const allocations = input.allocations.map((line, index) => ({ ...line, entryId: `income:${input.id}:${index}` }));
  for (const line of allocations) next = allocateIncome(next, { id: line.entryId, periodId: input.periodId, poolId: line.poolId, amount: line.amount });
  const record: IncomeRecord = { id: input.id, reference, receivedOn: input.receivedOn, periodId: input.periodId, amount: input.amount, plannedSavings: input.plannedSavings, allocations, status: 'applied' };
  return { ...next, planning: { ...planning, incomes: [...planning.incomes, record] }, audit: audit(next, 'income_recorded', input.id, `${reference} · 周期 ${ledger.periods.find(p => p.id === input.periodId)?.name || input.periodId} · 收入 ${format(input.amount)} · 计划储蓄 ${format(input.plannedSavings)} · 拨款 ${allocations.map(a => `${ledger.pools.find(p => p.id === a.poolId)?.name} ${format(a.amount)}`).join('、') || '无'}；不是实际储蓄`) };
}
export function cancelIncome(ledger: BudgetLedger, id: string, reason: string): BudgetLedger {
  const planning = ledger.planning ?? emptyPlanning(), income = planning.incomes.find(i => i.id === id);
  if (!income || income.status !== 'applied') throw new Error('收入不存在或已经撤销');
  if (!reason.trim() || reason.trim().length > 200) throw new Error('请填写不超过200字的撤销原因');
  const entries = [...ledger.entries, ...income.allocations.map(a => ({ id: `income-cancel:${a.entryId}`, sourceId: a.entryId, poolId: a.poolId, periodId: income.periodId, kind: 'income_reversal' as const, amount: -a.amount }))];
  if (new Set(entries.map(e => e.id)).size !== entries.length) throw new Error('冲销流水标识已被占用');
  // Cancellation may make later budgets negative, but may never overflow integer bounds.
  for (const period of ledger.periods) for (const pool of ledger.pools) {
    const through = new Set(ledger.periods.filter(p => p.startsOn <= period.startsOn).map(p => p.id));
    exactSum(entries.filter(e => through.has(e.periodId) && e.poolId === pool.id).map(e => e.amount));
    exactSum(entries.filter(e => through.has(e.periodId)).map(e => e.amount));
    exactSum(entries.filter(e => e.periodId === period.id && e.poolId === pool.id).map(e => e.amount));
  }
  return { ...ledger, entries, planning: { ...planning, incomes: planning.incomes.map(i => i.id === id ? { ...i, status: 'cancelled', cancellationReason: reason.trim() } : i) }, audit: audit(ledger, 'income_cancelled', id, `撤销收入 ${income.reference} 及其拨款；保留结算支出和原始记录；计划储蓄不代表现金`, reason.trim()) };
}

function format(amount: number) { const value = BigInt(amount); return `¥${value / 100n}.${String(value % 100n).padStart(2, '0')}`; }
