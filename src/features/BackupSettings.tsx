import { useState } from "react";
import { createLedger, type BudgetLedger } from "@/domain/budget";
import {
  exportBackup,
  importBackup,
  MAX_BACKUP_BYTES,
  STORAGE_KEY,
} from "@/storage/repository";
import { Button } from "@/components/ui/button";
import { Card, Field } from "./ui";
import { useWorkspace } from "./workspace";

function download(content: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BackupSettings() {
  const { ledger, demo, revision, replace, blocked, reload } = useWorkspace();
  const [pending, setPending] = useState<{
    ledger: BudgetLedger;
    revision: string | null;
    filename: string;
  } | null>(null);
  const [clear, setClear] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function attempt(action: () => void) {
    setError("");
    setNotice("");
    try {
      action();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function readFile(file?: File) {
    setPending(null);
    setClear(false);
    setConfirmation("");
    setError("");
    setNotice("");
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError("文件超过 8MB 限制");
      return;
    }
    try {
      const restored = importBackup(await file.text());
      setPending({ ledger: restored, revision, filename: file.name });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="space-y-6">
      <Card title="数据只留在你的浏览器">
        <p className="text-sm leading-8 text-muted-foreground">
          不上传、不登录、不跨设备同步。清除浏览器站点数据、隐私窗口关闭或设备故障可能导致永久丢失。请定期导出
          JSON
          备份，文件包含完整财务信息，请自行妥善保管。此应用不包含离线资源缓存，首次访问和重新加载仍取决于静态资源是否可用。
        </p>
        <p className="mt-4 text-sm">
          {ledger.periods.length} 个周期 · {ledger.pools.length} 个资金池 ·{" "}
          {ledger.statements.length} 张账单 · {ledger.entries.length} 条流水
        </p>
      </Card>
      <Card title="备份与恢复">
        <div className="space-y-5">
          <Button
            disabled={demo}
            onClick={() =>
              attempt(() => {
                download(
                  exportBackup(ledger),
                  `下月再说-备份-${new Date().toISOString().slice(0, 10)}.json`,
                );
                setNotice("备份下载已发起，请确认文件已保存。");
              })
            }
          >
            导出 JSON 备份
          </Button>
          <Field
            label="选择备份文件"
            hint="仅本地读取，校验格式、版本、完整性及账务一致性。选择文件不会立即覆盖。"
          >
            <input
              type="file"
              accept=".json,application/json"
              disabled={demo || blocked}
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </Field>
          {demo && (
            <p className="text-sm text-muted-foreground">
              退出演示后才能备份、恢复和清空正式账本。
            </p>
          )}
          {pending && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <h3 className="font-semibold">恢复预览</h3>
              <p className="break-all text-sm">{pending.filename}</p>
              <p className="text-sm">
                将恢复 {pending.ledger.periods.length} 个周期、
                {pending.ledger.pools.length} 个资金池、
                {pending.ledger.statements.length} 张账单、
                {pending.ledger.entries.length} 条流水和{" "}
                {pending.ledger.audit.length} 条审计。
              </p>
              <p className="text-sm">
                这会完整替换当前账本，不做合并。建议先导出当前备份。
              </p>
              <Field label="输入“覆盖账本”确认">
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={confirmation !== "覆盖账本" || blocked}
                  onClick={() =>
                    attempt(() => {
                      if (pending.revision !== revision)
                        throw new Error("预览后账本已变化，请重新选择备份文件");
                      replace(pending.ledger);
                      setPending(null);
                      setConfirmation("");
                      setNotice("恢复成功，已保存到当前浏览器。");
                    })
                  }
                >
                  确认覆盖恢复
                </Button>
                <Button variant="outline" onClick={() => setPending(null)}>
                  取消恢复
                </Button>
              </div>
            </div>
          )}
          <div className="border-t border-border pt-5">
            <Button
              variant="outline"
              onClick={() =>
                attempt(() => {
                  const raw = localStorage.getItem(STORAGE_KEY);
                  if (!raw) throw new Error("当前没有本地原始文件");
                  download(raw, "下月再说-原始数据.json");
                  setNotice(
                    "原始数据下载已发起；原文件可能损坏，请保留用于排查。",
                  );
                })
              }
            >
              下载本地原始数据
            </Button>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              读取异常时也可保留原文件，不修改浏览器现有数据。
            </p>
          </div>
          <Button variant="outline" onClick={reload}>
            从浏览器重新载入
          </Button>
        </div>
      </Card>
      <Card title="清空本地账本">
        <p className="mb-4 text-sm leading-7 text-muted-foreground">
          清空后无法在应用内撤销，只能从你的备份恢复。演示数据不受影响。
        </p>
        <Button
          variant="outline"
          disabled={demo || blocked}
          onClick={() => {
            setClear(true);
            setPending(null);
            setConfirmation("");
          }}
        >
          准备清空账本
        </Button>
        {clear && (
          <div className="mt-5 space-y-4">
            <Field label="输入“清空账本”确认">
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <div className="flex gap-3">
              <Button
                disabled={confirmation !== "清空账本" || blocked}
                onClick={() =>
                  attempt(() => {
                    replace(createLedger());
                    setClear(false);
                    setConfirmation("");
                    setNotice("本地账本已清空。");
                  })
                }
              >
                确认清空
              </Button>
              <Button variant="outline" onClick={() => setClear(false)}>
                取消清空
              </Button>
            </div>
          </div>
        )}
      </Card>
      {error && (
        <p
          role="alert"
          className="error-text rounded-xl border border-border p-4"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-accent p-4">
          {notice}
        </p>
      )}
    </div>
  );
}
