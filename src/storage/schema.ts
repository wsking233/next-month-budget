import { z } from "zod";
import { sumMoney, type BudgetLedger } from "@/domain/budget";

const id = z.string().trim().min(1).max(240);
const text = z.string().trim().min(1).max(500);
const amount = z.number().int().min(1).max(1_000_000_000_000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const parsed = new Date(`${s}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s
    );
  });
const allocation = z.strictObject({ id, poolId: id, periodId: id, amount });
export const ledgerSchema = z.strictObject({
  periods: z
    .array(z.strictObject({ id, startsOn: date, endsOn: date }))
    .max(2400),
  pools: z
    .array(
      z.strictObject({
        id,
        name: z.string().trim().min(1).max(40),
        active: z.boolean(),
        regularAllocation: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000_000)
          .optional(),
      }),
    )
    .max(500),
  statements: z
    .array(
      z.strictObject({
        id,
        accountId: id,
        fingerprint: id,
        amount,
        dueOn: date,
        status: z.enum(["recorded", "settled", "cancelled"]),
        allocations: z.array(allocation).max(500),
      }),
    )
    .max(20000),
  entries: z
    .array(
      z.strictObject({
        id,
        poolId: id,
        periodId: id,
        amount: z
          .number()
          .int()
          .min(-1_000_000_000_000)
          .max(1_000_000_000_000)
          .refine((n) => n !== 0),
        kind: z.enum([
          "income_allocation",
          "statement_settlement",
          "transfer_out",
          "transfer_in",
          "reversal",
        ]),
        sourceId: id,
      }),
    )
    .max(100000),
  repayments: z
    .array(
      z.strictObject({
        id,
        statementId: id,
        amount,
        paidOn: date,
        voided: z.boolean().optional(),
      }),
    )
    .max(40000),
  audit: z
    .array(
      z.strictObject({
        id,
        subjectId: id,
        kind: z.enum([
          "period_created",
          "pool_created",
          "income_allocated",
          "statement_recorded",
          "statement_settled",
          "budget_transferred",
          "settlement_cancelled",
          "settlement_corrected",
          "pool_updated",
          "statement_updated",
          "statement_reopened",
          "repayment_recorded",
          "repayment_voided",
        ]),
        createdAt: z.iso.datetime(),
        reason: text.optional(),
        detail: text.optional(),
      }),
    )
    .max(100000),
});
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`账本一致性校验失败：${message}`);
}
function unique(items: { id: string }[]) {
  assert(new Set(items.map((i) => i.id)).size === items.length, "重复 ID");
}
export function validateLedger(input: unknown): BudgetLedger {
  const parsed = ledgerSchema.safeParse(input);
  if (!parsed.success)
    throw new Error("账本格式无效，请使用本应用导出的完整备份");
  const l: BudgetLedger = parsed.data;
  for (const items of [
    l.periods,
    l.pools,
    l.statements,
    l.entries,
    l.audit,
    l.repayments,
  ])
    unique(items);
  const periods = new Map(l.periods.map((p) => [p.id, p]));
  const pools = new Set(l.pools.map((p) => p.id));
  const statements = new Map(l.statements.map((s) => [s.id, s]));
  assert(
    new Set(l.pools.map((p) => p.name)).size === l.pools.length,
    "同名资金池",
  );
  assert(
    new Set(l.statements.map((s) => s.fingerprint)).size ===
      l.statements.length,
    "重复账单",
  );
  for (let i = 0; i < l.periods.length; i++) {
    const p = l.periods[i];
    assert(p.startsOn <= p.endsOn, "周期倒置");
    assert(
      i === 0 || l.periods[i - 1].endsOn < p.startsOn,
      "周期未排序或有重叠",
    );
  }
  const transfers = new Map<string, typeof l.entries>();
  const statementEntries = new Map<string, typeof l.entries>();
  const income = new Set<string>();
  const repayments = new Map(l.repayments.map((r) => [r.id, r]));
  const repaid = new Map<string, number>();
  for (const r of l.repayments.filter((r) => !r.voided))
    repaid.set(
      r.statementId,
      sumMoney([repaid.get(r.statementId) ?? 0, r.amount]),
    );
  for (const e of l.entries) {
    assert(periods.has(e.periodId) && pools.has(e.poolId), "流水关联不存在");
    if (e.kind === "income_allocation") {
      assert(e.amount > 0 && e.sourceId === e.id, "拨款来源/金额错误");
      income.add(e.id);
    } else if (e.kind === "transfer_in" || e.kind === "transfer_out") {
      assert(
        e.kind === "transfer_in" ? e.amount > 0 : e.amount < 0,
        "调拨方向错误",
      );
      const group = transfers.get(e.sourceId) ?? [];
      group.push(e);
      transfers.set(e.sourceId, group);
    } else {
      assert(statements.has(e.sourceId), "结算来源不存在");
      assert(
        e.kind === "reversal" ? e.amount > 0 : e.amount < 0,
        "结算/冲销符号错误",
      );
      const group = statementEntries.get(e.sourceId) ?? [];
      group.push(e);
      statementEntries.set(e.sourceId, group);
    }
  }
  for (const entries of transfers.values())
    assert(
      entries.length === 2 &&
        entries[0].kind !== entries[1].kind &&
        entries[0].poolId !== entries[1].poolId &&
        entries[0].periodId === entries[1].periodId &&
        sumMoney(entries.map((e) => e.amount)) === 0,
      "调拨缺少配对或不守恒",
    );
  for (const s of l.statements) {
    unique(s.allocations);
    for (const a of s.allocations)
      assert(pools.has(a.poolId) && periods.has(a.periodId), "分配关联不存在");
    if (s.status === "recorded")
      assert(s.allocations.length === 0, "未结算账单带有分配");
    else
      assert(
        s.allocations.length > 0 &&
          sumMoney(s.allocations.map((a) => a.amount)) === s.amount,
        "账单分配不匹配",
      );
    const net = new Map<string, number>();
    const open = new Map<string, number>();
    for (const e of statementEntries.get(s.id) ?? []) {
      const key = JSON.stringify([e.poolId, e.periodId]);
      const match = JSON.stringify([e.poolId, e.periodId, Math.abs(e.amount)]);
      if (e.kind === "reversal") {
        assert((open.get(match) ?? 0) > 0, "冲销无对应原分配");
        open.set(match, open.get(match)! - 1);
      } else open.set(match, (open.get(match) ?? 0) + 1);
      net.set(key, sumMoney([net.get(key) ?? 0, e.amount]));
    }
    if (s.status === "settled")
      for (const a of s.allocations) {
        const key = JSON.stringify([a.poolId, a.periodId]);
        net.set(key, sumMoney([net.get(key) ?? 0, a.amount]));
      }
    assert(
      [...net.values()].every((v) => v === 0),
      "结算余额与有效分配不符",
    );
    assert((repaid.get(s.id) ?? 0) <= s.amount, "还款超过账单");
  }
  for (const r of l.repayments)
    assert(statements.has(r.statementId), "还款来源不存在");
  const poolCreated = new Set<string>(),
    periodCreated = new Set<string>(),
    statementCreated = new Set<string>();
  const incomeAudited = new Set<string>(),
    transferAudited = new Set<string>(),
    repaymentAudited = new Set<string>();
  const states = new Map<string, string>();
  const voidedRepayments = new Set<string>();
  for (const event of l.audit) {
    const subject = event.subjectId;
    const requireReason = [
      "settlement_cancelled",
      "settlement_corrected",
      "statement_reopened",
      "statement_updated",
      "budget_transferred",
      "repayment_voided",
    ].includes(event.kind);
    if (requireReason) assert(event.reason?.trim(), "关键操作缺少原因");
    switch (event.kind) {
      case "period_created":
        assert(periods.has(subject) && !periodCreated.has(subject), "周期审计");
        periodCreated.add(subject);
        break;
      case "pool_created":
        assert(pools.has(subject) && !poolCreated.has(subject), "资金池审计");
        poolCreated.add(subject);
        break;
      case "pool_updated":
        assert(poolCreated.has(subject), "资金池更新审计");
        break;
      case "income_allocated":
        assert(income.has(subject) && !incomeAudited.has(subject), "拨款审计");
        incomeAudited.add(subject);
        break;
      case "budget_transferred":
        assert(
          transfers.has(subject) && !transferAudited.has(subject),
          "调拨审计",
        );
        transferAudited.add(subject);
        break;
      case "repayment_recorded":
        assert(
          repayments.has(subject) && !repaymentAudited.has(subject),
          "还款审计",
        );
        repaymentAudited.add(subject);
        break;
      case "repayment_voided":
        assert(
          repaymentAudited.has(subject) && !voidedRepayments.has(subject),
          "还款作废审计",
        );
        voidedRepayments.add(subject);
        break;
      case "statement_recorded":
        assert(
          statements.has(subject) && !statementCreated.has(subject),
          "账单审计",
        );
        statementCreated.add(subject);
        states.set(subject, "recorded");
        break;
      case "statement_updated":
        assert(states.get(subject) === "recorded", "账单修改状态");
        break;
      case "statement_settled":
        assert(states.get(subject) === "recorded", "重复结算");
        states.set(subject, "settled");
        break;
      case "settlement_corrected":
        assert(states.get(subject) === "settled", "更正状态");
        break;
      case "settlement_cancelled":
        assert(states.get(subject) === "settled", "撤销状态");
        states.set(subject, "cancelled");
        break;
      case "statement_reopened":
        assert(states.get(subject) === "cancelled", "重新打开状态");
        states.set(subject, "recorded");
        break;
    }
  }
  assert(
    poolCreated.size === l.pools.length &&
      periodCreated.size === l.periods.length &&
      statementCreated.size === l.statements.length &&
      incomeAudited.size === income.size &&
      transferAudited.size === transfers.size &&
      repaymentAudited.size === l.repayments.length,
    "缺少审计记录",
  );
  for (const r of l.repayments)
    assert(
      Boolean(r.voided) === voidedRepayments.has(r.id),
      "还款作废状态与审计不符",
    );
  for (const s of l.statements)
    assert(states.get(s.id) === s.status, "账单状态与审计不一致");
  const changes = new Map<string, number>();
  for (const e of l.entries) {
    const key = JSON.stringify([e.periodId, e.poolId]);
    changes.set(key, sumMoney([changes.get(key) ?? 0, e.amount]));
  }
  const balances = new Map<string, number>();
  for (const period of l.periods) {
    for (const pool of l.pools)
      balances.set(
        pool.id,
        sumMoney([
          balances.get(pool.id) ?? 0,
          changes.get(JSON.stringify([period.id, pool.id])) ?? 0,
        ]),
      );
    sumMoney([...balances.values()]);
  }
  return l;
}
