export type MoneyCents = number;

export type BudgetPeriod = {
  id: string;
  startsOn: string;
  endsOn: string;
};

export type BudgetPool = {
  id: string;
  name: string;
  active: boolean;
};

export type Allocation = {
  id: string;
  poolId: string;
  periodId: string;
  amount: MoneyCents;
};

export type Statement = {
  id: string;
  accountId: string;
  fingerprint: string;
  amount: MoneyCents;
  dueOn: string;
  status: 'recorded' | 'settled' | 'cancelled';
  allocations: Allocation[];
};

export type BudgetEntry = {
  id: string;
  poolId: string;
  periodId: string;
  amount: MoneyCents;
  kind: 'income_allocation' | 'statement_settlement' | 'transfer_out' | 'transfer_in' | 'reversal';
  sourceId: string;
};

export type AuditEvent = {
  id: string;
  kind:
    | 'period_created'
    | 'pool_created'
    | 'income_allocated'
    | 'statement_recorded'
    | 'statement_settled'
    | 'budget_transferred'
    | 'settlement_cancelled'
    | 'settlement_corrected';
  subjectId: string;
  reason?: string;
};

export type BudgetLedger = {
  periods: BudgetPeriod[];
  pools: BudgetPool[];
  statements: Statement[];
  entries: BudgetEntry[];
  audit: AuditEvent[];
};

type NewPeriod = BudgetPeriod;
type NewPool = Omit<BudgetPool, 'active'> & { active?: boolean };
type NewStatement = Omit<Statement, 'status' | 'allocations'>;
type IncomeAllocation = Omit<BudgetEntry, 'kind' | 'sourceId'>;
type Transfer = {
  id: string;
  periodId: string;
  fromPoolId: string;
  toPoolId: string;
  amount: MoneyCents;
  reason: string;
};

export function createLedger(): BudgetLedger {
  return { periods: [], pools: [], statements: [], entries: [], audit: [] };
}

export function createBudgetPeriod(ledger: BudgetLedger, period: NewPeriod): BudgetLedger {
  assertUniqueId(ledger.periods, period.id, '预算周期');
  assertIsoDate(period.startsOn, '周期开始日期');
  assertIsoDate(period.endsOn, '周期结束日期');
  if (period.startsOn > period.endsOn) throw new Error('周期开始日期不能晚于结束日期');
  if (ledger.periods.some((item) => item.startsOn <= period.endsOn && period.startsOn <= item.endsOn)) {
    throw new Error('预算周期不能重叠');
  }
  return {
    ...ledger,
    periods: [...ledger.periods, { ...period }].sort((a, b) => a.startsOn.localeCompare(b.startsOn)),
    audit: appendAudit(ledger, 'period_created', period.id),
  };
}

export function createBudgetPool(ledger: BudgetLedger, pool: NewPool): BudgetLedger {
  assertUniqueId(ledger.pools, pool.id, '资金池');
  if (!pool.name.trim()) throw new Error('资金池名称不能为空');
  return {
    ...ledger,
    pools: [...ledger.pools, { ...pool, name: pool.name.trim(), active: pool.active ?? true }],
    audit: appendAudit(ledger, 'pool_created', pool.id),
  };
}

export function allocateIncome(ledger: BudgetLedger, allocation: IncomeAllocation): BudgetLedger {
  assertUniqueId(ledger.entries, allocation.id, '预算流水');
  assertPeriodAndPool(ledger, allocation.periodId, allocation.poolId);
  assertPositiveMoney(allocation.amount);
  const entry: BudgetEntry = {
    ...allocation,
    kind: 'income_allocation',
    sourceId: allocation.id,
  };
  return {
    ...ledger,
    entries: [...ledger.entries, entry],
    audit: appendAudit(ledger, 'income_allocated', allocation.id),
  };
}

export function recordStatement(ledger: BudgetLedger, statement: NewStatement): BudgetLedger {
  assertUniqueId(ledger.statements, statement.id, '账单');
  assertPositiveMoney(statement.amount);
  assertIsoDate(statement.dueOn, '还款日期');
  if (!statement.accountId.trim() || !statement.fingerprint.trim()) throw new Error('账单账户和去重标识不能为空');
  if (ledger.statements.some((item) => item.fingerprint === statement.fingerprint)) throw new Error('检测到重复账单');
  return {
    ...ledger,
    statements: [...ledger.statements, { ...statement, status: 'recorded', allocations: [] }],
    audit: appendAudit(ledger, 'statement_recorded', statement.id),
  };
}

export function settleStatement(ledger: BudgetLedger, statementId: string, allocations: Allocation[]): BudgetLedger {
  const statement = requireStatement(ledger, statementId);
  if (statement.status === 'settled') throw new Error('账单已经结算，不能重复结算');
  if (statement.status === 'cancelled') throw new Error('已取消账单不能直接结算');
  validateAllocations(ledger, statement, allocations);
  const entries = allocations.map<BudgetEntry>((allocation) => ({
    id: `settlement:${statement.id}:${allocation.id}`,
    poolId: allocation.poolId,
    periodId: allocation.periodId,
    amount: -allocation.amount,
    kind: 'statement_settlement',
    sourceId: statement.id,
  }));
  return {
    ...ledger,
    statements: replaceStatement(ledger, { ...statement, status: 'settled', allocations: allocations.map((item) => ({ ...item })) }),
    entries: [...ledger.entries, ...entries],
    audit: appendAudit(ledger, 'statement_settled', statement.id),
  };
}

export function transferBudget(ledger: BudgetLedger, transfer: Transfer): BudgetLedger {
  if (ledger.entries.some((entry) => entry.sourceId === transfer.id && (entry.kind === 'transfer_in' || entry.kind === 'transfer_out'))) {
    throw new Error('调拨 ID 已存在');
  }
  if (transfer.fromPoolId === transfer.toPoolId) throw new Error('调拨来源和去向不能相同');
  assertPeriodAndPool(ledger, transfer.periodId, transfer.fromPoolId);
  assertPeriodAndPool(ledger, transfer.periodId, transfer.toPoolId);
  assertPositiveMoney(transfer.amount);
  if (!transfer.reason.trim()) throw new Error('调拨原因不能为空');
  const entries: BudgetEntry[] = [
    { id: `${transfer.id}:out`, periodId: transfer.periodId, poolId: transfer.fromPoolId, amount: -transfer.amount, kind: 'transfer_out', sourceId: transfer.id },
    { id: `${transfer.id}:in`, periodId: transfer.periodId, poolId: transfer.toPoolId, amount: transfer.amount, kind: 'transfer_in', sourceId: transfer.id },
  ];
  return {
    ...ledger,
    entries: [...ledger.entries, ...entries],
    audit: appendAudit(ledger, 'budget_transferred', transfer.id, transfer.reason),
  };
}

export function cancelSettlement(ledger: BudgetLedger, statementId: string, reason: string): BudgetLedger {
  const statement = requireStatement(ledger, statementId);
  if (statement.status !== 'settled') throw new Error('只有已结算账单可以取消');
  if (!reason.trim()) throw new Error('取消原因不能为空');
  const reversals = settlementReversals(statement, `cancel:${statement.id}`);
  return {
    ...ledger,
    statements: replaceStatement(ledger, { ...statement, status: 'cancelled' }),
    entries: [...ledger.entries, ...reversals],
    audit: appendAudit(ledger, 'settlement_cancelled', statement.id, reason),
  };
}

export function correctSettlement(ledger: BudgetLedger, statementId: string, allocations: Allocation[], reason: string): BudgetLedger {
  const statement = requireStatement(ledger, statementId);
  if (statement.status !== 'settled') throw new Error('只有已结算账单可以更正');
  if (!reason.trim()) throw new Error('更正原因不能为空');
  validateAllocations(ledger, statement, allocations);
  const correctionVersion = ledger.audit.filter((event) => event.kind === 'settlement_corrected' && event.subjectId === statement.id).length + 1;
  const reversals = settlementReversals(statement, `correct:${statement.id}:${correctionVersion}`);
  const replacements = allocations.map<BudgetEntry>((allocation) => ({
    id: `correction:${statement.id}:${correctionVersion}:${allocation.id}`,
    poolId: allocation.poolId,
    periodId: allocation.periodId,
    amount: -allocation.amount,
    kind: 'statement_settlement',
    sourceId: statement.id,
  }));
  return {
    ...ledger,
    statements: replaceStatement(ledger, { ...statement, allocations: allocations.map((item) => ({ ...item })) }),
    entries: [...ledger.entries, ...reversals, ...replacements],
    audit: appendAudit(ledger, 'settlement_corrected', statement.id, reason),
  };
}

export function getPoolBalance(ledger: BudgetLedger, poolId: string, throughPeriodId: string): MoneyCents {
  requirePool(ledger, poolId);
  const throughPeriod = requirePeriod(ledger, throughPeriodId);
  const includedPeriods = new Set(ledger.periods.filter((period) => period.startsOn <= throughPeriod.startsOn).map((period) => period.id));
  return ledger.entries
    .filter((entry) => entry.poolId === poolId && includedPeriods.has(entry.periodId))
    .reduce((total, entry) => total + entry.amount, 0);
}

function validateAllocations(ledger: BudgetLedger, statement: Statement, allocations: Allocation[]) {
  if (allocations.length === 0) throw new Error('账单至少需要一条分配');
  const ids = new Set<string>();
  for (const allocation of allocations) {
    if (ids.has(allocation.id)) throw new Error('分配 ID 不能重复');
    ids.add(allocation.id);
    assertPeriodAndPool(ledger, allocation.periodId, allocation.poolId);
    assertPositiveMoney(allocation.amount);
  }
  const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (total !== statement.amount) throw new Error('分配总额必须与账单总额一致');
}

function settlementReversals(statement: Statement, prefix: string): BudgetEntry[] {
  return statement.allocations.map((allocation) => ({
    id: `${prefix}:${allocation.id}`,
    poolId: allocation.poolId,
    periodId: allocation.periodId,
    amount: allocation.amount,
    kind: 'reversal',
    sourceId: statement.id,
  }));
}

function replaceStatement(ledger: BudgetLedger, replacement: Statement) {
  return ledger.statements.map((statement) => statement.id === replacement.id ? replacement : statement);
}

function appendAudit(ledger: BudgetLedger, kind: AuditEvent['kind'], subjectId: string, reason?: string) {
  return [...ledger.audit, { id: `${kind}:${subjectId}:${ledger.audit.length + 1}`, kind, subjectId, reason }];
}

function assertPeriodAndPool(ledger: BudgetLedger, periodId: string, poolId: string) {
  requirePeriod(ledger, periodId);
  const pool = requirePool(ledger, poolId);
  if (!pool.active) throw new Error('资金池已停用');
}

function requirePeriod(ledger: BudgetLedger, id: string) {
  const period = ledger.periods.find((item) => item.id === id);
  if (!period) throw new Error(`预算周期不存在：${id}`);
  return period;
}

function requirePool(ledger: BudgetLedger, id: string) {
  const pool = ledger.pools.find((item) => item.id === id);
  if (!pool) throw new Error(`资金池不存在：${id}`);
  return pool;
}

function requireStatement(ledger: BudgetLedger, id: string) {
  const statement = ledger.statements.find((item) => item.id === id);
  if (!statement) throw new Error(`账单不存在：${id}`);
  return statement;
}

function assertUniqueId(items: { id: string }[], id: string, label: string) {
  if (!id.trim()) throw new Error(`${label} ID 不能为空`);
  if (items.some((item) => item.id === id)) throw new Error(`${label} ID 已存在`);
}

function assertPositiveMoney(amount: MoneyCents) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('金额必须是大于零的整数分');
}

function assertIsoDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label}必须是有效的 YYYY-MM-DD 日期`);
  }
}
