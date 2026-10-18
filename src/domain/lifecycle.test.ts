import { expect, it } from 'vitest';
import { allocateIncome, cancelSettlement, correctSettlement, createBudgetPeriod, createBudgetPool, createLedger, getPoolBalance, recordStatement, reviseStatement, settleStatement, transferBudget, type BudgetLedger } from './budget';
import { applyIncome, cancelIncome } from './income';
import { cancelRepayment, recordRepayment, repaymentSummary, saveCreditAccount } from './credit';
import { parseSnapshot, serializeSnapshot } from '@/storage/snapshot';
import { summarizePeriod } from './analytics';

it('连续三周期：旧格式迁移、负结转、跨期更正、收入修正、分次还款与备份恢复', () => {
  const roundTrip = (ledger: BudgetLedger) => parseSnapshot(serializeSnapshot({ ledger, currentPeriod: 'dec' }, true)).workspace.ledger;
  let ledger = createLedger();
  for (const [id, startsOn, endsOn] of [['oct', '2026-10-10', '2026-11-09'], ['nov', '2026-11-10', '2026-12-09'], ['dec', '2026-12-10', '2027-01-09']]) {
    ledger = createBudgetPeriod(ledger, { id, name: id, startsOn, endsOn });
  }
  for (const id of ['food', 'tech']) ledger = createBudgetPool(ledger, { id, name: id });
  const v1 = JSON.parse(serializeSnapshot({ ledger, currentPeriod: 'dec' })); v1.schemaVersion = 1;
  expect(parseSnapshot(JSON.stringify(v1)).workspace.ledger).toEqual(ledger);
  ledger = applyIncome(ledger, { id: 'oct-pay', periodId: 'oct', reference: '十月工资', receivedOn: '2026-10-10', amount: 100000, plannedSavings: 30000, allocations: [{ poolId: 'food', amount: 40000 }, { poolId: 'tech', amount: 20000 }] });
  const v2 = JSON.parse(serializeSnapshot({ ledger, currentPeriod: 'dec' })); v2.schemaVersion = 2;
  expect(parseSnapshot(JSON.stringify(v2)).workspace.ledger).toEqual(ledger);
  ledger = saveCreditAccount(ledger, { id: 'card', name: '验收信用卡', active: true });
  ledger = recordStatement(ledger, { id: 'a', creditAccountId: 'card', accountId: '验收信用卡', fingerprint: 'oct', amount: 90000, statementOn: '2026-10-05', dueOn: '2026-10-25' });
  ledger = recordRepayment(ledger, { id: 'pay-a1', statementId: 'a', reference: '首笔', amount: 40000, paidOn: '2026-10-20' });
  ledger = settleStatement(ledger, 'a', [{ id: 'a-food', poolId: 'food', periodId: 'oct', amount: 30000 }, { id: 'a-tech', poolId: 'tech', periodId: 'oct', amount: 60000 }]);
  ledger = recordRepayment(ledger, { id: 'pay-a2', statementId: 'a', reference: '尾款', amount: 50000, paidOn: '2026-10-25' });
  ledger = roundTrip(ledger);
  expect(getPoolBalance(ledger, 'tech', 'oct')).toBe(-40000);
  ledger = applyIncome(ledger, { id: 'nov-pay', periodId: 'nov', reference: '十一月工资', receivedOn: '2026-11-10', amount: 100000, plannedSavings: 50000, allocations: [{ poolId: 'food', amount: 30000 }, { poolId: 'tech', amount: 20000 }] });
  expect(getPoolBalance(ledger, 'tech', 'nov')).toBe(-20000);
  ledger = recordStatement(ledger, { id: 'b', creditAccountId: 'card', accountId: '验收信用卡', fingerprint: 'nov', amount: 10000, statementOn: '2026-11-05', dueOn: '2026-11-25' });
  ledger = settleStatement(ledger, 'b', [{ id: 'b-tech', poolId: 'tech', periodId: 'nov', amount: 5000 }, { id: 'b-food', poolId: 'food', periodId: 'dec', amount: 5000 }]);
  ledger = transferBudget(ledger, { id: 'transfer', periodId: 'nov', fromPoolId: 'food', toPoolId: 'tech', amount: 10000, reason: '显式补充数码预算' });
  ledger = correctSettlement(ledger, 'b', [{ id: 'b-correct', poolId: 'tech', periodId: 'nov', amount: 10000 }], '分类修正');
  ledger = cancelSettlement(ledger, 'b', '账单总额修正');
  ledger = reviseStatement(ledger, 'b', { creditAccountId: 'card', accountId: '验收信用卡', fingerprint: 'nov', amount: 12000, statementOn: '2026-11-05', dueOn: '2026-11-25' }, '更正总额');
  ledger = settleStatement(ledger, 'b', [{ id: 'b-final', poolId: 'food', periodId: 'dec', amount: 12000 }]);
  ledger = recordRepayment(ledger, { id: 'pay-b', statementId: 'b', reference: '全额', amount: 12000, paidOn: '2026-11-25' });
  ledger = roundTrip(ledger);
  ledger = applyIncome(ledger, { id: 'dec-pay', periodId: 'dec', reference: '十二月工资', receivedOn: '2026-12-10', amount: 100000, plannedSavings: 70000, allocations: [{ poolId: 'food', amount: 20000 }, { poolId: 'tech', amount: 10000 }] });
  expect(getPoolBalance(ledger, 'food', 'dec')).toBe(38000);
  expect(getPoolBalance(ledger, 'tech', 'dec')).toBe(0);
  ledger = cancelIncome(ledger, 'nov-pay', '拨款计划录错');
  expect(getPoolBalance(ledger, 'tech', 'dec')).toBe(-20000);
  ledger = applyIncome(ledger, { id: 'nov-corrected', periodId: 'nov', reference: '十一月工资修正', receivedOn: '2026-11-10', amount: 100000, plannedSavings: 60000, allocations: [{ poolId: 'food', amount: 20000 }, { poolId: 'tech', amount: 20000 }] });
  const entries = ledger.entries;
  ledger = cancelRepayment(ledger, 'pay-a1', '首笔记录修正');
  ledger = recordRepayment(ledger, { id: 'pay-a3', statementId: 'a', reference: '首笔修正', amount: 40000, paidOn: '2026-10-20' });
  expect(ledger.entries).toEqual(entries);
  expect(repaymentSummary(ledger, ledger.statements[0]).paid).toBe(90000);
  expect(repaymentSummary(ledger, ledger.statements[1]).paid).toBe(12000);
  ledger = roundTrip(ledger);
  expect(getPoolBalance(ledger, 'food', 'dec')).toBe(28000);
  expect(getPoolBalance(ledger, 'tech', 'dec')).toBe(0);
  for (const id of ['oct', 'nov', 'dec']) {
    const summary = summarizePeriod(ledger, id);
    expect(summary.opening + summary.funding - summary.settled + summary.transferred).toBe(summary.closing);
    expect(summary.transferred).toBe(0);
  }
  // Independent manual funding remains available and is not inferred as income.
  const granted = allocateIncome(ledger, { id: 'manual', poolId: 'food', periodId: 'dec', amount: 1 });
  expect(granted.planning).toEqual(ledger.planning);
  expect(roundTrip(granted).entries.at(-1)?.amount).toBe(1);
});
