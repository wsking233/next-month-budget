import { describe, expect, it } from "vitest";

import {
  allocateIncome,
  cancelSettlement,
  correctSettlement,
  createBudgetPeriod,
  createBudgetPool,
  createLedger,
  getPoolBalance,
  recordStatement,
  settleStatement,
  transferBudget,
} from "./budget";

const january = {
  id: "period-jan",
  startsOn: "2027-01-10",
  endsOn: "2027-02-09",
};
const february = {
  id: "period-feb",
  startsOn: "2027-02-10",
  endsOn: "2027-03-09",
};

function baseLedger() {
  let ledger = createLedger();
  ledger = createBudgetPeriod(ledger, january);
  ledger = createBudgetPeriod(ledger, february);
  ledger = createBudgetPool(ledger, { id: "daily", name: "日常" });
  ledger = createBudgetPool(ledger, { id: "digital", name: "数码" });
  return ledger;
}

describe("预算领域规则", () => {
  it("负余额跨期保留，后续拨款优先抵扣", () => {
    let ledger = baseLedger();
    ledger = allocateIncome(ledger, {
      id: "entry-1",
      periodId: january.id,
      poolId: "digital",
      amount: 2_000_00,
    });
    ledger = recordStatement(ledger, {
      id: "statement-1",
      accountId: "card-a",
      fingerprint: "card-a:2027-01",
      amount: 4_000_00,
      dueOn: "2027-02-02",
    });
    ledger = settleStatement(ledger, "statement-1", [
      {
        id: "allocation-1",
        poolId: "digital",
        periodId: january.id,
        amount: 4_000_00,
      },
    ]);

    expect(getPoolBalance(ledger, "digital", january.id)).toBe(-2_000_00);

    ledger = allocateIncome(ledger, {
      id: "entry-2",
      periodId: february.id,
      poolId: "digital",
      amount: 2_000_00,
    });
    expect(getPoolBalance(ledger, "digital", february.id)).toBe(0);
  });

  it("同一账单允许按明确周期拆分归属", () => {
    let ledger = baseLedger();
    ledger = recordStatement(ledger, {
      id: "statement-2",
      accountId: "card-a",
      fingerprint: "card-a:2027-02",
      amount: 6_200_00,
      dueOn: "2027-03-01",
    });
    ledger = settleStatement(ledger, "statement-2", [
      {
        id: "allocation-2a",
        poolId: "daily",
        periodId: january.id,
        amount: 2_800_00,
      },
      {
        id: "allocation-2b",
        poolId: "digital",
        periodId: february.id,
        amount: 3_400_00,
      },
    ]);

    expect(getPoolBalance(ledger, "daily", january.id)).toBe(-2_800_00);
    expect(getPoolBalance(ledger, "digital", january.id)).toBe(0);
    expect(getPoolBalance(ledger, "digital", february.id)).toBe(-3_400_00);
  });

  it("调拨同时产生一出一入且预算总额不变，失败时不产生半边记录", () => {
    let ledger = baseLedger();
    ledger = allocateIncome(ledger, {
      id: "entry-3",
      periodId: january.id,
      poolId: "daily",
      amount: 1_500_00,
    });
    const beforeTotal =
      getPoolBalance(ledger, "daily", january.id) +
      getPoolBalance(ledger, "digital", january.id);
    const transferred = transferBudget(ledger, {
      id: "transfer-1",
      periodId: january.id,
      fromPoolId: "daily",
      toPoolId: "digital",
      amount: 1_000_00,
      reason: "脱敏测试调拨",
    });

    expect(getPoolBalance(transferred, "daily", january.id)).toBe(500_00);
    expect(getPoolBalance(transferred, "digital", january.id)).toBe(1_000_00);
    expect(
      getPoolBalance(transferred, "daily", january.id) +
        getPoolBalance(transferred, "digital", january.id),
    ).toBe(beforeTotal);
    expect(ledger.entries).toHaveLength(1);
    expect(() =>
      transferBudget(ledger, {
        id: "transfer-2",
        periodId: january.id,
        fromPoolId: "daily",
        toPoolId: "missing",
        amount: 100_00,
        reason: "应失败",
      }),
    ).toThrow();
    expect(ledger.entries).toHaveLength(1);
    expect(() =>
      transferBudget(transferred, {
        id: "transfer-1",
        periodId: january.id,
        fromPoolId: "daily",
        toPoolId: "digital",
        amount: 1_000_00,
        reason: "重复提交",
      }),
    ).toThrow(/已存在/);
  });

  it("取消结算生成反向流水；更正结算先冲销旧分配再应用新分配", () => {
    let ledger = baseLedger();
    ledger = recordStatement(ledger, {
      id: "statement-3",
      accountId: "card-b",
      fingerprint: "card-b:2027-01",
      amount: 1_000_00,
      dueOn: "2027-02-05",
    });
    ledger = settleStatement(ledger, "statement-3", [
      {
        id: "allocation-3",
        poolId: "daily",
        periodId: january.id,
        amount: 1_000_00,
      },
    ]);
    const cancelled = cancelSettlement(ledger, "statement-3", "分类错误");
    expect(getPoolBalance(cancelled, "daily", january.id)).toBe(0);
    expect(cancelled.audit.at(-1)?.kind).toBe("settlement_cancelled");

    const corrected = correctSettlement(
      ledger,
      "statement-3",
      [
        {
          id: "allocation-3-corrected",
          poolId: "digital",
          periodId: january.id,
          amount: 1_000_00,
        },
      ],
      "改归数码",
    );
    expect(getPoolBalance(corrected, "daily", january.id)).toBe(0);
    expect(getPoolBalance(corrected, "digital", january.id)).toBe(-1_000_00);
    expect(corrected.audit.at(-1)?.kind).toBe("settlement_corrected");
  });

  it("拒绝重复账单、重复结算和分配总额不一致", () => {
    let ledger = baseLedger();
    const statement = {
      id: "statement-4",
      accountId: "card-c",
      fingerprint: "card-c:2027-01",
      amount: 900_00,
      dueOn: "2027-02-08",
    };
    ledger = recordStatement(ledger, statement);

    expect(() =>
      recordStatement(ledger, { ...statement, id: "statement-copy" }),
    ).toThrow(/重复/);
    expect(() =>
      settleStatement(ledger, "statement-4", [
        {
          id: "allocation-invalid",
          poolId: "daily",
          periodId: january.id,
          amount: 800_00,
        },
      ]),
    ).toThrow(/一致/);

    ledger = settleStatement(ledger, "statement-4", [
      {
        id: "allocation-4",
        poolId: "daily",
        periodId: january.id,
        amount: 900_00,
      },
    ]);
    expect(() =>
      settleStatement(ledger, "statement-4", [
        {
          id: "allocation-4-copy",
          poolId: "daily",
          periodId: january.id,
          amount: 900_00,
        },
      ]),
    ).toThrow(/已经结算/);
  });
});

// 回归真实输入边界及账单生命周期，不通过 UI 绕过领域规则。
describe("输入及账务生命周期", () => {
  it("拒绝被 Date.parse 自动进位的日期与重叠周期", () => {
    expect(() =>
      createBudgetPeriod(createLedger(), {
        id: "bad",
        startsOn: "2026-02-30",
        endsOn: "2026-03-10",
      }),
    ).toThrow(/有效/);
    expect(() =>
      createBudgetPeriod(baseLedger(), {
        id: "overlap",
        startsOn: "2027-02-09",
        endsOn: "2027-02-11",
      }),
    ).toThrow(/重叠/);
  });
  it("拒绝分数分、非有限金额和重复名称", () => {
    for (const amount of [NaN, Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER]) {
      expect(() =>
        allocateIncome(baseLedger(), {
          id: "bad",
          poolId: "daily",
          periodId: january.id,
          amount,
        }),
      ).toThrow();
    }
    expect(() =>
      createBudgetPool(baseLedger(), { id: "another", name: " 日常 " }),
    ).toThrow(/已存在/);
  });
});
