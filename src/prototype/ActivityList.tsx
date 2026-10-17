import { money, type Activity } from './model';

export function ActivityList({ activities }: { activities: Activity[] }) {
  return <>
    <div className="grid gap-3 md:hidden">{activities.map(a => <article key={a.id} className="grid min-w-0 gap-2 rounded-xl border border-border p-4"><span className="text-sm font-semibold">{a.kind}</span><p className="break-words text-sm">{a.detail}</p><p className="text-xs text-muted-foreground">{a.date} · 演示记录</p>{a.amount !== undefined && <p className="money text-sm font-medium">{money(a.amount)}</p>}</article>)}</div>
    <table className="hidden w-full table-fixed text-left text-sm md:table"><caption className="sr-only">当前会话的演示操作记录</caption><thead className="border-b border-border text-muted-foreground"><tr><th scope="col" className="w-1/6 py-3 font-medium">类型</th><th scope="col" className="w-1/2 py-3 font-medium">说明</th><th scope="col" className="w-1/6 py-3 font-medium">日期</th><th scope="col" className="w-1/6 py-3 text-right font-medium">金额</th></tr></thead><tbody>{activities.map(a => <tr key={a.id} className="border-b border-border last:border-0"><td className="py-4 pr-3 align-top">{a.kind}</td><td className="break-words py-4 pr-4 align-top">{a.detail}</td><td className="py-4 pr-2 align-top text-xs leading-6 text-muted-foreground">{a.date}</td><td className="money break-words py-4 text-right align-top">{a.amount === undefined ? '—' : money(a.amount)}</td></tr>)}</tbody></table>
  </>;
}
