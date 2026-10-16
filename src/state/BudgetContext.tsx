import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

import {
  allocateIncome,
  createBudgetPeriod,
  createBudgetPool,
  createLedger,
  getPoolBalance,
  recordStatement,
  settleStatement,
  type BudgetLedger,
} from '@/domain/budget';

const demo = {
  period: { id: 'demo-period', startsOn: '2027-01-10', endsOn: '2027-02-09' },
  dailyPool: { id: 'demo-daily', name: '日常（演示）' },
  digitalPool: { id: 'demo-digital', name: '数码（演示）' },
  statement: {
    id: 'demo-statement',
    accountId: 'demo-card',
    fingerprint: 'demo-card:2027-01',
    amount: 6_200_00,
    dueOn: '2027-02-05',
  },
} as const;

type BudgetContextValue = {
  ledger: BudgetLedger;
  error?: string;
  hasPeriod: boolean;
  hasPools: boolean;
  hasAllocation: boolean;
  hasStatement: boolean;
  isSettled: boolean;
  dailyBalance: number;
  digitalBalance: number;
  createDemoPeriod(): void;
  createDemoPools(): void;
  allocateDemoBudget(): void;
  recordDemoStatement(): void;
  settleDemoStatement(): void;
  resetDemo(): void;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<{ ledger: BudgetLedger; error?: string }>(() => ({ ledger: createLedger() }));
  const { ledger, error } = state;

  function apply(command: (current: BudgetLedger) => BudgetLedger) {
    setState((current) => {
      try {
        return { ledger: command(current.ledger) };
      } catch (caught) {
        return { ...current, error: caught instanceof Error ? caught.message : '操作失败' };
      }
    });
  }

  const value = useMemo<BudgetContextValue>(() => {
    const hasPeriod = ledger.periods.some((item) => item.id === demo.period.id);
    const hasPools = ledger.pools.some((item) => item.id === demo.dailyPool.id) && ledger.pools.some((item) => item.id === demo.digitalPool.id);
    const hasAllocation = ledger.entries.some((item) => item.kind === 'income_allocation');
    const statement = ledger.statements.find((item) => item.id === demo.statement.id);
    return {
      ledger,
      error,
      hasPeriod,
      hasPools,
      hasAllocation,
      hasStatement: Boolean(statement),
      isSettled: statement?.status === 'settled',
      dailyBalance: hasPools && hasPeriod ? getPoolBalance(ledger, demo.dailyPool.id, demo.period.id) : 0,
      digitalBalance: hasPools && hasPeriod ? getPoolBalance(ledger, demo.digitalPool.id, demo.period.id) : 0,
      createDemoPeriod: () => apply((current) => createBudgetPeriod(current, demo.period)),
      createDemoPools: () => apply((current) => createBudgetPool(createBudgetPool(current, demo.dailyPool), demo.digitalPool)),
      allocateDemoBudget: () => apply((current) => {
        let next = allocateIncome(current, { id: 'demo-income-daily', periodId: demo.period.id, poolId: demo.dailyPool.id, amount: 4_000_00 });
        next = allocateIncome(next, { id: 'demo-income-digital', periodId: demo.period.id, poolId: demo.digitalPool.id, amount: 3_000_00 });
        return next;
      }),
      recordDemoStatement: () => apply((current) => recordStatement(current, demo.statement)),
      settleDemoStatement: () => apply((current) => settleStatement(current, demo.statement.id, [
        { id: 'demo-allocation-daily', poolId: demo.dailyPool.id, periodId: demo.period.id, amount: 2_800_00 },
        { id: 'demo-allocation-digital', poolId: demo.digitalPool.id, periodId: demo.period.id, amount: 3_400_00 },
      ])),
      resetDemo: () => {
        setState({ ledger: createLedger() });
      },
    };
  }, [error, ledger]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget() {
  const value = useContext(BudgetContext);
  if (!value) throw new Error('useBudget 必须在 BudgetProvider 内使用');
  return value;
}

export function formatCents(amount: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount / 100);
}
