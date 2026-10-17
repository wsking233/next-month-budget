import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { emptyDemo, type DemoState } from './model';
const DemoContext = createContext<{ state: DemoState; setState: Dispatch<SetStateAction<DemoState>> } | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(emptyDemo);
  return <DemoContext.Provider value={{ state, setState }}>{children}</DemoContext.Provider>;
}
// Kept with its provider to keep prototype state separate from the production domain.
// eslint-disable-next-line react-refresh/only-export-components
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('DemoProvider missing');
  return value;
}
