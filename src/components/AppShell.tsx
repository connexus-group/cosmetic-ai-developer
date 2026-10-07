import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { FlaskConical, FolderKanban, Plus } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { AnalyzingState } from './ui';

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-ink-100/80 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink-900 text-champagne-300">
              <FlaskConical size={16} />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-ink-900">Cosmetic AI Developer</span>
              <span className="hidden text-[10px] tracking-wider text-slate-500 sm:block">AI PRODUCT DEVELOPER</span>
            </span>
          </Link>
          <span className="ml-1 hidden rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-800 ring-1 ring-amber-200 sm:inline">DEMO MODE</span>
          <nav className="ml-auto flex items-center gap-1">
            <NavLink to="/projects" className={({ isActive }) => clsx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm', isActive ? 'bg-ink-100 text-ink-900' : 'text-slate-600 hover:bg-ink-50')}>
              <FolderKanban size={15} /> <span className="hidden sm:inline">내 프로젝트</span>
            </NavLink>
            {pathname !== '/' && (
              <Link to="/" className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-sm text-white hover:bg-ink-800">
                <Plus size={15} /> <span className="hidden sm:inline">새 제품 개발</span>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <ErrorBoundary resetKey={pathname}>
      <Suspense
        key={pathname.split('/').slice(0, 3).join('/')}
        fallback={
          <div className="mx-auto max-w-6xl px-4 py-10">
            <AnalyzingState label="화면을 불러오는 중" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
      </ErrorBoundary>
    </div>
  );
}
