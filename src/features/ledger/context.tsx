import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createLedgerStore } from './store';
import { STORAGE_KEY } from '@/storage/repository';
const Context = createContext<ReturnType<typeof createLedgerStore> | null>(null);
export function LedgerProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createLedgerStore);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) store.getState().externalChange();
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useLedger() {
  const store = useContext(Context);
  if (!store) throw new Error('LedgerProvider missing');
  const state = useStore(store);
  return { ...state[state.mode], mode: state.mode, execute: state.execute, selectPeriod: state.selectPeriod, enterDemo: state.enterDemo, exitDemo: state.exitDemo, reset: state.reset, persistence: state.persistence, reload: state.reload, restore: state.restore, readStoredRaw: state.readStoredRaw };
}
