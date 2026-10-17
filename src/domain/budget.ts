export type MoneyCents = number;

export type BudgetPeriod = {
  id: string;
  name?: string;
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
  statementOn?: string;
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
    | 'pool_updated'
    | 'statement_revised'
    | 'income_allocated'
    | 'statement_recorded'
    | 'statement_settled'
    | 'budget_transferred'
    | 'settlement_cancelled'
    | 'settlement_corrected';
  subjectId: string;
  createdAt: string;
  description: string;
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
    audit: appendAudit(ledger, 'period_created', period.id, undefined, `${period.name || period.id} · ${period.startsOn} — ${period.endsOn}`),
  };
}

export function createBudgetPool(ledger: BudgetLedger, pool: NewPool): BudgetLedger {
  assertUniqueId(ledger.pools, pool.id, '资金池');
  assertPoolName(ledger, pool.name);
  return {
    ...ledger,
    pools: [...ledger.pools, { ...pool, name: pool.name.trim(), active: pool.active ?? true }],
    audit: appendAudit(ledger, 'pool_created', pool.id, undefined, `${pool.name.trim()}（未拨款）`),
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
    entries: checkedEntries(ledger, [entry]),
    audit: appendAudit(ledger, 'income_allocated', allocation.id, undefined, describeEntry(ledger, allocation)),
  };
}

export function recordStatement(ledger: BudgetLedger, statement: NewStatement): BudgetLedger {
  assertUniqueId(ledger.statements, statement.id, '账单');
  const normalized = validateStatement(ledger, statement);
  return {
    ...ledger,
    statements: [...ledger.statements, { ...normalized, status: 'recorded', allocations: [] }],
    audit: appendAudit(ledger, 'statement_recorded', statement.id, undefined, describeStatement(normalized)),
  };
}

export function settleStatement(ledger: BudgetLedger, statementId: string, allocations: Allocation[]): BudgetLedger {
  const statement = requireStatement(ledger, statementId);
  if (statement.status === 'settled') throw new Error('账单已经结算，不能重复结算');
  if (statement.status === 'cancelled') throw new Error('已取消账单不能直接结算');
  validateAllocations(ledger, statement, allocations);
  const entries = allocations.map<BudgetEntry>((allocation) => ({
    id: `settlement:${statement.id}:${ledger.audit.length}:${allocation.id}`,
    poolId: allocation.poolId,
    periodId: allocation.periodId,
    amount: -allocation.amount,
    kind: 'statement_settlement',
    sourceId: statement.id,
  }));
  return {
    ...ledger,
    statements: replaceStatement(ledger, { ...statement, status: 'settled', allocations: allocations.map((item) => ({ ...item })) }),
    entries: checkedEntries(ledger, entries),
    audit: appendAudit(ledger, 'statement_settled', statement.id, undefined, `${describeStatement(statement)}；分配：${describeAllocations(ledger, allocations)}`),
  };
}

export function transferBudget(ledger: BudgetLedger, transfer: Transfer): BudgetLedger {
  if (!transfer.id.trim()) throw new Error('调拨 ID 不能为空');
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
    entries: checkedEntries(ledger, entries),
    audit: appendAudit(ledger, 'budget_transferred', transfer.id, transfer.reason.trim(), `${requirePool(ledger, transfer.fromPoolId).name} → ${requirePool(ledger, transfer.toPoolId).name} · ${requirePeriod(ledger, transfer.periodId).name || transfer.periodId} · ${formatAmount(transfer.amount)}`),
  };
}

export function cancelSettlement(ledger: BudgetLedger, statementId: string, reason: string): BudgetLedger {
  const statement = requireStatement(ledger, statementId);
  if (statement.status !== 'settled') throw new Error('只有已结算账单可以取消');
  if (!reason.trim()) throw new Error('取消原因不能为空');
  const reversals = settlementReversals(statement, `cancel:${statement.id}:${ledger.audit.length}`);
  return {
    ...ledger,
    statements: replaceStatement(ledger, { ...statement, status: 'cancelled' }),
    entries: checkedEntries(ledger, reversals),
    audit: appendAudit(ledger, 'settlement_cancelled', statement.id, reason.trim(), `${describeStatement(statement)}；冲销：${describeAllocations(ledger, statement.allocations)}`),
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
    entries: checkedEntries(ledger, [...reversals, ...replacements]),
    audit: appendAudit(ledger, 'settlement_corrected', statement.id, reason.trim(), `${describeStatement(statement)}；原分配：${describeAllocations(ledger, statement.allocations)}；新分配：${describeAllocations(ledger, allocations)}`),
  };
}

export function getPoolBalance(ledger: BudgetLedger, poolId: string, throughPeriodId: string): MoneyCents {
  requirePool(ledger, poolId);
  const throughPeriod = requirePeriod(ledger, throughPeriodId);
  const includedPeriods = new Set(ledger.periods.filter((period) => period.startsOn <= throughPeriod.startsOn).map((period) => period.id));
  const total = ledger.entries
    .filter((entry) => entry.poolId === poolId && includedPeriods.has(entry.periodId))
    .reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
  return Number(total);
}

function validateAllocations(ledger: BudgetLedger, statement: Statement, allocations: Allocation[]) {
  if (allocations.length === 0) throw new Error('账单至少需要一条分配');
  const ids = new Set<string>();
  for (const allocation of allocations) {
    if (!allocation.id.trim()) throw new Error('分配 ID 不能为空');
    if (ids.has(allocation.id)) throw new Error('分配 ID 不能重复');
    ids.add(allocation.id);
    assertPeriodAndPool(ledger, allocation.periodId, allocation.poolId);
    assertPositiveMoney(allocation.amount);
  }
  const total = allocations.reduce((sum, allocation) => sum + BigInt(allocation.amount), 0n);
  if (total !== BigInt(statement.amount)) throw new Error('分配总额必须与账单总额一致');
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

function appendAudit(ledger: BudgetLedger, kind: AuditEvent['kind'], subjectId: string, reason?: string, description = subjectId) {
  return [...ledger.audit, { id: `${kind}:${subjectId}:${ledger.audit.length + 1}`, kind, subjectId, reason, description, createdAt: new Date().toISOString() }];
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`${label}必须是有效的 YYYY-MM-DD 日期`);
  }
}


export function updateBudgetPool(ledger: BudgetLedger, poolId: string, name: string, active: boolean, throughPeriodId: string): BudgetLedger {
  const pool = requirePool(ledger, poolId);
  assertPoolName(ledger, name, poolId);
  if (pool.active && !active) {
    const period = requirePeriod(ledger, throughPeriodId);
    if (ledger.entries.some(entry => entry.poolId === poolId && requirePeriod(ledger, entry.periodId).startsOn > period.startsOn)) throw new Error('请先处理未来周期的资金池安排');
    if (getPoolBalance(ledger, poolId, throughPeriodId) !== 0) throw new Error('资金池余额须先清零，才能停用');
  }
  return { ...ledger, pools: ledger.pools.map(p => p.id === poolId ? { ...p, name: name.trim(), active } : p), audit: appendAudit(ledger, 'pool_updated', poolId, undefined, `${pool.name} → ${name.trim()} · ${active ? '启用' : '停用'}；历史流水保留`) };
}

export function reviseStatement(ledger: BudgetLedger, statementId: string, patch: Omit<NewStatement, 'id'>, reason: string): BudgetLedger {
  const before = requireStatement(ledger, statementId);
  if (before.status === 'settled') throw new Error('已结算账单修改资料前须先撤销结算；只改分类可用更正分配');
  if (!reason.trim()) throw new Error('修改原因不能为空');
  const normalized = validateStatement(ledger, { ...patch, id: statementId });
  return { ...ledger, statements: replaceStatement(ledger, { ...normalized, status: 'recorded', allocations: [] }), audit: appendAudit(ledger, 'statement_revised', statementId, reason.trim(), `原：${describeStatement(before)}；新：${describeStatement(normalized)}；状态改为待分配`) };
}

function validateStatement(ledger: BudgetLedger, statement: NewStatement): NewStatement {
  assertPositiveMoney(statement.amount);
  assertIsoDate(statement.dueOn, '还款日期');
  if (statement.statementOn) {
    assertIsoDate(statement.statementOn, '账单日期');
    if (statement.statementOn > statement.dueOn) throw new Error('还款日不能早于账单日');
  }
  const accountId = statement.accountId.trim(), fingerprint = statement.fingerprint.trim();
  if (!accountId || !fingerprint) throw new Error('账单账户和去重标识不能为空');
  if (ledger.statements.some(item => item.id !== statement.id && item.accountId === accountId && item.fingerprint === fingerprint)) throw new Error('检测到重复账单');
  const aggregate = ledger.statements.filter(s => s.id !== statement.id).reduce((sum, s) => sum + BigInt(s.amount), BigInt(statement.amount));
  if (aggregate > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('账单累计金额超出安全整数范围');
  return { ...statement, accountId, fingerprint };
}
function assertPoolName(ledger: BudgetLedger, name: string, exceptId?: string) {
  if (!name.trim()) throw new Error('资金池名称不能为空');
  if (ledger.pools.some(p => p.id !== exceptId && p.name === name.trim())) throw new Error('资金池名称不能重复');
}
function checkedEntries(ledger: BudgetLedger, additions: BudgetEntry[]): BudgetEntry[] {
  const ids = new Set(ledger.entries.map(entry => entry.id));
  for (const entry of additions) {
    if (!entry.id.trim() || ids.has(entry.id)) throw new Error('预算流水 ID 已存在或为空');
    ids.add(entry.id);
  }
  const entries = [...ledger.entries, ...additions];
  // Check each period's cumulative balance, including historical corrections.
  // BigInt prevents an unsafe intermediate sum from silently rounding.
  const chronological = [...ledger.periods].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  let ledgerTotal = 0n;
  const balances = new Map<string, bigint>();
  for (const period of chronological) {
    let periodFunding = 0n;
    const changes = new Map<string, bigint>();
    for (const entry of entries.filter(e => e.periodId === period.id)) {
      const amount = BigInt(entry.amount);
      balances.set(entry.poolId, (balances.get(entry.poolId) ?? 0n) + amount);
      changes.set(entry.poolId, (changes.get(entry.poolId) ?? 0n) + amount);
      ledgerTotal += amount;
      if (entry.kind === 'income_allocation') periodFunding += amount;
    }
    for (const total of [...balances.values(), ...changes.values(), ledgerTotal, periodFunding]) {
      if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('累计金额超出安全整数范围');
    }
  }
  return entries;
}
function formatAmount(amount: number) { const cents = BigInt(amount); return `¥${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`; }
function describeStatement(statement: NewStatement) { return `${statement.accountId} · ${statement.fingerprint} · ${formatAmount(statement.amount)} · 账单日 ${statement.statementOn || '未记录'} · 还款日 ${statement.dueOn}`; }
function describeEntry(ledger: BudgetLedger, entry: IncomeAllocation) { return `${requirePool(ledger, entry.poolId).name} · ${requirePeriod(ledger, entry.periodId).name || entry.periodId} · ${formatAmount(entry.amount)}`; }
function describeAllocations(ledger: BudgetLedger, allocations: Allocation[]) { return allocations.map(a => describeEntry(ledger, a)).join('；'); }
