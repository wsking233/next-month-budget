import { describe, expect, it } from 'vitest';

import {
  allocateIncome,
  updateBudgetPool,
  reviseStatement,
  cancelSettlement,
  correctSettlement,
  createBudgetPeriod,
  createBudgetPool,
  createLedger,
  getPoolBalance,
  recordStatement,
  settleStatement,
  transferBudget,
} from './budget';

const january = { id: 'period-jan', startsOn: '2027-01-10', endsOn: '2027-02-09' };
const february = { id: 'period-feb', startsOn: '2027-02-10', endsOn: '2027-03-09' };

function baseLedger() {
  let ledger = createLedger();
  ledger = createBudgetPeriod(ledger, january);
  ledger = createBudgetPeriod(ledger, february);
  ledger = createBudgetPool(ledger, { id: 'daily', name: '日常' });
  ledger = createBudgetPool(ledger, { id: 'digital', name: '数码' });
  return ledger;
}

describe('预算领域规则', () => {
  it('负余额跨期保留，后续拨款优先抵扣', () => {
    let ledger = baseLedger();
    ledger = allocateIncome(ledger, { id: 'entry-1', periodId: january.id, poolId: 'digital', amount: 2_000_00 });
    ledger = recordStatement(ledger, { id: 'statement-1', accountId: 'card-a', fingerprint: 'card-a:2027-01', amount: 4_000_00, dueOn: '2027-02-02' });
    ledger = settleStatement(ledger, 'statement-1', [
      { id: 'allocation-1', poolId: 'digital', periodId: january.id, amount: 4_000_00 },
    ]);

    expect(getPoolBalance(ledger, 'digital', january.id)).toBe(-2_000_00);

    ledger = allocateIncome(ledger, { id: 'entry-2', periodId: february.id, poolId: 'digital', amount: 2_000_00 });
    expect(getPoolBalance(ledger, 'digital', february.id)).toBe(0);
  });

  it('同一账单允许按明确周期拆分归属', () => {
    let ledger = baseLedger();
    ledger = recordStatement(ledger, { id: 'statement-2', accountId: 'card-a', fingerprint: 'card-a:2027-02', amount: 6_200_00, dueOn: '2027-03-01' });
    ledger = settleStatement(ledger, 'statement-2', [
      { id: 'allocation-2a', poolId: 'daily', periodId: january.id, amount: 2_800_00 },
      { id: 'allocation-2b', poolId: 'digital', periodId: february.id, amount: 3_400_00 },
    ]);

    expect(getPoolBalance(ledger, 'daily', january.id)).toBe(-2_800_00);
    expect(getPoolBalance(ledger, 'digital', january.id)).toBe(0);
    expect(getPoolBalance(ledger, 'digital', february.id)).toBe(-3_400_00);
  });

  it('调拨同时产生一出一入且预算总额不变，失败时不产生半边记录', () => {
    let ledger = baseLedger();
    ledger = allocateIncome(ledger, { id: 'entry-3', periodId: january.id, poolId: 'daily', amount: 1_500_00 });
    const beforeTotal = getPoolBalance(ledger, 'daily', january.id) + getPoolBalance(ledger, 'digital', january.id);
    const transferred = transferBudget(ledger, { id: 'transfer-1', periodId: january.id, fromPoolId: 'daily', toPoolId: 'digital', amount: 1_000_00, reason: '脱敏测试调拨' });

    expect(getPoolBalance(transferred, 'daily', january.id)).toBe(500_00);
    expect(getPoolBalance(transferred, 'digital', january.id)).toBe(1_000_00);
    expect(getPoolBalance(transferred, 'daily', january.id) + getPoolBalance(transferred, 'digital', january.id)).toBe(beforeTotal);
    expect(ledger.entries).toHaveLength(1);
    expect(() => transferBudget(ledger, { id: 'transfer-2', periodId: january.id, fromPoolId: 'daily', toPoolId: 'missing', amount: 100_00, reason: '应失败' })).toThrow();
    expect(ledger.entries).toHaveLength(1);
    expect(() => transferBudget(transferred, { id: 'transfer-1', periodId: january.id, fromPoolId: 'daily', toPoolId: 'digital', amount: 1_000_00, reason: '重复提交' })).toThrow(/已存在/);
  });

  it('取消结算生成反向流水；更正结算先冲销旧分配再应用新分配', () => {
    let ledger = baseLedger();
    ledger = recordStatement(ledger, { id: 'statement-3', accountId: 'card-b', fingerprint: 'card-b:2027-01', amount: 1_000_00, dueOn: '2027-02-05' });
    ledger = settleStatement(ledger, 'statement-3', [
      { id: 'allocation-3', poolId: 'daily', periodId: january.id, amount: 1_000_00 },
    ]);
    const cancelled = cancelSettlement(ledger, 'statement-3', '分类错误');
    expect(getPoolBalance(cancelled, 'daily', january.id)).toBe(0);
    expect(cancelled.audit.at(-1)?.kind).toBe('settlement_cancelled');

    const corrected = correctSettlement(ledger, 'statement-3', [
      { id: 'allocation-3-corrected', poolId: 'digital', periodId: january.id, amount: 1_000_00 },
    ], '改归数码');
    expect(getPoolBalance(corrected, 'daily', january.id)).toBe(0);
    expect(getPoolBalance(corrected, 'digital', january.id)).toBe(-1_000_00);
    expect(corrected.audit.at(-1)?.kind).toBe('settlement_corrected');
  });

  it('拒绝重复账单、重复结算和分配总额不一致', () => {
    let ledger = baseLedger();
    const statement = { id: 'statement-4', accountId: 'card-c', fingerprint: 'card-c:2027-01', amount: 900_00, dueOn: '2027-02-08' };
    ledger = recordStatement(ledger, statement);

    expect(() => recordStatement(ledger, { ...statement, id: 'statement-copy' })).toThrow(/重复/);
    expect(() => settleStatement(ledger, 'statement-4', [
      { id: 'allocation-invalid', poolId: 'daily', periodId: january.id, amount: 800_00 },
    ])).toThrow(/一致/);

    ledger = settleStatement(ledger, 'statement-4', [
      { id: 'allocation-4', poolId: 'daily', periodId: january.id, amount: 900_00 },
    ]);
    expect(() => settleStatement(ledger, 'statement-4', [
      { id: 'allocation-4-copy', poolId: 'daily', periodId: january.id, amount: 900_00 },
    ])).toThrow(/已经结算/);
  });
});

// Phase 3: regressions required before connecting mutable UI forms.
describe('内存账务闭环与边界', () => {
  it('历史更正传播到后续周期，多次更正后撤销仍精确还原且流水 ID 唯一', () => {
    let ledger = baseLedger();
    ledger = recordStatement(ledger, { id: 's', accountId: 'a', fingerprint: 'f', amount: 10001, dueOn: '2027-02-01' });
    ledger = settleStatement(ledger, 's', [{ id: 'x', poolId: 'daily', periodId: january.id, amount: 10001 }]);
    const before = structuredClone(ledger);
    expect(() => correctSettlement(ledger, 's', [{ id: 'x', poolId: 'digital', periodId: february.id, amount: 10000 }], '错误')).toThrow();
    expect(ledger).toEqual(before);
    ledger = correctSettlement(ledger, 's', [{ id: 'x', poolId: 'digital', periodId: february.id, amount: 10001 }], '移动到次期');
    expect(getPoolBalance(ledger, 'daily', february.id)).toBe(0);
    expect(getPoolBalance(ledger, 'digital', january.id)).toBe(0);
    expect(getPoolBalance(ledger, 'digital', february.id)).toBe(-10001);
    ledger = correctSettlement(ledger, 's', [{ id: 'x', poolId: 'daily', periodId: january.id, amount: 10001 }], '恢复归属');
    ledger = cancelSettlement(ledger, 's', '撤销');
    expect(getPoolBalance(ledger, 'daily', february.id)).toBe(0);
    expect(getPoolBalance(ledger, 'digital', february.id)).toBe(0);
    expect(new Set(ledger.entries.map(e => e.id)).size).toBe(ledger.entries.length);
    expect(ledger.audit.at(-1)?.reason).toBe('撤销');
    expect(() => cancelSettlement(ledger, 's', '重复')).toThrow();
  });
  it('拒绝真实不存在的日期与不安全的累计余额，失败不变', () => {
    const ledger = baseLedger();
    expect(() => createBudgetPeriod(ledger, { id: 'bad', startsOn: '2027-02-30', endsOn: '2027-03-01' })).toThrow(/日期/);
    const funded = allocateIncome(ledger, { id: 'large', poolId: 'daily', periodId: january.id, amount: Number.MAX_SAFE_INTEGER });
    expect(() => allocateIncome(funded, { id: 'overflow', poolId: 'daily', periodId: january.id, amount: 1 })).toThrow(/安全/);
    expect(funded.entries).toHaveLength(1);
  });
  it('账户内去重，空白规范化，不同账户可使用同一账单标识', () => {
    let ledger = recordStatement(baseLedger(), { id: 'a', accountId: ' card ', fingerprint: ' f ', amount: 1, dueOn: '2027-02-01' });
    expect(() => recordStatement(ledger, { id: 'b', accountId: 'card', fingerprint: 'f', amount: 1, dueOn: '2027-02-01' })).toThrow(/重复/);
    ledger = recordStatement(ledger, { id: 'c', accountId: 'other', fingerprint: 'f', amount: 1, dueOn: '2027-02-01' });
    expect(ledger.statements).toHaveLength(2);
  });
});

describe('资料维护与停用', () => {
  it('资金池须先清零并处理未来安排；停用不删除历史，停用后不能拨款', () => {
    let ledger = allocateIncome(baseLedger(), { id: 'fund', poolId: 'daily', periodId: january.id, amount: 100 });
    expect(() => updateBudgetPool(ledger, 'daily', '日常新名', false, january.id)).toThrow(/余额/);
    ledger = transferBudget(ledger, { id: 'move', periodId: january.id, fromPoolId: 'daily', toPoolId: 'digital', amount: 100, reason: '清零' });
    const closed = updateBudgetPool(ledger, 'daily', '日常新名', false, january.id);
    expect(closed.pools[0].active).toBe(false);
    expect(closed.entries).toEqual(ledger.entries);
    expect(() => allocateIncome(closed, { id: 'bad', poolId: 'daily', periodId: january.id, amount: 1 })).toThrow(/停用/);
    const future = allocateIncome(ledger, { id: 'future', poolId: 'daily', periodId: february.id, amount: 100 });
    expect(() => updateBudgetPool(future, 'daily', '日常', false, january.id)).toThrow(/未来/);
  });
  it('撤销后修改资料重新结算，不重复流水；已结算总额修改需先撤销', () => {
    let ledger = recordStatement(baseLedger(), { id: 's', accountId: 'card', fingerprint: 'f', amount: 100, dueOn: '2027-02-01' });
    const allocations = [{ id: 'x', poolId: 'daily', periodId: january.id, amount: 100 }];
    ledger = settleStatement(ledger, 's', allocations);
    const patch = { accountId: 'card', fingerprint: 'f', amount: 200, dueOn: '2027-02-01' };
    expect(() => reviseStatement(ledger, 's', patch, '改总额')).toThrow(/撤销/);
    ledger = cancelSettlement(ledger, 's', '需改总额');
    ledger = reviseStatement(ledger, 's', patch, '更正原总额');
    ledger = settleStatement(ledger, 's', [{ ...allocations[0], amount: 200 }]);
    expect(getPoolBalance(ledger, 'daily', february.id)).toBe(-200);
    expect(new Set(ledger.entries.map(e => e.id)).size).toBe(ledger.entries.length);
    expect(ledger.audit.some(e => e.kind === 'statement_revised' && e.reason === '更正原总额')).toBe(true);
  });
});

describe('审计可追溯与累计精度', () => {
  it('保留操作时的名称与资料，重命名不篡改先前审计', () => {
    let ledger = baseLedger();
    ledger = allocateIncome(ledger, { id: 'fund', poolId: 'daily', periodId: january.id, amount: 12345 });
    const audit = ledger.audit.at(-1)!;
    ledger = updateBudgetPool(ledger, 'daily', '新日常', true, january.id);
    expect(ledger.audit.find(a => a.id === audit.id)).toEqual(audit);
    expect(audit.description).toContain('日常');
    expect(audit.description).toContain('123.45');
    expect(audit.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('总预算和账单累计金额也必须保持安全整数', () => {
    let ledger = allocateIncome(baseLedger(), { id: 'max', poolId: 'daily', periodId: january.id, amount: Number.MAX_SAFE_INTEGER });
    expect(() => allocateIncome(ledger, { id: 'extra', poolId: 'digital', periodId: january.id, amount: 1 })).toThrow(/安全/);
    ledger = recordStatement(ledger, { id: 'bill', accountId: 'a', fingerprint: 'a', amount: Number.MAX_SAFE_INTEGER, dueOn: '2027-02-01' });
    expect(() => recordStatement(ledger, { id: 'extra-bill', accountId: 'b', fingerprint: 'b', amount: 1, dueOn: '2027-02-01' })).toThrow(/安全/);
  });
});
