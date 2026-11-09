import { lazy, Suspense } from 'react';
import { StoreProvider, useStore } from './lib/store';
import type { Design } from './lib/types';

/**
 * Arbor comes in several design styles that share one store (conversation, classifier,
 * scripted assistant). Each design is its own UI under src/designs/ and loads lazily,
 * so only its own CSS is on the page. Switch with ?design=ascii|classic or in settings;
 * the conversation carries over, which makes side-by-side comparisons in user tests easy.
 */
const DESIGNS: Record<Design, React.LazyExoticComponent<() => React.JSX.Element>> = {
  ascii: lazy(() => import('./designs/ascii/App')),
  classic: lazy(() => import('./designs/classic/App')),
};

function DesignSwitch() {
  const { state } = useStore();
  const Design = DESIGNS[state.settings.design] ?? DESIGNS.ascii;
  return (
    <Suspense fallback={null}>
      <Design />
    </Suspense>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <DesignSwitch />
    </StoreProvider>
  );
}
