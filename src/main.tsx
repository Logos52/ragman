import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';
import { Gallery } from './ui/gallery/Gallery';
import { App } from './ui/app/App';

/** Entry point. `?gallery` shows the design-system gallery (every primitive in every state); otherwise the app. */
const showGallery = location.search.includes('gallery');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showGallery ? <Gallery /> : <App />}
  </StrictMode>,
);
