import { useEffect, useId, useRef, type ReactNode, type ComponentProps, type ReactElement, cloneElement } from 'react';
import { X, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2>{action}</div>{children}</section>;
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center"><p className="font-medium">{title}</p><div className="mt-2 text-sm leading-7 text-muted-foreground">{children}</div></div>;
}
export function Jump({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary" to={to}>{children}<ArrowUpRight className="size-4" aria-hidden="true" /></Link>;
}
export function Field({ label, children, hint }: { label: string; children: ReactElement<{ id?: string; 'aria-describedby'?: string }>; hint?: string }) {
  const id = useId();
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={id}>{label}</label>{cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined })}{hint && <span id={`${id}-hint`} className="text-xs font-normal text-muted-foreground">{hint}</span>}</div>;
}
export function Input(props: ComponentProps<'input'>) { return <input {...props} className="form-control" />; }
export function Select(props: ComponentProps<'select'>) { return <select {...props} className="form-control" />; }
export function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); if (trigger?.isConnected) trigger.focus(); else document.getElementById('main-content')?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={close} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} className="demo-dialog"><div className="flex items-center justify-between gap-4 border-b border-border p-5"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><Button variant="ghost" size="icon" aria-label="关闭弹窗" onClick={close}><X aria-hidden="true" /></Button></div><div className="p-5 sm:p-6"><p className="mb-5 rounded-lg bg-muted p-3 text-xs leading-6 text-muted-foreground">本地账本在保存成功后才应用操作；独立演示账本不会写入本地。</p>{children}</div></dialog>;
}
