import { createStore } from 'zustand/vanilla';
import { createLedger, type BudgetLedger } from '@/domain/budget';
import { createDemoLedger } from '@/fixtures/demo-ledger';
export type Workspace = { ledger: BudgetLedger; currentPeriod: string };
type LedgerStore = {
  memory: Workspace;
  demo: Workspace;
  mode: 'memory' | 'demo';
  execute: (operation: (ledger: BudgetLedger) => BudgetLedger, selectPeriod?: string) => string | null;
  selectPeriod: (id: string) => void;
  enterDemo: () => void;
  exitDemo: () => void;
  reset: () => void;
};
const emptyWorkspace = (): Workspace => ({ ledger: createLedger(), currentPeriod: '' });
export function createLedgerStore() {
  return createStore<LedgerStore>()((set, get) => ({
    memory: emptyWorkspace(), demo: emptyWorkspace(), mode: 'memory',
    execute: (operation, selectPeriod) => {
      try {
        const state = get(), workspace = state[state.mode];
        const ledger = operation(workspace.ledger);
        // Domain functions return a new ledger only after every check succeeds.
        set({ [state.mode]: { ledger, currentPeriod: selectPeriod ?? workspace.currentPeriod } });
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : '操作失败，账本未改变。';
      }
    },
    selectPeriod: id => {
      const state = get(), workspace = state[state.mode];
      if (!workspace.ledger.periods.some(p => p.id === id)) return;
      set({ [state.mode]: { ...workspace, currentPeriod: id } });
    },
    enterDemo: () => set({ demo: { ledger: createDemoLedger(), currentPeriod: 'oct' }, mode: 'demo' }),
    exitDemo: () => set({ mode: 'memory' }),
    reset: () => { const state = get(); set({ [state.mode]: emptyWorkspace() }); },
  }));
}
