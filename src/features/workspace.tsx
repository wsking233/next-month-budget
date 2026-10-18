/* eslint-disable react-refresh/only-export-components -- shared provider hook */
import { createContext, useContext, useState, type ReactNode } from "react";
import { createLedger, type BudgetLedger } from "@/domain/budget";
import { demoLedger } from "@/demo/ledger";

type Workspace = {
  ledger: BudgetLedger;
  demo: boolean;
  message: string;
  commit: (action: (ledger: BudgetLedger) => BudgetLedger) => void;
  toggleDemo: () => void;
};
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(false);
  const [message, setMessage] = useState("");
  const [realLedger, setRealLedger] = useState(createLedger);
  const [demoData, setDemoData] = useState(demoLedger);
  const ledger = demo ? demoData : realLedger;
  const setLedger = demo ? setDemoData : setRealLedger;
  function toggleDemo() {
    setDemo(!demo);

    setMessage("");
  }
  function commit(action: (ledger: BudgetLedger) => BudgetLedger) {
    const next = action(ledger);
    setLedger(next);
    setMessage(
      demo
        ? "演示操作已完成，不影响正式账本。"
        : "操作已确认。当前仅内存账本，刷新即丢失。",
    );
  }
  return (
    <Context.Provider value={{ ledger, demo, message, commit, toggleDemo }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("账本未初始化");
  return context;
}
