export const money = (cents: number) =>
  new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(
    cents / 100,
  );
export const periodLabel = (p: { startsOn: string; endsOn: string }) =>
  `${p.startsOn} — ${p.endsOn}`;
export const uid = () => crypto.randomUUID();
export function cents(value: string) {
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("金额请输入非负数字，最多两位小数");
  const [whole, decimal = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new Error("金额超出可支持范围");
  return result;
}
export const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
