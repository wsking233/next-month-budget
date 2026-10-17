import type { BudgetLedger, BudgetPool } from '@/domain/budget';
import { getPoolBalance } from '@/domain/budget';
import { money } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Empty, Jump } from './ui';

export function PoolCards({ ledger, periodId, edit }: { ledger: BudgetLedger; periodId: string; edit?: (pool: BudgetPool) => void }) {
  const periodIndex = ledger.periods.findIndex(p => p.id === periodId);
  if (!ledger.pools.length) return <Empty title="给生活留一个预算空间">先创建资金池，再单独安排拨款。<div className="mt-3"><Jump to="/pools">前往资金池</Jump></div></Empty>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{ledger.pools.map(pool => {
    const closing = periodIndex >= 0 ? getPoolBalance(ledger, pool.id, periodId) : 0;
    const opening = periodIndex > 0 ? getPoolBalance(ledger, pool.id, ledger.periods[periodIndex - 1].id) : 0;
    return <article key={pool.id} className="min-w-0 rounded-xl border border-border p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="break-words font-medium">{pool.name}</h3><span className="text-xs text-muted-foreground">{pool.active ? '启用' : '已停用'}</span></div><p className={`money mt-5 break-words text-2xl font-semibold ${closing < 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{money(closing)}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{periodIndex < 0 ? '请先创建并选择周期' : closing < 0 ? '预算为负 · 下期拨款优先抵扣' : '截至所选周期的预算余额 · 非现金'}</p><dl className="mt-4 grid gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><div className="flex flex-wrap justify-between gap-2"><dt>上期结转</dt><dd className="money">{money(opening)}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt>本期净变动</dt><dd className="money">{money(closing - opening)}</dd></div></dl>{edit && <Button className="mt-4" variant="outline" onClick={() => edit(pool)}>编辑资金池</Button>}</article>;
  })}</div>;
}
