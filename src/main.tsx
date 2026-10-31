import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';
import { Gallery } from './ui/gallery/Gallery';
import { App } from './ui/app/App';
import { initTheme } from './ui/theme';

// the stored light or dark theme (index.html applies it before first paint; this covers a page without that script)
initTheme();

/** Entry point. `?gallery` shows the design-system gallery (every primitive in every state); otherwise the app. */
const showGallery = location.search.includes('gallery');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showGallery ? <Gallery /> : <App />}
  </StrictMode>,
);
