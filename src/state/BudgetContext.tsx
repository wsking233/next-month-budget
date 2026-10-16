import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

import {
  allocateIncome,
  createBudgetPeriod,
  createBudgetPool,
  createLedger,
  recordStatement,
  settleStatement,
  type Allocation,
  type BudgetLedger,
  type BudgetPeriod,
} from '@/domain/budget';

type Result = { ok: true } | { ok: false; error: string };

type BudgetContextValue = {
  ledger: BudgetLedger;
  latestPeriod?: BudgetPeriod;
  createPeriod(input: { startsOn: string; endsOn: string }): Result;
  createPool(name: string): Result;
  allocateBudget(input: { periodId: string; poolId: string; amount: number }): Result;
  createAndSettleStatement(input: {
    accountId: string;
    statementKey: string;
    amount: number;
    dueOn: string;
    allocations: Omit<Allocation, 'id'>[];
  }): Result;
  resetAll(): void;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);
let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

export function BudgetProvider({ children }: PropsWithChildren) {
  const [ledger, setLedger] = useState<BudgetLedger>(createLedger);

  function execute(command: (current: BudgetLedger) => BudgetLedger): Result {
    try {
      setLedger(command(ledger));
      return { ok: true };
    } catch (caught) {
      return { ok: false, error: caught instanceof Error ? caught.message : '操作失败' };
    }
  }

  const value = useMemo<BudgetContextValue>(() => ({
    ledger,
    latestPeriod: ledger.periods.at(-1),
    createPeriod: ({ startsOn, endsOn }) => execute((current) => createBudgetPeriod(current, {
      id: nextId('period'),
      startsOn,
      endsOn,
    })),
    createPool: (name) => execute((current) => createBudgetPool(current, {
      id: nextId('pool'),
      name,
    })),
    allocateBudget: ({ periodId, poolId, amount }) => execute((current) => allocateIncome(current, {
      id: nextId('allocation'),
      periodId,
      poolId,
      amount,
    })),
    createAndSettleStatement: ({ accountId, statementKey, amount, dueOn, allocations }) => execute((current) => {
      const statementId = nextId('statement');
      const recorded = recordStatement(current, {
        id: statementId,
        accountId,
        fingerprint: `${accountId.trim()}:${statementKey.trim()}`,
        amount,
        dueOn,
      });
      return settleStatement(recorded, statementId, allocations.map((allocation) => ({
        ...allocation,
        id: nextId('statement-allocation'),
      })));
    }),
    resetAll: () => setLedger(createLedger()),
  }), [ledger]);

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

export function parseYuan(value: string) {
  const normalized = value.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : undefined;
}

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
