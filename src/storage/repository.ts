import { createLedger, type BudgetLedger } from "@/domain/budget";
import { validateLedger } from "./schema";

export const STORAGE_KEY = "next-month-budget:ledger:v1";
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
export interface LedgerRepository {
  load(): { ledger: BudgetLedger; revision: string | null };
  save(ledger: BudgetLedger, expectedRevision: string | null): string;
}
// FNV-1a 校验用于发现意外损坏，不是签名或防恶意篡改机制。
function checksum(content: string) {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++)
    hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
export function exportBackup(
  ledger: BudgetLedger,
  exportedAt = new Date().toISOString(),
) {
  const normalized = validateLedger(ledger);
  const payload = {
    format: "next-month-budget",
    schemaVersion: 1,
    exportedAt,
    ledger: normalized,
  };
  return JSON.stringify(
    { ...payload, checksum: checksum(JSON.stringify(payload)) },
    null,
    2,
  );
}
export function importBackup(raw: string): BudgetLedger {
  if (new Blob([raw]).size > MAX_BACKUP_BYTES)
    throw new Error("文件超过 8MB 限制");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("无法解析 JSON，请选择完整备份文件");
  }
  if (!data || typeof data !== "object") throw new Error("备份格式无效");
  const o = data as Record<string, unknown>;
  if (o.format !== "next-month-budget" || o.schemaVersion !== 1)
    throw new Error("不支持的备份版本或文件类型");
  if (
    Object.keys(o).sort().join(",") !==
    "checksum,exportedAt,format,ledger,schemaVersion"
  )
    throw new Error("备份字段不完整");
  if (
    typeof o.exportedAt !== "string" ||
    Number.isNaN(Date.parse(o.exportedAt))
  )
    throw new Error("备份时间无效");
  const payload = {
    format: o.format,
    schemaVersion: o.schemaVersion,
    exportedAt: o.exportedAt,
    ledger: o.ledger,
  };
  if (o.checksum !== checksum(JSON.stringify(payload)))
    throw new Error("备份校验码不一致，文件可能已损坏");
  return validateLedger(o.ledger);
}
export class LocalStorageRepository implements LedgerRepository {
  constructor(private storage: Pick<Storage, "getItem" | "setItem">) {}
  load() {
    const raw = this.storage.getItem(STORAGE_KEY);
    return {
      ledger: raw === null ? createLedger() : importBackup(raw),
      revision: raw,
    };
  }
  save(ledger: BudgetLedger, expectedRevision: string | null) {
    const current = this.storage.getItem(STORAGE_KEY);
    if (current !== expectedRevision)
      throw new Error(
        "其他标签页已修改账本。请先导出当前备份，再重新载入；本次操作未保存。",
      );
    const next = exportBackup(ledger);
    if (new Blob([next]).size > MAX_BACKUP_BYTES)
      throw new Error("账本超过 8MB，请先导出备份");
    try {
      this.storage.setItem(STORAGE_KEY, next);
    } catch {
      throw new Error(
        "浏览器保存失败（配额不足或存储被禁用），本次操作未入账；原账本保留，请先导出备份。",
      );
    }
    return next;
  }
}
