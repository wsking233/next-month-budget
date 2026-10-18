import { z } from 'zod';
import type { BudgetLedger } from '@/domain/budget';

export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const text = z.string().min(1).max(500).refine(value => value === value.trim());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
});
const cents = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const positive = cents.refine(value => value > 0);
const allocation = z.strictObject({ id: text, poolId: text, periodId: text, amount: positive });
const legacyLedgerSchema = z.strictObject({
  periods: z.array(z.strictObject({ id: text, name: text.optional(), startsOn: date, endsOn: date })).max(1200),
  pools: z.array(z.strictObject({ id: text, name: text, active: z.boolean() })).max(1000),
  statements: z.array(z.strictObject({ id: text, accountId: text, fingerprint: text, amount: positive, statementOn: date.optional(), dueOn: date, status: z.enum(['recorded', 'settled', 'cancelled']), allocations: z.array(allocation).max(1000) })).max(5000),
  entries: z.array(z.strictObject({ id: text, poolId: text, periodId: text, amount: cents.refine(value => value !== 0), kind: z.enum(['income_allocation', 'statement_settlement', 'transfer_out', 'transfer_in', 'reversal']), sourceId: text })).max(20000),
  audit: z.array(z.strictObject({ id: text, kind: z.enum(['period_created', 'pool_created', 'pool_updated', 'statement_revised', 'income_allocated', 'statement_recorded', 'statement_settled', 'budget_transferred', 'settlement_cancelled', 'settlement_corrected']), subjectId: text, createdAt: z.iso.datetime(), description: z.string().min(1).max(MAX_BACKUP_BYTES), reason: z.string().min(1).max(200).optional() })).max(20000),
});
const planLine = z.strictObject({ poolId: text, amount: positive });
const template = z.strictObject({ allocations: z.array(planLine).max(1000), plannedSavings: cents.refine(value => value >= 0) });
const income = z.strictObject({ id: text, periodId: text, reference: text.max(200), receivedOn: date, amount: positive, plannedSavings: cents.refine(value => value >= 0), allocations: z.array(planLine.extend({ entryId: text })).max(1000), status: z.enum(['applied', 'cancelled']), cancellationReason: text.max(200).optional() });
const ledgerSchema = legacyLedgerSchema.extend({
  planning: z.strictObject({ template, incomes: z.array(income).max(5000) }).optional(),
  entries: z.array(legacyLedgerSchema.shape.entries.element.extend({ kind: z.enum(['income_allocation', 'income_reversal', 'statement_settlement', 'transfer_out', 'transfer_in', 'reversal']) })).max(20000),
  audit: z.array(legacyLedgerSchema.shape.audit.element.extend({ kind: z.enum(['budget_template_saved', 'income_recorded', 'income_cancelled', 'period_created', 'pool_created', 'pool_updated', 'statement_revised', 'income_allocated', 'statement_recorded', 'statement_settled', 'budget_transferred', 'settlement_cancelled', 'settlement_corrected']) })).max(20000),
});
const workspaceSchema = z.strictObject({ ledger: ledgerSchema, currentPeriod: z.string().max(500) });
const snapshotFields = { format: z.literal('next-month-budget'), savedAt: z.iso.datetime(), exportedAt: z.iso.datetime().optional() };
const legacySnapshotSchema = z.strictObject({ ...snapshotFields, schemaVersion: z.literal(1), workspace: workspaceSchema.extend({ ledger: legacyLedgerSchema }) });
const snapshotSchema = z.strictObject({ ...snapshotFields, schemaVersion: z.literal(2), workspace: workspaceSchema });
export type Workspace = z.infer<typeof workspaceSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
function fail(message: string): never { throw new Error(`账本校验失败：${message}。原账本未改变。`); }
const key = (pool: string, period: string) => JSON.stringify([pool, period]);
const safe = (amount: bigint) => { if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) fail('累计金额超出安全范围'); };
function unique(values: string[], label: string) { if (new Set(values).size !== values.length) fail(`${label}重复`); }

export function validateWorkspace(input: unknown): Workspace {
  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) fail('格式或字段无效');
  const workspace = parsed.data;
  validateLedger(workspace.ledger);
  if (workspace.currentPeriod && !workspace.ledger.periods.some(p => p.id === workspace.currentPeriod)) fail('所选周期不存在');
  return workspace;
}

function validateLedger(ledger: BudgetLedger) {
  const { periods, pools, statements, entries, audit } = ledger;
  for (const [list, label] of [[periods, '周期'], [pools, '资金池'], [statements, '账单'], [entries, '流水'], [audit, '审计']] as const) unique(list.map(item => item.id), label);
  unique(pools.map(p => p.name), '资金池名称');
  unique(statements.map(s => JSON.stringify([s.accountId, s.fingerprint])), '账户内账单标识');
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    if (period.startsOn > period.endsOn || (i > 0 && periods[i - 1].endsOn >= period.startsOn)) fail('周期日期、顺序或重叠');
  }
  const poolIds = new Set(pools.map(p => p.id)), periodIds = new Set(periods.map(p => p.id));
  const statementIds = new Set(statements.map(s => s.id));
  const reference = (pool: string, period: string) => { if (!poolIds.has(pool) || !periodIds.has(period)) fail('资金池或周期引用失效'); };
  const transfers = new Map<string, typeof entries>();
  const statementNet = new Map<string, Map<string, bigint>>();
  const movements = new Map<string, bigint>();
  const funding = new Map<string, bigint>();
  for (const entry of entries) {
    reference(entry.poolId, entry.periodId);
    const amount = BigInt(entry.amount), location = key(entry.poolId, entry.periodId);
    movements.set(location, (movements.get(location) ?? 0n) + amount);
    if (entry.kind === 'income_allocation') {
      if (entry.amount <= 0 || entry.sourceId !== entry.id) fail('拨款金额或来源无效');
      funding.set(entry.periodId, (funding.get(entry.periodId) ?? 0n) + amount);
    } else if (entry.kind === 'income_reversal') {
      const original = entries.find(e => e.id === entry.sourceId && e.kind === 'income_allocation');
      if (!original || entry.amount !== -original.amount || entry.poolId !== original.poolId || entry.periodId !== original.periodId) fail('收入拨款冲销无效');
      funding.set(entry.periodId, (funding.get(entry.periodId) ?? 0n) + amount);
    } else if (entry.kind === 'transfer_in' || entry.kind === 'transfer_out') {
      if ((entry.kind === 'transfer_in' && entry.amount < 0) || (entry.kind === 'transfer_out' && entry.amount > 0)) fail('调拨方向无效');
      transfers.set(entry.sourceId, [...(transfers.get(entry.sourceId) ?? []), entry]);
    } else {
      if (!statementIds.has(entry.sourceId)) fail('结算流水账单引用失效');
      if ((entry.kind === 'statement_settlement' && entry.amount > 0) || (entry.kind === 'reversal' && entry.amount < 0)) fail('结算或冲销方向无效');
      const net = statementNet.get(entry.sourceId) ?? new Map<string, bigint>();
      net.set(location, (net.get(location) ?? 0n) + amount);
      statementNet.set(entry.sourceId, net);
    }
  }
  for (const pair of transfers.values()) {
    if (pair.length !== 2 || pair[0].kind === pair[1].kind || pair[0].periodId !== pair[1].periodId || pair[0].poolId === pair[1].poolId || BigInt(pair[0].amount) + BigInt(pair[1].amount) !== 0n) fail('调拨不成对或不守恒');
  }
  let statementTotal = 0n;
  for (const statement of statements) {
    statementTotal += BigInt(statement.amount);
    if (statement.statementOn && statement.statementOn > statement.dueOn) fail('账单日期无效');
    unique(statement.allocations.map(a => a.id), '分配标识');
    const expected = new Map<string, bigint>();
    let total = 0n;
    for (const item of statement.allocations) {
      reference(item.poolId, item.periodId);
      total += BigInt(item.amount);
      const location = key(item.poolId, item.periodId);
      if (statement.status === 'settled') expected.set(location, (expected.get(location) ?? 0n) - BigInt(item.amount));
    }
    if (statement.status === 'recorded' ? statement.allocations.length !== 0 : statement.allocations.length === 0 || total !== BigInt(statement.amount)) fail('账单分配与总额不一致');
    const actual = statementNet.get(statement.id) ?? new Map<string, bigint>();
    for (const location of new Set([...actual.keys(), ...expected.keys()])) if ((actual.get(location) ?? 0n) !== (expected.get(location) ?? 0n)) fail('结算或冲销流水与当前分配不一致');
  }
  safe(statementTotal);
  const balances = new Map<string, bigint>();
  let budgetTotal = 0n;
  for (const period of periods) {
    safe(funding.get(period.id) ?? 0n);
    for (const pool of pools) {
      const change = movements.get(key(pool.id, period.id)) ?? 0n;
      safe(change);
      const balance = (balances.get(pool.id) ?? 0n) + change;
      safe(balance);
      balances.set(pool.id, balance);
      budgetTotal += change;
    }
    safe(budgetTotal);
  }
  validateAudit(ledger, transfers);
  validatePlanning(ledger);
}

function validateAudit(ledger: BudgetLedger, transfers: Map<string, BudgetLedger['entries']>) {
  const createdPools = new Set<string>(), createdPeriods = new Set<string>(), funded = new Set<string>(), transferred = new Set<string>();
  const states = new Map<string, 'recorded' | 'settled' | 'cancelled'>();
  const activeEntries = new Map<string, BudgetLedger['entries']>();
  const cancelledEntries = new Map<string, BudgetLedger['entries']>();
  const corrections = new Map<string, number>();
  const matched = new Set<string>();
  const group = (subject: string, prefix: string, kind: 'statement_settlement' | 'reversal') => {
    const items = ledger.entries.filter(e => e.sourceId === subject && e.kind === kind && e.id.startsWith(prefix));
    if (!items.length || items.some(e => matched.has(e.id) || !createdPools.has(e.poolId) || !createdPeriods.has(e.periodId))) fail('历史结算流水来源不完整');
    for (const item of items) matched.add(item.id);
    return items;
  };
  const reverse = (subject: string, items: BudgetLedger['entries']) => {
    const net = new Map<string, bigint>();
    for (const item of [...(activeEntries.get(subject) ?? []), ...items]) {
      const location = key(item.poolId, item.periodId);
      net.set(location, (net.get(location) ?? 0n) + BigInt(item.amount));
    }
    if ([...net.values()].some(amount => amount !== 0n)) fail('历史冲销未精确还原原分配');
  };
  for (const [index, event] of ledger.audit.entries()) {
    if (event.id !== `${event.kind}:${event.subjectId}:${index + 1}`) fail('审计顺序或标识不一致');
    if (['budget_template_saved', 'income_recorded', 'income_cancelled'].includes(event.kind)) continue;
    if (['budget_transferred', 'statement_revised', 'settlement_cancelled', 'settlement_corrected'].includes(event.kind) && !event.reason?.trim()) fail('审计原因缺失');
    if (event.kind === 'period_created') {
      if (createdPeriods.has(event.subjectId) || !ledger.periods.some(p => p.id === event.subjectId)) fail('周期审计失效');
      createdPeriods.add(event.subjectId);
    } else if (event.kind === 'pool_created') {
      if (createdPools.has(event.subjectId) || !ledger.pools.some(p => p.id === event.subjectId)) fail('资金池审计失效');
      createdPools.add(event.subjectId);
    } else if (event.kind === 'pool_updated') {
      if (!createdPools.has(event.subjectId)) fail('资金池维护审计失效');
    } else if (event.kind === 'income_allocated') {
      const entry = ledger.entries.find(e => e.id === event.subjectId && e.kind === 'income_allocation');
      if (!entry || funded.has(event.subjectId) || !createdPools.has(entry.poolId) || !createdPeriods.has(entry.periodId)) fail('拨款审计失效');
      funded.add(event.subjectId);
    } else if (event.kind === 'budget_transferred') {
      const pair = transfers.get(event.subjectId);
      if (!pair || transferred.has(event.subjectId) || pair.some(e => !createdPools.has(e.poolId) || !createdPeriods.has(e.periodId))) fail('调拨审计失效');
      transferred.add(event.subjectId);
    } else {
      if (!ledger.statements.some(s => s.id === event.subjectId)) fail('账单审计引用失效');
      const previous = states.get(event.subjectId);
      if (event.kind === 'statement_recorded') {
        if (previous) fail('账单登记审计重复');
        states.set(event.subjectId, 'recorded');
      } else if (event.kind === 'statement_settled') {
        if (previous !== 'recorded') fail('结算审计状态失效');
        activeEntries.set(event.subjectId, group(event.subjectId, `settlement:${event.subjectId}:${index}:`, 'statement_settlement'));
        states.set(event.subjectId, 'settled');
      } else if (event.kind === 'settlement_corrected') {
        if (previous !== 'settled') fail('更正审计状态失效');
        const version = (corrections.get(event.subjectId) ?? 0) + 1;
        corrections.set(event.subjectId, version);
        reverse(event.subjectId, group(event.subjectId, `correct:${event.subjectId}:${version}:`, 'reversal'));
        const replacements = group(event.subjectId, `correction:${event.subjectId}:${version}:`, 'statement_settlement');
        const sum = (items: BudgetLedger['entries']) => items.reduce((total, item) => total + BigInt(item.amount), 0n);
        if (sum(replacements) !== sum(activeEntries.get(event.subjectId) ?? [])) fail('历史更正改变了账单总额');
        activeEntries.set(event.subjectId, replacements);
      } else if (event.kind === 'settlement_cancelled') {
        if (previous !== 'settled') fail('撤销审计状态失效');
        reverse(event.subjectId, group(event.subjectId, `cancel:${event.subjectId}:${index}:`, 'reversal'));
        cancelledEntries.set(event.subjectId, activeEntries.get(event.subjectId) ?? []);
        activeEntries.delete(event.subjectId);
        states.set(event.subjectId, 'cancelled');
      } else if (event.kind === 'statement_revised') {
        if (previous !== 'recorded' && previous !== 'cancelled') fail('修改审计状态失效');
        states.set(event.subjectId, 'recorded');
      }
    }
  }
  for (const statement of ledger.statements.filter(s => s.status === 'cancelled')) {
    const net = new Map<string, bigint>();
    for (const item of [...(cancelledEntries.get(statement.id) ?? []), ...statement.allocations]) {
      const location = key(item.poolId, item.periodId);
      net.set(location, (net.get(location) ?? 0n) + BigInt(item.amount));
    }
    if ([...net.values()].some(amount => amount !== 0n)) fail('已撤销账单的原分配不一致');
  }
  if (matched.size !== ledger.entries.filter(e => e.kind === 'statement_settlement' || e.kind === 'reversal').length) fail('存在未关联审计的结算流水');
  if (createdPools.size !== ledger.pools.length || createdPeriods.size !== ledger.periods.length || funded.size !== ledger.entries.filter(e => e.kind === 'income_allocation').length || transferred.size !== transfers.size || ledger.statements.some(s => states.get(s.id) !== s.status)) fail('审计记录不完整');
}

export function parseSnapshot(raw: string): Snapshot {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error('备份文件超过 2 MB，未修改原账本。');
  let input: unknown;
  try { input = JSON.parse(raw); } catch { throw new Error('无法读取 JSON 文件，原账本未改变。'); }
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input && input.schemaVersion !== 1 && input.schemaVersion !== 2) throw new Error('备份版本不兼容，请使用支持该版本的应用。原账本未改变。');
  // Validate v1 with its original strict schema before upgrading in memory.
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input && input.schemaVersion === 1) {
    const legacy = legacySnapshotSchema.safeParse(input);
    if (!legacy.success) fail('旧版文件格式或字段无效');
    validateWorkspace(legacy.data.workspace);
    return { ...legacy.data, schemaVersion: 2 };
  }
  const result = snapshotSchema.safeParse(input);
  if (!result.success) fail('文件格式或字段无效');
  validateWorkspace(result.data.workspace);
  return result.data;
}
export function serializeSnapshot(workspace: Workspace, exported = false): string {
  const snapshot: Snapshot = { format: 'next-month-budget', schemaVersion: 2, savedAt: new Date().toISOString(), workspace: validateWorkspace(workspace), ...(exported ? { exportedAt: new Date().toISOString() } : {}) };
  const raw = JSON.stringify(snapshot);
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES - (exported ? 0 : 128)) throw new Error('账本超过 2 MB，请减少数据量或另存备份；原账本未改变。');
  return raw;
}

function validatePlanning(ledger: BudgetLedger) {
  const planning = ledger.planning;
  const events = ledger.audit.filter(e => ['budget_template_saved', 'income_recorded', 'income_cancelled'].includes(e.kind));
  const reversals = ledger.entries.filter(e => e.kind === 'income_reversal');
  if (!planning) {
    if (events.length || reversals.length) fail('收入计划或记录缺失');
    return;
  }
  unique(planning.incomes.map(i => i.id), '收入标识');
  unique(planning.incomes.map(i => JSON.stringify([i.periodId, i.reference])), '周期内收入标识');
  unique(planning.template.allocations.map(a => a.poolId), '模板资金池');
  if (planning.template.allocations.some(a => !ledger.pools.some(p => p.id === a.poolId))) fail('模板资金池引用失效');
  safe(planning.template.allocations.reduce((n, a) => n + BigInt(a.amount), BigInt(planning.template.plannedSavings)));
  const owned = new Set<string>(), reversed = new Set<string>();
  let totalIncome = 0n;
  for (const income of planning.incomes) {
    if (!ledger.periods.some(p => p.id === income.periodId)) fail('收入周期引用失效');
    unique(income.allocations.map(a => a.poolId), '收入拨款资金池');
    const total = income.allocations.reduce((n, a) => n + BigInt(a.amount), BigInt(income.plannedSavings));
    if (total > BigInt(income.amount)) fail('收入不足以覆盖分配');
    const recorded = events.filter(e => e.kind === 'income_recorded' && e.subjectId === income.id);
    const cancelled = events.filter(e => e.kind === 'income_cancelled' && e.subjectId === income.id);
    if (recorded.length !== 1 || cancelled.length !== (income.status === 'cancelled' ? 1 : 0)) fail('收入审计不完整');
    const recordIndex = ledger.audit.indexOf(recorded[0]);
    if (!ledger.audit.slice(0, recordIndex).some(e => e.kind === 'period_created' && e.subjectId === income.periodId)) fail('收入创建顺序无效');
    if (income.status === 'cancelled') {
      if (!income.cancellationReason || cancelled[0].reason !== income.cancellationReason || ledger.audit.indexOf(cancelled[0]) <= recordIndex) fail('收入撤销原因或顺序无效');
    } else {
      if (income.cancellationReason) fail('有效收入不应含撤销原因');
      totalIncome += BigInt(income.amount);
    }
    for (const [index, line] of income.allocations.entries()) {
      const entry = ledger.entries.find(e => e.id === line.entryId);
      if (line.entryId !== `income:${income.id}:${index}` || owned.has(line.entryId) || !entry || entry.kind !== 'income_allocation' || entry.amount !== line.amount || entry.poolId !== line.poolId || entry.periodId !== income.periodId) fail('收入与拨款流水不一致');
      const fundingIndex = ledger.audit.findIndex(e => e.kind === 'income_allocated' && e.subjectId === line.entryId);
      if (fundingIndex < 0 || fundingIndex >= recordIndex) fail('收入拨款顺序无效');
      owned.add(line.entryId);
      const reversal = reversals.filter(e => e.sourceId === line.entryId);
      if (reversal.length !== (income.status === 'cancelled' ? 1 : 0)) fail('收入冲销不完整或重复');
      for (const item of reversal) {
        if (item.id !== `income-cancel:${line.entryId}`) fail('收入冲销标识无效');
        reversed.add(item.id);
      }
    }
  }
  safe(totalIncome);
  if ((planning.template.allocations.length || planning.template.plannedSavings) && !events.some(e => e.kind === 'budget_template_saved')) fail('模板审计缺失');
  if (reversed.size !== reversals.length) fail('存在无来源收入流水');
  if (events.some(e => e.kind === 'budget_template_saved' ? e.subjectId !== 'fixed' : !planning.incomes.some(i => i.id === e.subjectId))) fail('收入审计引用失效');
}
