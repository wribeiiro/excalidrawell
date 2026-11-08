import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/kalam/400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startPersistence } from './io/persistence';
import { FONT_STACKS } from './render/text';
import { setImageLoadListener } from './render/images';
import { useStore } from './store/store';
import './styles.css';

const redraw = () => useStore.setState((s) => ({ renderNonce: s.renderNonce + 1 }));
setImageLoadListener(redraw);

// O canvas não dispara carregamento de fonte por conta própria.
void Promise.all(
  Object.values(FONT_STACKS).map((stack) => document.fonts.load(`20px ${stack}`)),
).then(redraw);

void startPersistence();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
