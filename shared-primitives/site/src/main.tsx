import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// The lettering's faces (v5 defaults), bundled so recreations render offline.
import '@fontsource/open-sans/800.css';
import '@fontsource/roboto-condensed/700.css';
import '@fontsource/roboto-slab/700.css';
import '@fontsource/roboto/400.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
