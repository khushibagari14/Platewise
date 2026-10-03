import { Leaf } from 'lucide-react';

export function AppLoading() {
  return (
    <main className="app-loading" aria-label="Loading Platewise">
      <output className="app-loading-content" aria-live="polite">
        <span className="app-loading-mark" aria-hidden="true">
          <span />
          <Leaf size={25} strokeWidth={1.5} />
        </span>
        <span className="app-loading-brand">platewise</span>
        <span className="app-loading-caption">Getting things ready…</span>
      </output>
    </main>
  );
}
