import type { pages } from './config';
import { ArrowUpRight } from 'lucide-react';

export function PlaceholderPage({ page }: { page: (typeof pages)[number] }) {
  const Icon = page.icon;
  return (
    <>
      <div className="mb-9">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-muted-foreground">我的预算空间</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{page.title}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">{page.subtitle}</p>
      </div>
      <section aria-labelledby="empty-title" className="empty-panel relative flex min-h-80 flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-card p-6 text-center sm:min-h-96 sm:p-12">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl border border-border bg-background text-primary"><Icon className="size-7" strokeWidth={1.5} aria-hidden="true" /></div>
        <h2 id="empty-title" className="text-lg font-semibold">从容安排，即将开始</h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{page.description}</p>
        <span className="mt-6 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">功能筹备中</span>
      </section>
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border p-5 text-sm leading-6 text-muted-foreground">
        <ArrowUpRight className="mt-1 size-4 shrink-0" aria-hidden="true" />
        <p>想花就花，有数就行。先理清预算，再慢慢实现你的计划。</p>
      </div>
    </>
  );
}
