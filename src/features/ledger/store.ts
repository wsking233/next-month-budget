import { createStore } from 'zustand/vanilla';
import type { BudgetLedger } from '@/domain/budget';
import { createDemoLedger } from '@/fixtures/demo-ledger';
import { LocalStorageRepository, emptyWorkspace, type LedgerRepository } from '@/storage/repository';
import { parseSnapshot, type Workspace } from '@/storage/snapshot';
export type { Workspace } from '@/storage/snapshot';
type Persistence = { kind: 'ready' | 'error' | 'blocked'; message: string; savedAt: string | null; readable: boolean };
type LedgerStore = {
  memory: Workspace;
  demo: Workspace;
  mode: 'memory' | 'demo';
  persistence: Persistence;
  execute: (operation: (ledger: BudgetLedger) => BudgetLedger, selectPeriod?: string) => string | null;
  selectPeriod: (id: string) => void;
  enterDemo: () => void;
  exitDemo: () => void;
  reset: () => string | null;
  restore: (raw: string) => string | null;
  reload: () => string | null;
  externalChange: () => void;
  readStoredRaw: () => string | null;
};
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '操作失败，原账本未改变。';
export function createLedgerStore(repository: LedgerRepository = new LocalStorageRepository()) {
  let initial = emptyWorkspace();
  let persistence: Persistence = { kind: 'ready', message: '', savedAt: null, readable: true };
  try {
    const loaded = repository.load();
    initial = loaded.workspace;
    persistence.savedAt = loaded.savedAt;
  } catch (error) { persistence = { kind: 'blocked', message: errorMessage(error), savedAt: null, readable: false }; }
  return createStore<LedgerStore>()((set, get) => {
    function commit(workspace: Workspace): string | null {
      try {
        const savedAt = repository.save(workspace);
        set({ memory: workspace, persistence: { kind: 'ready', message: '', savedAt, readable: true } });
        return null;
      } catch (error) {
        const message = errorMessage(error);
        set({ persistence: { ...get().persistence, kind: get().persistence.kind === 'blocked' ? 'blocked' : 'error', message } });
        return message;
      }
    }
    return {
      memory: initial, demo: emptyWorkspace(), mode: 'memory', persistence,
      execute: (operation, selectPeriod) => {
        const state = get(), workspace = state[state.mode];
        if (state.mode === 'memory' && state.persistence.kind === 'blocked') return '本地账本尚未安全读取。请在设置中重新读取或从有效备份恢复；原数据不会被自动覆盖。';
        try {
          const next = { ledger: operation(workspace.ledger), currentPeriod: selectPeriod ?? workspace.currentPeriod };
          if (state.mode === 'memory') return commit(next);
          set({ demo: next });
          return null;
        } catch (error) { return errorMessage(error); }
      },
      selectPeriod: id => {
        const state = get(), workspace = state[state.mode];
        if (!workspace.ledger.periods.some(p => p.id === id)) return;
        const next = { ...workspace, currentPeriod: id };
        if (state.mode === 'demo') set({ demo: next });
        else if (state.persistence.kind !== 'blocked') commit(next);
      },
      enterDemo: () => set({ demo: { ledger: createDemoLedger(), currentPeriod: 'oct' }, mode: 'demo' }),
      exitDemo: () => set({ mode: 'memory' }),
      reset: () => {
        if (get().mode === 'demo') { set({ demo: emptyWorkspace() }); return null; }
        // Called only after explicit clear confirmation, including damaged local data.
        return commit(emptyWorkspace());
      },
      restore: raw => {
        if (get().mode === 'demo') return '请先返回本地账本，再恢复备份。';
        try { return commit(parseSnapshot(raw).workspace); }
        catch (error) { return errorMessage(error); }
      },
      reload: () => {
        try {
          const loaded = repository.load();
          set({ memory: loaded.workspace, persistence: { kind: 'ready', message: '', savedAt: loaded.savedAt, readable: true } });
          return null;
        } catch (error) {
          const message = errorMessage(error);
          set({ persistence: { ...get().persistence, kind: 'blocked', message } });
          return message;
        }
      },
      externalChange: () => set({ persistence: { ...get().persistence, kind: 'blocked', message: '其他页面已更新本地账本，请重新读取后再编辑。当前视图暂时保留。' } }),
      readStoredRaw: () => repository.readRaw(),
    };
  });
}
