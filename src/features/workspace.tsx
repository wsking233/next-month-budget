/* eslint-disable react-refresh/only-export-components -- shared provider hook */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import { LocalStorageRepository, STORAGE_KEY } from "@/storage/repository";
import { createWorkspaceStore } from "@/storage/store";
const Context = createContext<ReturnType<typeof createWorkspaceStore> | null>(
  null,
);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createWorkspaceStore(
      new LocalStorageRepository({
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, val) => localStorage.setItem(key, val),
      }),
      Boolean(navigator.locks),
    ),
  );
  useEffect(() => {
    const controller = new AbortController();
    let release: (() => void) | undefined;
    if (navigator.locks) {
      void navigator.locks
        .request(
          "next-month-budget:writer",
          { signal: controller.signal },
          async () => {
            store.getState().reload();
            store.setState({ writerReady: true });
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            store.setState({ writerReady: false });
          },
        )
        .catch(() => {
          /* abort on unmount; pending reader never writes */
        });
    }
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY || event.key === null)
        store.getState().markConflict();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      controller.abort();
      release?.();
    };
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const store = useContext(Context);
  if (!store) throw new Error("账本未初始化");
  const state = useStore(store);
  return { ...state, ledger: state.demo ? state.demoData : state.ledger };
}
