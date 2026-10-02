'use client';
import { useEffect, useState, type ReactNode } from 'react';

export function PanelTransition({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const [retained, setRetained] = useState(open);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (open) setRetained(true);
  }
  useEffect(() => {
    if (open) return;
    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const timer = setTimeout(() => setRetained(false), reduced ? 0 : 180);
    return () => clearTimeout(timer);
  }, [open]);
  if (!open && !retained) return null;
  return (
    <div
      className="panel-transition"
      data-exiting={!open || undefined}
      inert={!open}
      aria-hidden={!open || undefined}
    >
      {children}
    </div>
  );
}
