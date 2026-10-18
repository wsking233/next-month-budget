import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createLedgerStore } from './store';
import { STORAGE_KEY } from '@/storage/repository';
const Context = createContext<ReturnType<typeof createLedgerStore> | null>(null);
export function LedgerProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createLedgerStore(undefined, Boolean(navigator.locks)));
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let release: (() => void) | undefined;
    if (navigator.locks) {
      void navigator.locks.request('next-month-budget:ledger:writer', { signal: controller.signal }, async () => {
        if (disposed) return;
        // Always read the latest committed snapshot after an earlier editor closes.
        store.getState().reload();
        store.setState({ writer: 'available' });
        await new Promise<void>(resolve => { release = resolve; });
      }).catch(() => { if (!disposed) store.setState({ writer: 'failed' }); });
    }
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) store.getState().externalChange();
    };
    window.addEventListener('storage', changed);
    return () => { disposed = true; controller.abort(); release?.(); if (navigator.locks) store.setState({ writer: 'waiting' }); window.removeEventListener('storage', changed); };
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useLedger() {
  const store = useContext(Context);
  if (!store) throw new Error('LedgerProvider missing');
  const state = useStore(store);
  return { ...state[state.mode], mode: state.mode, writer: state.writer, execute: state.execute, selectPeriod: state.selectPeriod, enterDemo: state.enterDemo, exitDemo: state.exitDemo, reset: state.reset, persistence: state.persistence, reload: state.reload, restore: state.restore, readStoredRaw: state.readStoredRaw };
}
