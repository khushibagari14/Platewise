'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

export function HistoryMealRow({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const removeRef = useRef(onRemove);
  useEffect(() => {
    removeRef.current = onRemove;
  }, [onRemove]);
  useEffect(() => {
    if (!removing) return;
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      removeRef.current();
    };
    const timer = window.setTimeout(finish, reducedMotion ? 0 : 280);
    return () => {
      window.clearTimeout(timer);
      // A confirmed removal still completes if the history closes mid-transition.
      finish();
    };
  }, [removing]);

  return (
    <>
      <div
        className="history-removal-wrapper"
        data-removing={removing || undefined}
        inert={removing}
      >
        <div className="history-removal-inner">
          <div className="saved-meal-row">
            {children}
            <button
              type="button"
              className="saved-meal-delete"
              onClick={() => setConfirming(true)}
              disabled={removing}
              aria-label={`Remove ${title} from history`}
            >
              <Trash2 size={17} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      </div>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="delete-analysis-dialog history-remove-dialog">
          <DialogTitle>Remove this meal?</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this from the history? “{title}”
            will also be removed from your daily totals.
          </DialogDescription>
          <div className="delete-analysis-actions">
            <button type="button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setRemoving(true);
              }}
            >
              Yes, remove
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
