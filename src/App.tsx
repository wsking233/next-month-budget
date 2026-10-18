import { Link, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { BudgetPage } from "@/features/BudgetPage";
import { WorkspaceProvider } from "@/features/workspace";
import { pages } from "@/pages/config";

export function App() {
  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<AppLayout />}>
          {pages.map((page) => (
            <Route
              key={page.path}
              path={page.path}
              element={<BudgetPage path={page.path} />}
            />
          ))}
          <Route
            path="*"
            element={
              <div className="py-16 text-center">
                <p className="text-sm text-muted-foreground">404</p>
                <h1 className="mt-3 text-3xl font-semibold">这页暂时找不到</h1>
                <p className="my-6 text-sm text-muted-foreground">
                  回到概览，继续安排你的预算。
                </p>
                <Button asChild>
                  <Link to="/">返回概览</Link>
                </Button>
              </div>
            }
          />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}
