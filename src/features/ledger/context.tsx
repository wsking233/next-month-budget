import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createLedgerStore } from './store';
const Context = createContext<ReturnType<typeof createLedgerStore> | null>(null);
export function LedgerProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createLedgerStore);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useLedger() {
  const store = useContext(Context);
  if (!store) throw new Error('LedgerProvider missing');
  const state = useStore(store);
  return { ...state[state.mode], mode: state.mode, execute: state.execute, selectPeriod: state.selectPeriod, enterDemo: state.enterDemo, exitDemo: state.exitDemo, reset: state.reset };
}
