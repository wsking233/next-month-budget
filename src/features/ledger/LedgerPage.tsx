import { exactSum } from '@/domain/analytics';
import { IncomePlanning } from '@/features/planning/IncomePlanning';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPoolBalance, type BudgetPool, type Statement } from '@/domain/budget';
import { money, sumCents } from '@/lib/money';
import type { pages } from '@/pages/config';
import { useLedger } from './context';
import { LedgerForm, AllocationForm, CancelForm, PoolForm, type FormKind } from './forms';
import { Panel, Empty, Jump, Field, Input, Select } from './ui';
import { Statistics } from '@/features/planning/Statistics';
import { Forecast } from '@/features/planning/Forecast';
import { BackupPanel } from './BackupPanel';
import { WorkspaceBar } from './WorkspaceBar';
import { PoolCards } from './PoolCards';
import { StatementCards } from './StatementCards';
import { AuditList } from './AuditList';
import { auditLabels, statementLabels } from './labels';

export function LedgerPage({ page }: { page: (typeof pages)[number] }) {
  const { ledger, currentPeriod, mode, persistence } = useLedger();
  const [form, setForm] = useState<FormKind | null>(null);
  const [statementAction, setStatementAction] = useState<{ kind: 'allocate' | 'cancel' | 'edit'; statement: Statement } | null>(null);
  const [editingPool, setEditingPool] = useState<BudgetPool | null>(null);
  const [filter, setFilter] = useState('全部');
  const [query, setQuery] = useState('');
  const [account, setAccount] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [notice, setNotice] = useState('');
  const invalidDates = Boolean(dueFrom && dueTo && dueFrom > dueTo);
  const filteredStatements = ledger.statements.filter(s =>
    (filter === '全部' || filter === s.status) &&
    s.accountId.toLocaleLowerCase().includes(account.trim().toLocaleLowerCase()) &&
    (!dueFrom || s.dueOn >= dueFrom) && (!dueTo || s.dueOn <= dueTo));
  const clearFilters = () => { setFilter('全部'); setQuery(''); setAccount(''); setDueFrom(''); setDueTo(''); };
  const steps = [
    { title: '创建预算周期', done: ledger.periods.length > 0, kind: 'period' as const },
    { title: '创建资金池', done: ledger.pools.length > 0, kind: 'pool' as const },
    { title: '预算拨款', done: ledger.entries.some(e => e.kind === 'income_allocation'), kind: 'funding' as const },
    { title: '登记并结算账单', done: ledger.statements.some(s => s.status === 'settled'), kind: 'statement' as const },
  ];
  const nextStep = steps.findIndex(step => !step.done);
  const completeForm = () => { setForm(null); setStatementAction(null); setEditingPool(null); setNotice('操作已完成。预算变更已应用；结算不代表实际还款。'); };
  const current = ledger.periods.find(p => p.id === currentPeriod);
  const pending = ledger.statements.filter(s => s.status === 'recorded');
  const total = current ? sumCents(ledger.pools.map(p => getPoolBalance(ledger, p.id, currentPeriod))) : 0;
  const funded = (periodId: string) => exactSum(ledger.entries.filter(e => (e.kind === 'income_allocation' || e.kind === 'income_reversal') && e.periodId === periodId).map(e => e.amount));
  const events = [...ledger.audit].reverse().filter(event => (filter === '全部' || event.kind === filter) && `${event.description} ${event.reason ?? ''}`.includes(query.trim()));
  const action = (kind: FormKind, title: string) => <Button onClick={() => setForm(kind)}><Plus aria-hidden="true" />{title}</Button>;
  const cards = (statements: Statement[]) => <StatementCards ledger={ledger} statements={statements} allocate={s => setStatementAction({ kind: 'allocate', statement: s })} cancel={s => setStatementAction({ kind: 'cancel', statement: s })} edit={s => setStatementAction({ kind: 'edit', statement: s })} />;

  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-3 text-xs font-semibold tracking-[0.2em] text-muted-foreground">我的预算空间</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{page.title}</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">{page.subtitle}</p></div>{page.path === '/pools' && action('pool', '创建资金池')}{page.path === '/statements' && action('statement', '登记账单')}{page.path === '/plans' && action('period', '创建预算周期')}</div>
    <WorkspaceBar />
    {notice && <p role="status" className="mb-5 rounded-xl bg-accent p-4 text-sm">{notice}</p>}
    <div className="grid gap-6">
      {page.path === '/' && <>
        <Panel title="按自己的节奏，安排这一期" action={<Jump to="/plans">管理周期</Jump>}><p className="text-xl font-semibold">{current?.name || '还没有预算周期'}</p><p className="mt-2 text-sm text-muted-foreground">{current ? `${current.startsOn} — ${current.endsOn}` : '先创建周期和资金池，再独立拨款、登记账单。'}</p></Panel>
        <div className="grid gap-4 sm:grid-cols-3">{[
          ['截至所选周期预算余额', money(total), '包括前期结转，不包括后续周期流水，不等于现金'],
          ['所选周期预算拨款', money(funded(currentPeriod)), '拨款只是预算额度分配'],
          ['待分配账单 · 全部周期', `${pending.length} 笔`, `待分配总额 ${money(pending.reduce((sum, s) => sum + s.amount, 0))}`],
        ].map(([label, value, note]) => <section key={label} className="min-w-0 rounded-2xl border border-border bg-card p-5"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="money mt-4 break-words text-2xl font-semibold">{value}</p><p className="mt-3 text-xs leading-6 text-muted-foreground">{note}</p></section>)}</div>
        <Panel title="资金池一览" action={<Jump to="/pools">管理资金池</Jump>}><PoolCards ledger={ledger} periodId={currentPeriod} /></Panel>
        <Statistics key={`${mode}:${currentPeriod}`} ledger={ledger} periodId={currentPeriod} />
        <Panel title="待处理账单" action={<Jump to="/statements">全部账单</Jump>}>{cards(pending)}</Panel>
        {mode === 'memory' && persistence.kind !== 'blocked' && <Panel title="建账进度"><p className="mb-4 text-sm text-muted-foreground">{nextStep === -1 ? '基础建账已完成，可继续管理周期和账单。' : '按顺序完成第一笔预算结算；各步骤状态来自当前账本。'}</p><ol className="grid gap-4 sm:grid-cols-2">{steps.map((step, index) => <li key={step.kind} className="rounded-xl border border-border p-4"><p className="mb-3 text-sm">{index + 1} · {step.title} · {step.done ? '已完成' : '待完成'}</p>{!step.done && index === nextStep && (step.kind === 'statement' && pending.length > 0 ? <Jump to="/statements">拆分核对已有账单</Jump> : <Button variant="outline" onClick={() => setForm(step.kind)}>{step.title}</Button>)}</li>)}</ol><div className="mt-4"><Jump to="/settings">已有备份？前往恢复</Jump></div></Panel>}

      </>}
      {page.path === '/pools' && <Panel title="所选周期资金池" action={<div className="flex flex-wrap gap-2">{action('funding', '预算拨款')}{action('transfer', '资金池调拨')}</div>}><p className="mb-5 text-sm leading-7 text-muted-foreground">余额包含上期正负结转与本期净变动。跨池调拨必须指定来源、去向和原因；不会自动补平超支。</p><PoolCards ledger={ledger} periodId={currentPeriod} edit={setEditingPool} /></Panel>}
      {page.path === '/statements' && <Panel title="信用卡账单"><div className="mb-5 grid gap-4 sm:grid-cols-2"><Field label="账单状态"><Select value={filter} onChange={e => setFilter(e.target.value)}><option value="全部">全部</option>{Object.entries(statementLabels).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</Select></Field><Field label="搜索账户"><Input type="search" value={account} onChange={e => setAccount(e.target.value)} placeholder="输入账户名称" /></Field><Field label="还款日起"><Input type="date" value={dueFrom} onChange={e => setDueFrom(e.target.value)} /></Field><Field label="还款日止"><Input type="date" value={dueTo} onChange={e => setDueTo(e.target.value)} /></Field></div><Button variant="outline" onClick={clearFilters}>清空筛选</Button>{invalidDates ? <p role="alert" className="mt-4 text-sm">还款日起不能晚于还款日止，请调整日期。</p> : <><p role="status" className="my-4 text-sm text-muted-foreground">匹配 {filteredStatements.length} / {ledger.statements.length} 张账单</p>{cards(filteredStatements)}</>}</Panel>}

      {page.path === '/plans' && <><IncomePlanning key={`${mode}:${currentPeriod}`} /><Panel title="预算周期" action={action('funding', '预算拨款')}>{ledger.periods.length ? <div className="grid gap-4 sm:grid-cols-2">{ledger.periods.map(p => <article key={p.id} className="min-w-0 rounded-xl border border-border p-5"><h3 className="break-words font-medium">{p.name || p.startsOn}{p.id === currentPeriod && <span className="ml-2 rounded-full bg-accent px-2 py-1 text-xs">当前查看</span>}</h3><p className="mt-3 text-sm text-muted-foreground">{p.startsOn} — {p.endsOn}</p><p className="money mt-5 break-words text-xl font-semibold">{money(funded(p.id))}</p><p className="mt-2 text-xs text-muted-foreground">此周期预算拨款 · 非现金转账</p></article>)}</div> : <Empty title="先定义你的预算节奏">周期可按发薪日开始，无需遵循自然月。<div className="mt-4">{action('period', '创建预算周期')}</div></Empty>}</Panel><Panel title="拨款与未来计划"><p className="text-sm leading-7 text-muted-foreground">创建周期不会自动拨款。请单独选择周期、资金池和金额；后续周期的拨款不计入当前周期余额。下方可进行只读模拟，额外假设不会写入账本。</p></Panel><Forecast key={`${mode}:${currentPeriod}:${ledger.audit.length}`} ledger={ledger} periodId={currentPeriod} /></>}
      {page.path === '/history' && <Panel title="账本操作记录"><div className="mb-5 grid gap-4 sm:grid-cols-2"><Field label="操作类型"><Select value={filter} onChange={e => setFilter(e.target.value)}><option value="全部">全部</option>{Object.entries(auditLabels).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</Select></Field><Field label="搜索记录"><Input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="资金池、周期、账单或原因" /></Field></div><Button variant="outline" onClick={clearFilters}>清空筛选</Button><p role="status" className="my-4 text-sm text-muted-foreground">匹配 {events.length} 条记录</p><p className="mb-5 text-xs leading-6 text-muted-foreground">按操作顺序倒序展示，记录原资料、分配和原因。历史记录及冲销流水仅追加，不覆盖；本地账本随操作自动保存。</p>{events.length ? <AuditList events={events} /> : <Empty title="暂时没有匹配的记录">试试其他筛选，或先创建周期、资金池并进行操作。</Empty>}</Panel>}
      {page.path === '/settings' && <><Panel title="账务与周期"><p className="text-sm leading-7">周期日期由你在预算计划中显式创建，不自动拨款、不自动清零。还款日归属仅为建议，每次结算仍可逐行选择周期。</p><div className="mt-4"><Jump to="/plans">管理预算周期</Jump></div></Panel><BackupPanel /><Panel title="账单更正与撤销"><p className="text-sm leading-7 text-muted-foreground">只改分类或归属周期，使用「更正分配」；更正会冲销旧分配并应用新分配。要改账单总额或账户资料，先撤销结算，再修改账单资料并重新核对。所有操作保留原因和历史，不自动标记为还款。</p></Panel></>}
    </div>
    {form && <LedgerForm kind={form} close={() => setForm(null)} completed={completeForm} />}
    {statementAction?.kind === 'allocate' && <AllocationForm statement={statementAction.statement} close={() => setStatementAction(null)} completed={completeForm} />}
    {statementAction?.kind === 'cancel' && <CancelForm statement={statementAction.statement} close={() => setStatementAction(null)} completed={completeForm} />}
    {statementAction?.kind === 'edit' && <LedgerForm kind="statement" editing={statementAction.statement} close={() => setStatementAction(null)} completed={completeForm} />}
    {editingPool && <PoolForm pool={editingPool} close={() => setEditingPool(null)} completed={completeForm} />}
    <p className="mt-6 text-xs leading-6 text-muted-foreground">预算余额不等于银行现金；结算不等于还款。本地账本仅在此浏览器保存，请定期备份。</p>
  </>;
}
