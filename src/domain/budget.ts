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
  regularAllocation?: MoneyCents;
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
  status: "recorded" | "settled" | "cancelled";
  allocations: Allocation[];
};

export type BudgetEntry = {
  id: string;
  poolId: string;
  periodId: string;
  amount: MoneyCents;
  kind:
    | "income_allocation"
    | "statement_settlement"
    | "transfer_out"
    | "transfer_in"
    | "reversal";
  sourceId: string;
};

export type AuditEvent = {
  id: string;
  kind:
    | "period_created"
    | "pool_created"
    | "income_allocated"
    | "statement_recorded"
    | "statement_settled"
    | "budget_transferred"
    | "settlement_cancelled"
    | "settlement_corrected"
    | "pool_updated"
    | "statement_updated"
    | "statement_reopened"
    | "repayment_recorded"
    | "repayment_voided";
  subjectId: string;
  reason?: string;
  createdAt: string;
  detail?: string;
};

export type Repayment = {
  id: string;
  statementId: string;
  amount: MoneyCents;
  paidOn: string;
  voided?: boolean;
};

export type BudgetLedger = {
  periods: BudgetPeriod[];
  pools: BudgetPool[];
  statements: Statement[];
  entries: BudgetEntry[];
  audit: AuditEvent[];
  repayments: Repayment[];
};

type NewPeriod = BudgetPeriod;
type NewPool = Omit<BudgetPool, "active"> & { active?: boolean };
type NewStatement = Omit<Statement, "status" | "allocations">;
type IncomeAllocation = Omit<BudgetEntry, "kind" | "sourceId">;
type Transfer = {
  id: string;
  periodId: string;
  fromPoolId: string;
  toPoolId: string;
  amount: MoneyCents;
  reason: string;
};

export function createLedger(): BudgetLedger {
  return {
    periods: [],
    pools: [],
    statements: [],
    entries: [],
    audit: [],
    repayments: [],
  };
}

export function createBudgetPeriod(
  ledger: BudgetLedger,
  period: NewPeriod,
): BudgetLedger {
  assertUniqueId(ledger.periods, period.id, "预算周期");
  assertIsoDate(period.startsOn, "周期开始日期");
  assertIsoDate(period.endsOn, "周期结束日期");
  if (period.startsOn > period.endsOn)
    throw new Error("周期开始日期不能晚于结束日期");
  if (
    ledger.periods.some(
      (item) =>
        item.startsOn <= period.endsOn && period.startsOn <= item.endsOn,
    )
  ) {
    throw new Error("预算周期不能重叠");
  }
  return {
    ...ledger,
    periods: [...ledger.periods, { ...period }].sort((a, b) =>
      a.startsOn.localeCompare(b.startsOn),
    ),
    audit: appendAudit(ledger, "period_created", period.id),
  };
}

export function createBudgetPool(
  ledger: BudgetLedger,
  pool: NewPool,
): BudgetLedger {
  assertUniqueId(ledger.pools, pool.id, "资金池");
  validatePoolName(ledger, pool.name);
  if (pool.regularAllocation !== undefined)
    assertNonNegativeMoney(pool.regularAllocation);
  return {
    ...ledger,
    pools: [
      ...ledger.pools,
      { ...pool, name: pool.name.trim(), active: pool.active ?? true },
    ],
    audit: appendAudit(
      ledger,
      "pool_created",
      pool.id,
      undefined,
      pool.name.trim(),
    ),
  };
}

export function allocateIncome(
  ledger: BudgetLedger,
  allocation: IncomeAllocation,
): BudgetLedger {
  assertUniqueId(ledger.entries, allocation.id, "预算流水");
  assertPeriodAndPool(ledger, allocation.periodId, allocation.poolId);
  assertPositiveMoney(allocation.amount);
  sumMoney([
    ...ledger.entries
      .filter((e) => e.poolId === allocation.poolId)
      .map((e) => e.amount),
    allocation.amount,
  ]);
  const entry: BudgetEntry = {
    ...allocation,
    kind: "income_allocation",
    sourceId: allocation.id,
  };
  return {
    ...ledger,
    entries: [...ledger.entries, entry],
    audit: appendAudit(ledger, "income_allocated", allocation.id),
  };
}

export function recordStatement(
  ledger: BudgetLedger,
  statement: NewStatement,
): BudgetLedger {
  assertUniqueId(ledger.statements, statement.id, "账单");
  assertPositiveMoney(statement.amount);
  assertIsoDate(statement.dueOn, "还款日期");
  if (!statement.accountId.trim() || !statement.fingerprint.trim())
    throw new Error("账单账户和去重标识不能为空");
  const normalized = {
    ...statement,
    accountId: statement.accountId.trim(),
    fingerprint: statement.fingerprint.trim(),
  };
  if (
    ledger.statements.some(
      (item) => item.fingerprint === normalized.fingerprint,
    )
  )
    throw new Error("检测到重复账单");
  return {
    ...ledger,
    statements: [
      ...ledger.statements,
      { ...normalized, status: "recorded", allocations: [] },
    ],
    audit: appendAudit(
      ledger,
      "statement_recorded",
      statement.id,
      undefined,
      `${normalized.accountId} · ${normalized.fingerprint} · ${normalized.amount}分 · 到期${normalized.dueOn}`,
    ),
  };
}

export function settleStatement(
  ledger: BudgetLedger,
  statementId: string,
  allocations: Allocation[],
): BudgetLedger {
  const statement = requireStatement(ledger, statementId);
  if (statement.status === "settled")
    throw new Error("账单已经结算，不能重复结算");
  if (statement.status === "cancelled")
    throw new Error("已取消账单不能直接结算");
  validateAllocations(ledger, statement, allocations);
  const entries = allocations.map<BudgetEntry>((allocation) => ({
    id: `settlement:${statement.id}:${ledger.audit.length}:${allocation.id}`,
    poolId: allocation.poolId,
    periodId: allocation.periodId,
    amount: -allocation.amount,
    kind: "statement_settlement",
    sourceId: statement.id,
  }));
  return {
    ...ledger,
    statements: replaceStatement(ledger, {
      ...statement,
      status: "settled",
      allocations: allocations.map((item) => ({ ...item })),
    }),
    entries: [...ledger.entries, ...entries],
    audit: appendAudit(ledger, "statement_settled", statement.id),
  };
}

export function transferBudget(
  ledger: BudgetLedger,
  transfer: Transfer,
): BudgetLedger {
  if (
    ledger.entries.some(
      (entry) =>
        entry.sourceId === transfer.id &&
        (entry.kind === "transfer_in" || entry.kind === "transfer_out"),
    )
  ) {
    throw new Error("调拨 ID 已存在");
  }
  if (transfer.fromPoolId === transfer.toPoolId)
    throw new Error("调拨来源和去向不能相同");
  assertPeriodAndPool(ledger, transfer.periodId, transfer.fromPoolId);
  assertPeriodAndPool(ledger, transfer.periodId, transfer.toPoolId);
  assertPositiveMoney(transfer.amount);
  if (!transfer.reason.trim()) throw new Error("调拨原因不能为空");
  const entries: BudgetEntry[] = [
    {
      id: `${transfer.id}:out`,
      periodId: transfer.periodId,
      poolId: transfer.fromPoolId,
      amount: -transfer.amount,
      kind: "transfer_out",
      sourceId: transfer.id,
    },
    {
      id: `${transfer.id}:in`,
      periodId: transfer.periodId,
      poolId: transfer.toPoolId,
      amount: transfer.amount,
      kind: "transfer_in",
      sourceId: transfer.id,
    },
  ];
  return {
    ...ledger,
    entries: [...ledger.entries, ...entries],
    audit: appendAudit(
      ledger,
      "budget_transferred",
      transfer.id,
      transfer.reason,
    ),
  };
}

export function cancelSettlement(
  ledger: BudgetLedger,
  statementId: string,
  reason: string,
): BudgetLedger {
  const statement = requireStatement(ledger, statementId);
  if (statement.status !== "settled") throw new Error("只有已结算账单可以取消");
  if (!reason.trim()) throw new Error("取消原因不能为空");
  const reversals = settlementReversals(
    statement,
    `cancel:${statement.id}:${ledger.audit.length}`,
  );
  return {
    ...ledger,
    statements: replaceStatement(ledger, { ...statement, status: "cancelled" }),
    entries: [...ledger.entries, ...reversals],
    audit: appendAudit(ledger, "settlement_cancelled", statement.id, reason),
  };
}

export function correctSettlement(
  ledger: BudgetLedger,
  statementId: string,
  allocations: Allocation[],
  reason: string,
): BudgetLedger {
  const statement = requireStatement(ledger, statementId);
  if (statement.status !== "settled") throw new Error("只有已结算账单可以更正");
  if (!reason.trim()) throw new Error("更正原因不能为空");
  validateAllocations(ledger, statement, allocations);
  const correctionVersion =
    ledger.audit.filter(
      (event) =>
        event.kind === "settlement_corrected" &&
        event.subjectId === statement.id,
    ).length + 1;
  const reversals = settlementReversals(
    statement,
    `correct:${statement.id}:${correctionVersion}`,
  );
  const replacements = allocations.map<BudgetEntry>((allocation) => ({
    id: `correction:${statement.id}:${correctionVersion}:${allocation.id}`,
    poolId: allocation.poolId,
    periodId: allocation.periodId,
    amount: -allocation.amount,
    kind: "statement_settlement",
    sourceId: statement.id,
  }));
  return {
    ...ledger,
    statements: replaceStatement(ledger, {
      ...statement,
      allocations: allocations.map((item) => ({ ...item })),
    }),
    entries: [...ledger.entries, ...reversals, ...replacements],
    audit: appendAudit(ledger, "settlement_corrected", statement.id, reason),
  };
}

export function getPoolBalance(
  ledger: BudgetLedger,
  poolId: string,
  throughPeriodId: string,
): MoneyCents {
  requirePool(ledger, poolId);
  const throughPeriod = requirePeriod(ledger, throughPeriodId);
  const includedPeriods = new Set(
    ledger.periods
      .filter((period) => period.startsOn <= throughPeriod.startsOn)
      .map((period) => period.id),
  );
  return sumMoney(
    ledger.entries
      .filter(
        (entry) =>
          entry.poolId === poolId && includedPeriods.has(entry.periodId),
      )
      .map((entry) => entry.amount),
  );
}

function validateAllocations(
  ledger: BudgetLedger,
  statement: Statement,
  allocations: Allocation[],
) {
  if (allocations.length === 0) throw new Error("账单至少需要一条分配");
  const ids = new Set<string>();
  for (const allocation of allocations) {
    if (ids.has(allocation.id)) throw new Error("分配 ID 不能重复");
    ids.add(allocation.id);
    assertPeriodAndPool(ledger, allocation.periodId, allocation.poolId);
    assertPositiveMoney(allocation.amount);
  }
  const total = sumMoney(allocations.map((allocation) => allocation.amount));
  if (total !== statement.amount) throw new Error("分配总额必须与账单总额一致");
}

function settlementReversals(
  statement: Statement,
  prefix: string,
): BudgetEntry[] {
  return statement.allocations.map((allocation) => ({
    id: `${prefix}:${allocation.id}`,
    poolId: allocation.poolId,
    periodId: allocation.periodId,
    amount: allocation.amount,
    kind: "reversal",
    sourceId: statement.id,
  }));
}

function replaceStatement(ledger: BudgetLedger, replacement: Statement) {
  return ledger.statements.map((statement) =>
    statement.id === replacement.id ? replacement : statement,
  );
}

function appendAudit(
  ledger: BudgetLedger,
  kind: AuditEvent["kind"],
  subjectId: string,
  reason?: string,
  detail?: string,
) {
  return [
    ...ledger.audit,
    {
      id: `${kind}:${subjectId}:${ledger.audit.length + 1}`,
      kind,
      subjectId,
      reason,
      detail,
      createdAt: new Date().toISOString(),
    },
  ];
}

function assertPeriodAndPool(
  ledger: BudgetLedger,
  periodId: string,
  poolId: string,
) {
  requirePeriod(ledger, periodId);
  const pool = requirePool(ledger, poolId);
  if (!pool.active) throw new Error("资金池已停用");
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
  if (items.some((item) => item.id === id))
    throw new Error(`${label} ID 已存在`);
}

function assertPositiveMoney(amount: MoneyCents) {
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > 1_000_000_000_000
  )
    throw new Error("金额必须是大于零且不超过100亿元的整数分");
}

function assertIsoDate(value: string, label: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label}必须是有效的 YYYY-MM-DD 日期`);
  }
}

export function sumMoney(values: MoneyCents[]): MoneyCents {
  const result = values.reduce((sum, value) => sum + BigInt(value), 0n);
  if (
    result > BigInt(Number.MAX_SAFE_INTEGER) ||
    result < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error("金额合计超出安全范围");
  return Number(result);
}
function assertNonNegativeMoney(amount: MoneyCents) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("金额必须是非负整数分");
}
function validatePoolName(
  ledger: BudgetLedger,
  name: string,
  exceptId?: string,
) {
  if (!name.trim() || name.trim().length > 40)
    throw new Error("资金池名称需为 1—40 个字符");
  if (ledger.pools.some((p) => p.id !== exceptId && p.name === name.trim()))
    throw new Error("资金池名称已存在");
}
export function updateBudgetPool(
  ledger: BudgetLedger,
  poolId: string,
  update: { name: string; active: boolean; regularAllocation: MoneyCents },
): BudgetLedger {
  const pool = requirePool(ledger, poolId);
  validatePoolName(ledger, update.name, poolId);
  assertNonNegativeMoney(update.regularAllocation);
  if (!update.active && pool.active) {
    if (
      ledger.periods.some(
        (period) => getPoolBalance(ledger, poolId, period.id) !== 0,
      )
    )
      throw new Error("请先显式调拨处理各期余额，再停用资金池");
    const today = new Date().toISOString().slice(0, 10);
    if (
      ledger.entries.some(
        (e) =>
          e.poolId === poolId &&
          requirePeriod(ledger, e.periodId).endsOn >= today,
      )
    )
      throw new Error("资金池仍绑定当前或未来流水，暂不能停用");
  }
  return {
    ...ledger,
    pools: ledger.pools.map((p) =>
      p.id === poolId ? { ...p, ...update, name: update.name.trim() } : p,
    ),
    audit: appendAudit(
      ledger,
      "pool_updated",
      poolId,
      undefined,
      `${pool.name} → ${update.name.trim()}；常规拨款${update.regularAllocation}分；${update.active ? "启用" : "停用"}`,
    ),
  };
}
export function updateStatement(
  ledger: BudgetLedger,
  statementId: string,
  update: { amount: MoneyCents; dueOn: string; reason: string },
): BudgetLedger {
  const statement = requireStatement(ledger, statementId);
  if (statement.status !== "recorded")
    throw new Error(
      "仅待分配账单可编辑金额/日期；已结算账单请先撤销再重新分配",
    );
  assertPositiveMoney(update.amount);
  assertIsoDate(update.dueOn, "还款日期");
  if (!update.reason.trim()) throw new Error("修改原因不能为空");
  if (getRepaidAmount(ledger, statementId) > update.amount)
    throw new Error("账单金额不能小于已还金额");
  return {
    ...ledger,
    statements: replaceStatement(ledger, {
      ...statement,
      amount: update.amount,
      dueOn: update.dueOn,
    }),
    audit: appendAudit(
      ledger,
      "statement_updated",
      statementId,
      update.reason,
      `${statement.amount}分/${statement.dueOn} → ${update.amount}分/${update.dueOn}`,
    ),
  };
}
export function reopenStatement(
  ledger: BudgetLedger,
  statementId: string,
  reason: string,
): BudgetLedger {
  const statement = requireStatement(ledger, statementId);
  if (statement.status !== "cancelled")
    throw new Error("仅已撤销账单可重新打开");
  if (!reason.trim()) throw new Error("重新打开原因不能为空");
  return {
    ...ledger,
    statements: replaceStatement(ledger, {
      ...statement,
      status: "recorded",
      allocations: [],
    }),
    audit: appendAudit(ledger, "statement_reopened", statementId, reason),
  };
}
export function getRepaidAmount(
  ledger: BudgetLedger,
  statementId: string,
): MoneyCents {
  requireStatement(ledger, statementId);
  return sumMoney(
    ledger.repayments
      .filter((p) => p.statementId === statementId && !p.voided)
      .map((p) => p.amount),
  );
}
export function recordRepayment(
  ledger: BudgetLedger,
  repayment: Repayment,
): BudgetLedger {
  assertUniqueId(ledger.repayments, repayment.id, "还款");
  const statement = requireStatement(ledger, repayment.statementId);
  assertPositiveMoney(repayment.amount);
  assertIsoDate(repayment.paidOn, "还款日期");
  if (
    sumMoney([getRepaidAmount(ledger, statement.id), repayment.amount]) >
    statement.amount
  )
    throw new Error("还款不能超过账单未还金额");
  return {
    ...ledger,
    repayments: [...ledger.repayments, { ...repayment }],
    audit: appendAudit(
      ledger,
      "repayment_recorded",
      repayment.id,
      undefined,
      `${statement.accountId} · ${repayment.amount}分 · ${repayment.paidOn}`,
    ),
  };
}

export function voidRepayment(
  ledger: BudgetLedger,
  repaymentId: string,
  reason: string,
): BudgetLedger {
  const repayment = ledger.repayments.find((r) => r.id === repaymentId);
  if (!repayment || repayment.voided) throw new Error("还款记录不存在或已作废");
  if (!reason.trim()) throw new Error("作废原因不能为空");
  return {
    ...ledger,
    repayments: ledger.repayments.map((r) =>
      r.id === repaymentId ? { ...r, voided: true } : r,
    ),
    audit: appendAudit(
      ledger,
      "repayment_voided",
      repaymentId,
      reason,
      `作废登记${repayment.amount}分；不撤销银行实际支付`,
    ),
  };
}
