import { useId, useState, type ReactNode, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${className}`}
    >
      {title && <h2 className="mb-5 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small id={id}>{hint}</small>}
    </label>
  );
}
export function Form({
  title,
  children,
  onSubmit,
  submit = "确认",
  disabled = false,
}: {
  title: string;
  children: ReactNode;
  onSubmit: (data: FormData) => void;
  submit?: string;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      onSubmit(new FormData(event.currentTarget));
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试");
    }
  }
  return (
    <Card title={title}>
      <form onSubmit={handle} className="space-y-4">
        {children}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <Button type="submit" disabled={disabled}>
          {submit}
        </Button>
      </form>
    </Card>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-6 text-sm leading-7 text-muted-foreground">
      {children}
    </p>
  );
}
