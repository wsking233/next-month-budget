// Explicitly loaded into a separate workspace. Never seeds the user's ledger.
import { createLedger, createBudgetPeriod, createBudgetPool, allocateIncome, recordStatement } from '@/domain/budget';
export function createDemoLedger() {
  let ledger = createLedger();
  ledger = createBudgetPeriod(ledger, { id: 'oct', name: '十月预算', startsOn: '2026-10-10', endsOn: '2026-11-09' });
  ledger = createBudgetPeriod(ledger, { id: 'nov', name: '十一月预算', startsOn: '2026-11-10', endsOn: '2026-12-09' });
  for (const [id, name] of [['daily', '日常生活'], ['digital', '数码兴趣'], ['travel', '远行与探索']]) ledger = createBudgetPool(ledger, { id, name });
  ledger = allocateIncome(ledger, { id: 'seed-1', periodId: 'oct', poolId: 'daily', amount: 350000 });
  ledger = allocateIncome(ledger, { id: 'seed-2', periodId: 'oct', poolId: 'digital', amount: 200000 });
  for (const [id, accountId, fingerprint, amount, statementOn, dueOn] of [
    ['a', '演示信用卡 A', 'DEMO-2026-10-A', 260000, '2026-10-05', '2026-10-25'],
    ['b', '演示信用卡 B', 'DEMO-2026-10-B', 310000, '2026-10-18', '2026-11-08'],
  ] as const) ledger = recordStatement(ledger, { id, accountId, fingerprint, amount, statementOn, dueOn });
  return ledger;
}
