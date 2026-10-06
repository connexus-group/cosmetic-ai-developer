import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ProjectStoreProvider } from './state/ProjectStore';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProjectStoreProvider>
        <App />
      </ProjectStoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
