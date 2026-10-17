import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { pages } from '@/pages/config';
import { useDemo } from './store';
import { ActivityList } from './ActivityList';
import { emptyDemo, sampleDemo, money, poolBalance, type Statement } from './model';
import { DemoForm, AllocationForm, type FormKind } from './forms';
import { Panel, Empty, Jump, Field, Input, Select, Modal } from './ui';

export function PrototypePage({ page }: { page: (typeof pages)[number] }) {
  const { state, setState } = useDemo();
  const [form, setForm] = useState<FormKind | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [reset, setReset] = useState<'sample' | 'empty' | null>(null);
  const [filter, setFilter] = useState('全部');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(false);
  const [cycleDay, setCycleDay] = useState('10');
  const current = state.periods.find(p => p.id === state.currentPeriod);
  const pending = state.statements.filter(s => !s.settled);
  const filteredActivities = state.activities.filter(a => (filter === '全部' || a.kind === filter) && a.detail.includes(query.trim()));
  const total = state.pools.reduce((sum, p) => sum + poolBalance(state, p.id), 0);
  const showReset = (kind: 'sample' | 'empty') => {
    if (!state.pools.length && !state.periods.length && !state.statements.length && !state.activities.length) setState(kind === 'sample' ? sampleDemo() : emptyDemo());
    else setReset(kind);
  };
  const action = (kind: FormKind, title: string) => <Button onClick={() => setForm(kind)}><Plus aria-hidden="true" />{title}</Button>;
  function poolCards() {
    return state.pools.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{state.pools.map(p => {
      const balance = poolBalance(state, p.id);
      return <article key={p.id} className="rounded-xl border border-border p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{p.name}</h3><span className="text-xs text-muted-foreground">演示</span></div><p className={`money mt-5 text-2xl font-semibold ${balance < 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{money(balance)}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{balance < 0 ? '预算为负 · 需后续拨款抵扣' : '演示累计预算余额 · 非现金资产'}</p><div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">样例期初结转 {money(p.opening)}</div></article>;
    })}</div> : <Empty title="给生活留一个预算空间">先创建资金池，再单独安排拨款。<div className="mt-4">{action('pool', '创建资金池')}</div></Empty>;
  }
  function statementCards(list: Statement[]) {
    return list.length ? <div className="grid gap-3">{list.map(s => <article key={s.id} className="grid min-w-0 gap-4 rounded-xl border border-border p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{s.account}</h3><span className="rounded-full bg-muted px-2 py-1 text-xs">{s.settled ? '演示已结算' : '待分配'}</span></div><p className="mt-2 break-all text-xs text-muted-foreground">{s.reference}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">账单日 {s.date} · 还款日 {s.due}<br />还款未记录 · 结算不代表还款</p>{s.settled && <ul className="mt-2 text-xs leading-6 text-muted-foreground">{s.allocations.map((a, i) => <li key={i}>{state.pools.find(p => p.id === a.poolId)?.name} · {state.periods.find(p => p.id === a.periodId)?.name} · {money(a.amount)}</li>)}</ul>}</div><div className="flex flex-wrap items-center justify-between gap-3 sm:flex-col sm:items-end"><p className="money text-xl font-semibold">{money(s.amount)}</p>{!s.settled && <Button variant="outline" onClick={() => setStatement(s)}>拆分核对<ArrowRight aria-hidden="true" /></Button>}</div></article>)}</div> : <Empty title="这里暂时没有账单">{state.statements.length ? '当前筛选下没有账单。' : '登记账单后，按资金池和预算周期分配总额。'}</Empty>;
  }
  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-3 text-xs font-semibold tracking-[0.2em] text-muted-foreground">我的预算空间</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{page.title}</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">{page.subtitle}</p></div>{page.path === '/pools' && action('pool', '创建资金池')}{page.path === '/statements' && action('statement', '登记账单')}{page.path === '/plans' && action('period', '创建预算周期')}</div>
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-accent p-4"><div className="flex items-start gap-3"><FlaskConical className="mt-1 size-5 shrink-0" aria-hidden="true" /><div><p className="text-sm font-semibold">交互演示 · 不是真实账本</p><p className="mt-1 text-xs leading-6">数据仅用于界面演示，不会长期保存，刷新即清空。请勿填写真实财务信息。</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => showReset('sample')}>加载演示数据</Button><Button variant="ghost" onClick={() => showReset('empty')}>清空演示</Button></div></div>
    <div className="grid gap-6">
      {page.path === '/' && <>
        <Panel title="按自己的节奏，安排这一期" action={<Jump to="/plans">管理周期</Jump>}><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-sm text-muted-foreground">当前查看周期</p><p className="mt-2 text-xl font-semibold">{current?.name ?? '还没有预算周期'}</p><p className="mt-2 text-sm text-muted-foreground">{current ? `${current.start} — ${current.end}` : '从创建周期、资金池开始，逐步安排预算。'}</p></div><Field label="切换查看周期"><Select value={state.currentPeriod} onChange={e => setState(s => ({ ...s, currentPeriod: e.target.value }))}><option value="">请选择周期</option>{state.periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field></div></Panel>
        <div className="grid gap-4 sm:grid-cols-3">{[
          ['演示累计预算余额', money(total), '含样例结转和全部演示操作，不等于现金'],
          ['所选周期模拟拨款', money(state.activities.filter(a => a.kind === '拨款' && a.periodId === state.currentPeriod).reduce((sum, a) => sum + (a.amount ?? 0), 0)), '拨款只是预算额度分配'],
          ['待分配账单 · 全部周期', `${pending.length} 笔`, `待分配总额 ${money(pending.reduce((sum, s) => sum + s.amount, 0))}`],
        ].map(([label, value, note]) => <section key={label} className="rounded-2xl border border-border bg-card p-5"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="money mt-4 text-2xl font-semibold">{value}</p><p className="mt-3 text-xs leading-6 text-muted-foreground">{note}</p></section>)}</div>
        <Panel title="资金池一览" action={<Jump to="/pools">管理资金池</Jump>}>{poolCards()}</Panel>
        <Panel title="待处理账单" action={<Jump to="/statements">全部账单</Jump>}>{statementCards(pending)}</Panel>
        <Panel title="从第一期开始"><ol className="grid gap-4 text-sm sm:grid-cols-3">{[['/plans', '01 · 创建预算周期'], ['/pools', '02 · 创建资金池与拨款'], ['/statements', '03 · 登记账单与拆分']].map(([to, label]) => <li key={to}><Jump to={to}>{label}</Jump></li>)}</ol></Panel>
      </>}
      {page.path === '/pools' && <><Panel title="演示累计预算余额" action={action('funding', '模拟拨款')}><p className="mb-5 text-sm leading-7 text-muted-foreground">含全部演示周期的操作。正负预算保留，不自动由其他池弥补；真实跨期计算将在领域接入阶段验收。</p>{poolCards()}</Panel><Panel title="管理操作边界"><p className="text-sm leading-7 text-muted-foreground">本阶段可演示创建与拨款。编辑、停用、显式调拨和历史更正将在领域模型接入时实现，避免产生没有账务依据的操作。</p></Panel></>}
      {page.path === '/statements' && <Panel title="信用卡账单" action={<Field label="账单状态"><Select value={filter} onChange={e => setFilter(e.target.value)}>{['全部', '待分配', '演示已结算'].map(x => <option key={x}>{x}</option>)}</Select></Field>}>{statementCards(state.statements.filter(s => filter === '全部' || (s.settled ? filter === '演示已结算' : filter === '待分配')))}</Panel>}
      {page.path === '/plans' && <><Panel title="预算周期" action={action('funding', '模拟拨款')}>{state.periods.length ? <div className="grid gap-4 sm:grid-cols-2">{state.periods.map(p => <article key={p.id} className="rounded-xl border border-border p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-medium">{p.name}</h3><Button variant={p.id === state.currentPeriod ? 'default' : 'outline'} onClick={() => setState(s => ({ ...s, currentPeriod: p.id }))}>{p.id === state.currentPeriod ? '当前查看' : '查看此周期'}</Button></div><p className="mt-3 text-sm text-muted-foreground">{p.start} — {p.end}</p><p className="money mt-5 text-xl font-semibold">{money(state.activities.filter(a => a.kind === '拨款' && a.periodId === p.id).reduce((sum, a) => sum + (a.amount ?? 0), 0))}</p><p className="mt-2 text-xs text-muted-foreground">此周期已模拟拨款 · 不代表现金转账</p></article>)}</div> : <Empty title="先定义你的预算节奏">周期可按发薪日开始，无需遵循自然月。<div className="mt-4">{action('period', '创建预算周期')}</div></Empty>}</Panel><Panel title="拨款与未来计划"><p className="text-sm leading-7 text-muted-foreground">创建周期不会自动生成拨款。请单独选择周期、资金池和金额进行模拟；未来预测与统计将在后续阶段实现。</p></Panel></>}
      {page.path === '/history' && <Panel title="演示操作记录"><div className="mb-5 grid gap-4 sm:grid-cols-2"><Field label="操作类型"><Select value={filter} onChange={e => setFilter(e.target.value)}>{['全部', '创建', '拨款', '结算'].map(x => <option key={x}>{x}</option>)}</Select></Field><Field label="搜索记录"><Input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="资金池、周期或账单名称" /></Field></div><p className="mb-5 text-xs leading-6 text-muted-foreground">仅展示当前会话的交互预览，非正式审计账本。</p>{filteredActivities.length ? <ActivityList activities={filteredActivities} /> : <Empty title="暂时没有匹配的记录">试试其他筛选，或先创建周期、资金池并模拟操作。</Empty>}</Panel>}
      {page.path === '/settings' && <><Panel title="周期偏好 · 交互预览"><form onSubmit={e => { e.preventDefault(); setSaved(true); }} className="grid max-w-md gap-5"><Field label="每月周期起始日" hint="仅预览偏好表单，不修改已创建周期；日期边界规则待领域阶段实现。"><Input type="number" min="1" max="28" required value={cycleDay} onChange={e => { setCycleDay(e.target.value); setSaved(false); }} /></Field><Button type="submit">预览偏好</Button>{saved && <p role="status" className="text-sm text-primary">已预览：每月 {cycleDay} 日开始（未保存，未修改账务）。</p>}</form></Panel><Panel title="数据与隐私"><div className="grid gap-4 text-sm leading-7"><p>当前是隔离的演示空间。不会读取或写入真实账本，不上传财务信息，也不需要登录。</p><p className="text-muted-foreground">正式本地保存、JSON 备份和恢复将在 Phase 4 实现。清除浏览器数据或更换设备可能导致本地账本丢失；当前演示刷新即清空。</p><div className="flex flex-wrap gap-3"><Button disabled variant="outline">导出备份（尚未实现）</Button><Button disabled variant="outline">导入恢复（尚未实现）</Button></div></div></Panel><Panel title="重新开始"><p className="mb-4 text-sm leading-7 text-muted-foreground">可清空当前演示，检查首次使用的空状态；也可重新加载脱敏样例。</p><Button variant="outline" onClick={() => showReset('empty')}>清空演示</Button></Panel></>}
    </div>
    {form && <DemoForm kind={form} close={() => setForm(null)} />}
    {statement && <AllocationForm statement={statement} close={() => setStatement(null)} />}
    {reset && <Modal title={reset === 'sample' ? '重新加载演示数据？' : '清空当前演示？'} close={() => setReset(null)}><p className="mb-6 text-sm leading-7">当前演示操作会被替换，无法撤销。真实账本不会受到影响。</p><div className="flex flex-wrap justify-end gap-3"><Button variant="outline" onClick={() => setReset(null)}>取消</Button><Button onClick={() => { setState(reset === 'sample' ? sampleDemo() : emptyDemo()); setReset(null); }}>确认替换演示</Button></div></Modal>}
    <p className="mt-6 text-xs leading-6 text-muted-foreground">预算余额不等于银行现金；结算不等于还款。<Link to="/settings" className="underline underline-offset-4">查看演示与数据说明</Link></p>
  </>;
}
