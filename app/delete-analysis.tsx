'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
export function DeleteAnalysis({ onDelete }: { onDelete: () => void }) {
 const [open, setOpen] = useState(false);
 return <>
  <button type="button" className="delete-analysis-trigger" onClick={() => setOpen(true)}><Trash2 size={15} /> Delete this analysis</button>
  <Dialog open={open} onOpenChange={setOpen}>
   <DialogContent className="delete-analysis-dialog">
    <DialogTitle>Delete this analysis?</DialogTitle>
    <DialogDescription>Are you sure? This meal will be removed from your history and today’s totals.</DialogDescription>
    <div className="delete-analysis-actions">
     <button type="button" onClick={() => setOpen(false)}>Cancel</button>
     <button type="button" onClick={() => { setOpen(false); onDelete(); }}>Yes, delete</button>
    </div>
   </DialogContent>
  </Dialog>
 </>;
}
