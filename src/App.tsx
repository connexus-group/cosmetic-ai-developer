import { useEffect, useLayoutEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { lazyWithRetry as lazy, prefetchRoutes } from './lib/lazy';

const Home = lazy(() => import('./pages/Home'));
const Projects = lazy(() => import('./pages/Projects'));
const NotFound = lazy(() => import('./pages/NotFound'));
const ProjectLayout = lazy(() => import('./pages/project/ProjectLayout'));
const StepPage = lazy(() => import('./pages/project/StepPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  useEffect(() => prefetchRoutes(), []);
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectLayout />} />
          <Route path="projects/:id/:step" element={<ProjectLayout />}>
            <Route index element={<StepPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
