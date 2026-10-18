import { createStore } from "zustand/vanilla";
import { createLedger, type BudgetLedger } from "@/domain/budget";
import { demoLedger } from "@/demo/ledger";
import type { LedgerRepository } from "./repository";

export type WorkspaceState = {
  ledger: BudgetLedger;
  demoData: BudgetLedger;
  demo: boolean;
  revision: string | null;
  message: string;
  error: string;
  blocked: boolean;
  writerReady: boolean;
  writerSupported: boolean;
  commit: (action: (ledger: BudgetLedger) => BudgetLedger) => void;
  toggleDemo: () => void;
  replace: (ledger: BudgetLedger) => void;
  reload: () => void;
  markConflict: () => void;
};
export function createWorkspaceStore(
  repository: LedgerRepository,
  requireWriter = false,
) {
  let initial = {
    ledger: createLedger(),
    revision: null as string | null,
    blocked: false,
    error: "",
  };
  try {
    initial = { ...initial, ...repository.load() };
  } catch {
    initial.blocked = true;
    initial.error =
      "本地账本读取失败，已停止写入以保护原数据。请下载原始数据排查，或在恢复浏览器存储后重新载入。";
  }
  return createStore<WorkspaceState>((set, get) => ({
    ...initial,
    writerReady: !requireWriter,
    writerSupported: requireWriter,
    demoData: demoLedger(),
    demo: false,
    message: "",
    commit(action) {
      const state = get();
      if (state.demo) {
        const demoData = action(state.demoData);
        set({ demoData, message: "演示操作已完成，不影响正式账本。" });
        return;
      }
      if (!state.writerReady)
        throw new Error(
          "其他标签页正在编辑。请关闭其他标签页，当前页面会自动获得编辑权限。",
        );
      if (state.blocked)
        throw new Error(state.error || "账本已锁定，请重新载入");
      const next = action(state.ledger);
      try {
        const revision = repository.save(next, state.revision);
        set({
          ledger: next,
          revision,
          error: "",
          message: "操作已保存到当前浏览器。",
        });
      } catch (e) {
        const error = (e as Error).message;
        set({ error, message: "" });
        throw e;
      }
    },
    toggleDemo() {
      set((state) => ({ demo: !state.demo, message: "" }));
    },
    replace(ledger) {
      const state = get();
      if (state.demo) throw new Error("请先退出演示空间");
      if (!state.writerReady)
        throw new Error(
          "其他标签页正在编辑。请关闭其他标签页，当前页面会自动获得编辑权限。",
        );
      if (state.blocked)
        throw new Error(
          "本地数据读取异常或发生冲突，禁止覆盖。请先保留原始数据并重新载入。",
        );
      const revision = repository.save(ledger, state.revision);
      set({ ledger, revision, error: "", message: "账本已替换并保存。" });
    },
    reload() {
      try {
        set({
          ...repository.load(),
          blocked: false,
          error: "",
          message: "已从浏览器重新载入。",
        });
      } catch {
        set({ blocked: true, error: "重新载入失败，原始数据仍受保护。" });
      }
    },
    markConflict() {
      set({
        blocked: true,
        error: "其他标签页修改了数据，已停止写入。先导出当前备份，再重新载入。",
      });
    },
  }));
}
