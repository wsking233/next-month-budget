import type { AuditEvent } from '@/domain/budget';
import { auditLabels } from './labels';
export function AuditList({ events }: { events: AuditEvent[] }) {
  const time = (event: AuditEvent) => new Date(event.createdAt).toLocaleString('zh-CN', { hour12: false });
  return <>
    <div className="grid gap-3 md:hidden">{events.map(event => <article key={event.id} className="min-w-0 rounded-xl border border-border p-4"><h3 className="text-sm font-semibold">{auditLabels[event.kind]}</h3><p className="mt-2 break-words text-sm leading-7">{event.description}</p>{event.reason && <p className="mt-2 break-words text-sm text-muted-foreground">原因：{event.reason}</p>}<p className="mt-2 text-xs text-muted-foreground">{time(event)}</p></article>)}</div>
    <table className="hidden w-full table-fixed text-left text-sm md:table"><caption className="sr-only">当前账本审计记录</caption><thead className="border-b border-border text-muted-foreground"><tr><th scope="col" className="w-1/6 py-3 font-medium">操作</th><th scope="col" className="w-3/5 py-3 font-medium">内容与原因</th><th scope="col" className="py-3 font-medium">操作时间</th></tr></thead><tbody>{events.map(event => <tr key={event.id} className="border-b border-border last:border-0"><td className="py-4 pr-3 align-top">{auditLabels[event.kind]}</td><td className="break-words py-4 pr-4 align-top leading-7">{event.description}{event.reason && <p className="mt-2 text-muted-foreground">原因：{event.reason}</p>}</td><td className="py-4 align-top text-xs leading-6 text-muted-foreground">{time(event)}</td></tr>)}</tbody></table>
  </>;
}
