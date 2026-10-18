import { useWorkspace } from "./workspace";
import { periodLabel } from "./format";
export function PeriodSelect({
  name = "periodId",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string;
}) {
  const { ledger } = useWorkspace();
  return (
    <select name={name} defaultValue={defaultValue} required>
      <option value="">选择预算周期</option>
      {ledger.periods.map((p) => (
        <option key={p.id} value={p.id}>
          {periodLabel(p)}
        </option>
      ))}
    </select>
  );
}
export function PoolSelect({
  name = "poolId",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string;
}) {
  const { ledger } = useWorkspace();
  return (
    <select name={name} defaultValue={defaultValue} required>
      <option value="">选择资金池</option>
      {ledger.pools
        .filter((p) => p.active)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );
}
export function Amount({
  name = "amount",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string;
}) {
  return (
    <input
      name={name}
      defaultValue={defaultValue}
      inputMode="decimal"
      placeholder="0.00"
      required
      maxLength={16}
    />
  );
}
