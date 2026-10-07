import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { FolderKanban, Plus } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { AnalyzingState } from './ui';

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-ink-100/80 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-[24px] leading-none text-ink-900">Cosmetic AI Developer</span>
            <span className="hidden h-1.5 w-1.5 translate-y-[-3px] rounded-full bg-wine-600 sm:inline-block" />
          </Link>
          <span className="ml-2 hidden rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-800 ring-1 ring-amber-200 sm:inline">DEMO MODE</span>
          <nav className="ml-auto flex items-center gap-1">
            <NavLink to="/projects" className={({ isActive }) => clsx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm', isActive ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900')}>
              <FolderKanban size={15} /> <span className="hidden sm:inline">내 프로젝트</span>
            </NavLink>
            {pathname !== '/' && (
              <Link to="/" className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-3.5 py-2 text-sm text-white hover:bg-wine-800">
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
          <div className="mx-auto max-w-6xl px-4 py-16">
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
