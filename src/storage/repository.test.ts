import { describe, expect, it } from "vitest";
import {
  allocateIncome,
  cancelSettlement,
  correctSettlement,
  createBudgetPeriod,
  createBudgetPool,
  createLedger,
  recordRepayment,
  recordStatement,
  reopenStatement,
  settleStatement,
  transferBudget,
  voidRepayment,
} from "@/domain/budget";
import {
  exportBackup,
  importBackup,
  LocalStorageRepository,
  STORAGE_KEY,
} from "./repository";
import { validateLedger } from "./schema";
import { createWorkspaceStore } from "./store";
function complete() {
  let l = createBudgetPeriod(createLedger(), {
    id: "p",
    startsOn: "2026-10-10",
    endsOn: "2026-11-09",
  });
  l = createBudgetPool(l, { id: "a", name: "日常" });
  l = createBudgetPool(l, { id: "b", name: "数码" });
  l = allocateIncome(l, {
    id: "in",
    poolId: "a",
    periodId: "p",
    amount: 200000,
  });
  l = recordStatement(l, {
    id: "s",
    accountId: "卡",
    fingerprint: "卡:10",
    amount: 400000,
    dueOn: "2026-10-25",
  });
  l = settleStatement(l, "s", [
    { id: "alloc", poolId: "a", periodId: "p", amount: 400000 },
  ]);
  l = correctSettlement(
    l,
    "s",
    [{ id: "alloc2", poolId: "b", periodId: "p", amount: 400000 }],
    "改分类",
  );
  l = cancelSettlement(l, "s", "核对");
  l = reopenStatement(l, "s", "完成");
  l = settleStatement(l, "s", [
    { id: "alloc3", poolId: "a", periodId: "p", amount: 400000 },
  ]);
  l = transferBudget(l, {
    id: "t",
    periodId: "p",
    fromPoolId: "a",
    toPoolId: "b",
    amount: 100,
    reason: "调拨",
  });
  return recordRepayment(l, {
    id: "r",
    statementId: "s",
    amount: 100,
    paidOn: "2026-10-25",
  });
}
function memory(initial: string | null = null) {
  let raw = initial;
  return {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
}
describe("版本化账本与备份", () => {
  it("复杂账本、空账本导出恢复相等", () => {
    for (const l of [
      createLedger(),
      complete(),
      voidRepayment(complete(), "r", "录入错误"),
    ])
      expect(importBackup(exportBackup(l))).toEqual(l);
  });
  it.each([
    "not json",
    "{}",
    "null",
    "[]",
    '{"format":"next-month-budget","schemaVersion":999}',
  ])("拒绝无效文件 %s", (raw) => {
    expect(() => importBackup(raw)).toThrow();
  });
  it("拒绝校验码损坏", () => {
    expect(() =>
      importBackup(exportBackup(complete()).replace("日常", "旅行")),
    ).toThrow(/校验码/);
  });
  it("拒绝重复 ID、孤儿引用、未配对调拨、错误分配、反向符号、缺审计及无对应冲销", () => {
    const source = complete();
    const cases = [
      { ...source, pools: [...source.pools, source.pools[0]] },
      {
        ...source,
        entries: source.entries.map((e, i) =>
          i === 0 ? { ...e, poolId: "absent" } : e,
        ),
      },
      {
        ...source,
        entries: source.entries.filter((e) => e.kind !== "transfer_in"),
      },
      {
        ...source,
        statements: source.statements.map((s) => ({ ...s, amount: 1 })),
      },
      {
        ...source,
        entries: source.entries.map((e) =>
          e.kind === "income_allocation" ? { ...e, amount: -1 } : e,
        ),
      },
      { ...source, audit: source.audit.slice(1) },
      {
        ...source,
        entries: [
          ...source.entries,
          {
            id: "bad",
            poolId: "a",
            periodId: "p",
            kind: "reversal",
            amount: 123,
            sourceId: "s",
          },
        ],
      },
    ];
    for (const l of cases) expect(() => validateLedger(l)).toThrow();
  });
  it("刷新读取一致，版本冲突不覆盖", () => {
    const storage = memory();
    const a = new LocalStorageRepository(storage),
      b = new LocalStorageRepository(storage);
    const before = b.load();
    const original = complete();
    const rev = a.save(original, null);
    expect(a.load().ledger).toEqual(original);
    expect(() => b.save(createLedger(), before.revision)).toThrow(/标签页/);
    expect(storage.getItem()).toBe(rev);
  });
  it("配额不足保持原存储，损坏原文件不会被初始化覆盖", () => {
    const storage = memory("broken");
    const repo = new LocalStorageRepository(storage);
    const store = createWorkspaceStore(repo);
    expect(store.getState().blocked).toBe(true);
    expect(() => store.getState().commit((l) => l)).toThrow();
    expect(storage.getItem()).toBe("broken");
    expect(STORAGE_KEY).toContain("v1");
    const failing = new LocalStorageRepository({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => failing.save(createLedger(), null)).toThrow(/保存失败/);
  });
  it("业务或保存失败保持原内存；成功才发布新状态；演示不访问正式仓储", () => {
    const storage = memory();
    const repo = new LocalStorageRepository(storage);
    const store = createWorkspaceStore(repo);
    expect(() =>
      store.getState().commit(() => {
        throw new Error("invalid");
      }),
    ).toThrow();
    expect(store.getState().ledger).toEqual(createLedger());
    store
      .getState()
      .commit((l) => createBudgetPool(l, { id: "a", name: "正式" }));
    const saved = storage.getItem();
    store.getState().toggleDemo();
    store
      .getState()
      .commit((l) => createBudgetPool(l, { id: "b", name: "演示新增" }));
    expect(storage.getItem()).toBe(saved);
    store.getState().toggleDemo();
    expect(store.getState().ledger.pools.map((p) => p.name)).toEqual(["正式"]);
    storage.setItem("", "changed elsewhere");
    expect(() =>
      store
        .getState()
        .commit((l) => createBudgetPool(l, { id: "c", name: "不会保存" })),
    ).toThrow();
    expect(store.getState().ledger.pools).toHaveLength(1);
  });
});
