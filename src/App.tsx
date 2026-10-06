import { useEffect, useLayoutEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
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

/** Short alias: /project/pdrn-firming-ampoule → /projects/pdrn-firming-ampoule/overview */
function ProjectAlias() {
  const { id, step } = useParams();
  return <Navigate to={`/projects/${id}/${step ?? 'overview'}`} replace />;
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
          <Route path="project/:id" element={<ProjectAlias />} />
          <Route path="project/:id/:step" element={<ProjectAlias />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
