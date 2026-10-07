import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProjectStoreProvider } from './state/ProjectStore';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/instrument-serif/latin-400.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <ProjectStoreProvider>
          <App />
        </ProjectStoreProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
