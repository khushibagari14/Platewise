'use client';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
export function DeleteAnalysis({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!deleting) return;
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const timer = window.setTimeout(onDelete, reducedMotion ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [deleting, onDelete]);
  return (
    <>
      <div className="delete-analysis-footer">
        <button
          type="button"
          className="delete-analysis-trigger"
          disabled={deleting}
          aria-busy={deleting}
          onClick={() => setOpen(true)}
        >
          <Trash2 size={16} /> {deleting ? 'Deleting…' : 'Delete this analysis'}
        </button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!deleting) setOpen(value);
        }}
      >
        <DialogContent className="delete-analysis-dialog">
          <DialogTitle>Delete this analysis?</DialogTitle>
          <DialogDescription>
            Are you sure? This meal will be removed from your history and daily
            totals. You’ll return to the homepage.
          </DialogDescription>
          <div className="delete-analysis-actions">
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                setOpen(false);
                setDeleting(true);
              }}
            >
              Yes, delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
