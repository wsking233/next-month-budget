import type { BudgetLedger } from "@/domain/budget";
// 仅供显式进入的演示空间；绝不作为正式账本初始值。
export function demoLedger(): BudgetLedger {
  return {
    periods: [
      { id: "demo-period", startsOn: "2026-10-10", endsOn: "2026-11-09" },
    ],
    pools: [
      { id: "demo-daily", name: "日常生活 · 演示", active: true },
      { id: "demo-digital", name: "数码兴趣 · 演示", active: true },
    ],
    statements: [
      {
        id: "demo-statement",
        accountId: "示例信用卡",
        fingerprint: "示例信用卡:2026-10",
        amount: 260000,
        dueOn: "2026-10-25",
        status: "recorded",
        allocations: [],
      },
    ],
    entries: [
      {
        id: "demo-entry",
        poolId: "demo-daily",
        periodId: "demo-period",
        amount: 350000,
        kind: "income_allocation",
        sourceId: "demo-entry",
      },
    ],
    audit: [],
    repayments: [],
  };
}
