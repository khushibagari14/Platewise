'use client';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { totalMeal, type MealItem } from '@/lib/nutrition';

export function ProteinBreakdown({ items }: { items: MealItem[] }) {
  const [open, setOpen] = useState(false);
  const total = totalMeal(items).protein;
  const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return <>
    <button type="button" className="protein-block protein-breakdown-trigger" onClick={() => setOpen(true)} aria-label="View protein breakdown" aria-haspopup="dialog">
      <small>Protein</small>
      <strong>{Math.round(total)}<span>g</span></strong>
      <span className="protein-breakdown-hint">View breakdown <ChevronRight size={14} /></span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="protein-breakdown-dialog">
        <DialogTitle>Where your protein comes from</DialogTitle>
        <DialogDescription>Estimated for your current portions. Changes to amounts update these values.</DialogDescription>
        <div className="protein-breakdown-total"><span>Meal protein</span><span>{format(total)} g</span></div>
        <ul className="protein-breakdown-list">
          {items.map(item => {
            const amount = item.protein * item.quantity;
            return <li key={item.id}>
              <div><span>{item.name}</span><span>{format(amount)} g</span></div>
              <div className="protein-contribution" aria-hidden="true"><span style={{ width: `${total > 0 ? amount / total * 100 : 0}%` }} /></div>
            </li>;
          })}
        </ul>
        <button type="button" className="protein-breakdown-done" onClick={() => setOpen(false)}>Done</button>
      </DialogContent>
    </Dialog>
  </>;
}
