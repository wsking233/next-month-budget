import { useEffect, useState } from 'react';
import { Moon, Sun, WalletCards } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { pages } from '@/pages/config';
import { version } from '../../package.json';

export function AppLayout() {
  const location = useLocation();
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('next-month-budget:theme');
      if (saved === 'dark' || saved === 'light') return saved === 'dark';
    } catch { /* Preferences must not block the ledger. */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('next-month-budget:theme', dark ? 'dark' : 'light'); }
    catch { /* Theme remains usable in memory when storage is unavailable. */ }
  }, [dark]);
  useEffect(() => {
    const page = pages.find((item) => item.path === location.pathname);
    document.title = `${page?.title ?? '页面未找到'} · 下月再说`;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }} className="skip-link">跳至主要内容</a>
      <aside className="border-b border-border bg-card lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-5 lg:px-7 lg:py-9">
          <NavLink to="/" className="flex min-w-0 items-center gap-3 rounded-lg" aria-label="下月再说 NEXT MONTH BUDGET 首页">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><WalletCards className="size-5" aria-hidden="true" /></span>
            <span><span className="block text-lg font-semibold tracking-tight">下月再说</span><span className="block text-[10px] tracking-[0.12em] text-muted-foreground">NEXT MONTH BUDGET</span></span>
          </NavLink>
          <div className="lg:hidden"><ThemeToggle dark={dark} onToggle={() => setDark(!dark)} /></div>
        </div>
        <nav aria-label="主导航" className="grid grid-cols-3 gap-1 px-3 pb-4 sm:grid-cols-6 lg:grid-cols-1 lg:gap-2 lg:px-4">
          {pages.map(({ path, title, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => cn('flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-medium transition-colors sm:text-sm lg:justify-start lg:px-4', isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              <Icon className="size-4 shrink-0" aria-hidden="true" /><span>{title}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden p-6 lg:block">
          <div className="rounded-2xl bg-muted p-4"><p className="text-sm font-medium">想花就花，有数就行。</p><p className="mt-2 text-xs leading-6 text-muted-foreground">把预算留给生活，<br />把从容留给自己。</p></div>
        </div>
      </aside>
      <div className="min-w-0 lg:ml-64">
        <header className="flex h-16 items-center justify-between border-b border-border px-5 sm:px-8 lg:px-12">
          <span className="text-xs text-muted-foreground">个人预算 · 你的节奏</span>
          <div className="flex items-center gap-3"><span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">本地优先</span><div className="hidden lg:block"><ThemeToggle dark={dark} onToggle={() => setDark(!dark)} /></div></div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-5 py-8 outline-none sm:px-8 sm:py-12 lg:px-12">
          <Outlet />
          <footer className="mt-10 text-xs leading-6 text-muted-foreground"><span className="block">版本 {version}</span>账本只保存在当前浏览器，不跨设备同步；清理站点数据可能丢失，请定期导出备份。</footer>
        </main>
      </div>
    </div>
  );
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const Icon = dark ? Sun : Moon;
  return <Button variant="ghost" size="icon" onClick={onToggle} aria-label={dark ? '切换浅色主题' : '切换深色主题'}><Icon aria-hidden="true" /></Button>;
}
