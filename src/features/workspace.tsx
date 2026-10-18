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
  const [ledger, setLedger] = useState(createLedger);
  function toggleDemo() {
    setDemo(!demo);
    setLedger(demo ? createLedger() : demoLedger());
    setMessage("");
  }
  function commit() {
    setMessage("交互原型：已完成表单核对，尚未真实入账。");
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
