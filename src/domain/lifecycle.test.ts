import { describe, expect, it } from "vitest";
import {
  allocateIncome,
  cancelSettlement,
  correctSettlement,
  createBudgetPeriod,
  createBudgetPool,
  createLedger,
  getPoolBalance,
  getRepaidAmount,
  recordRepayment,
  recordStatement,
  reopenStatement,
  settleStatement,
  updateBudgetPool,
  updateStatement,
} from "./budget";
function example() {
  let l = createBudgetPeriod(createLedger(), {
    id: "p",
    startsOn: "2026-10-10",
    endsOn: "2026-11-09",
  });
  l = createBudgetPool(l, { id: "a", name: "生活" });
  l = createBudgetPool(l, { id: "b", name: "数码" });
  return recordStatement(l, {
    id: "s",
    accountId: "卡",
    fingerprint: " 卡:10 ",
    amount: 10000,
    dueOn: "2026-10-25",
  });
}
const allocation = [{ id: "one", poolId: "a", periodId: "p", amount: 10000 }];
describe("完整账单生命周期", () => {
  it("撤销后重新打开，再次结算和更正不重复 ID，保留不可变历史", () => {
    const initial = example();
    let l = settleStatement(initial, "s", allocation);
    l = correctSettlement(
      l,
      "s",
      [{ ...allocation[0], poolId: "b" }],
      "改分类",
    );
    l = cancelSettlement(l, "s", "重新核对");
    expect(getPoolBalance(l, "a", "p")).toBe(0);
    expect(getPoolBalance(l, "b", "p")).toBe(0);
    l = reopenStatement(l, "s", "核对完成");
    l = settleStatement(l, "s", allocation);
    l = correctSettlement(
      l,
      "s",
      [{ ...allocation[0], poolId: "b" }],
      "重新分类",
    );
    l = cancelSettlement(l, "s", "再撤销");
    expect(getPoolBalance(l, "b", "p")).toBe(0);
    expect(new Set(l.entries.map((e) => e.id)).size).toBe(l.entries.length);
    expect(initial.entries).toEqual([]);
    expect(l.audit.every((e) => !Number.isNaN(Date.parse(e.createdAt)))).toBe(
      true,
    );
  });
  it("还款独立于预算，允许分次登记，不能超额或将账单改小于已还金额", () => {
    let l = settleStatement(example(), "s", allocation);
    l = recordRepayment(l, {
      id: "r",
      statementId: "s",
      amount: 4000,
      paidOn: "2026-10-20",
    });
    expect(getPoolBalance(l, "a", "p")).toBe(-10000);
    expect(getRepaidAmount(l, "s")).toBe(4000);
    expect(() =>
      recordRepayment(l, {
        id: "r2",
        statementId: "s",
        amount: 6001,
        paidOn: "2026-10-20",
      }),
    ).toThrow(/超过/);
    l = reopenStatement(cancelSettlement(l, "s", "错误"), "s", "修正");
    expect(() =>
      updateStatement(l, "s", {
        amount: 3999,
        dueOn: "2026-10-25",
        reason: "改额",
      }),
    ).toThrow(/已还/);
    const revised = updateStatement(l, "s", {
      amount: 8000,
      dueOn: "2026-10-26",
      reason: "改额",
    });
    expect(revised.audit.at(-1)?.detail).toContain("10000");
    expect(l.statements[0].amount).toBe(10000);
  });
  it("规范化去重标识；资金池停用前必须处理余额", () => {
    const l = example();
    expect(() =>
      recordStatement(l, {
        id: "s2",
        accountId: "卡",
        fingerprint: "卡:10",
        amount: 1,
        dueOn: "2026-10-25",
      }),
    ).toThrow(/重复/);
    const funded = allocateIncome(l, {
      id: "in",
      poolId: "a",
      periodId: "p",
      amount: 10000,
    });
    expect(() =>
      updateBudgetPool(funded, "a", {
        name: "生活",
        active: false,
        regularAllocation: 0,
      }),
    ).toThrow(/余额/);
  });
});
