'use client';
import { AlertCircle, Camera, ChevronRight, History, ImagePlus, Leaf, LoaderCircle, Minus, Plus, RotateCcw, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { MealAnalysis, MealItem, SavedMeal, totalMeal } from '@/lib/nutrition';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const STORAGE_KEY = 'platewise:recent-meals';

declare global { interface Document { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } } }

function readHistory(): SavedMeal[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

async function compressImage(file: File): Promise<{ blob: Blob; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('We could not prepare this photo.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('We could not prepare this photo.')), 'image/jpeg', .82));
  return { blob, preview: canvas.toDataURL('image/jpeg', .68) };
}

export default function Home() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [currentMealId, setCurrentMealId] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedMeal[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ready' | 'loading' | 'result'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    queueMicrotask(() => setHistory(readHistory()));
  }, []);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: 'start_meal_scan', title: 'Start meal scan',
        description: 'Open the photo picker so the person can select a meal to analyze.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async () => { libraryRef.current?.click(); return { status: 'waiting_for_photo' } },
      }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch {}
    return () => lifecycle.abort();
  }, []);

  const totals = useMemo(() => analysis ? totalMeal(analysis.items) : null, [analysis]);

  async function pickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setError('');
    if (!ALLOWED_TYPES.includes(file.type)) return setError('Please choose a JPEG, PNG or WebP photo.');
    if (file.size > MAX_FILE_SIZE) return setError('That photo is too large. Please choose one under 8 MB.');
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed.blob); setPreview(compressed.preview); setAnalysis(null); setStatus('ready');
    } catch { setError('We could not open that photo. Please try another one.') }
  }

  async function analyzeMeal() {
    if (!photo) return;
    if (!navigator.onLine) return setError('You’re offline. Reconnect to analyze this meal.');
    setStatus('loading'); setError('');
    try {
      const form = new FormData(); form.append('image', photo, 'meal.jpg');
      const response = await fetch('/api/analyze-meal', { method: 'POST', body: form });
      const body = await response.json() as MealAnalysis & { error?: string };
      if (!response.ok) throw new Error(body.error || 'We could not analyze this meal.');
      const next: MealAnalysis = body; setAnalysis(next); setStatus('result');
      const saved: SavedMeal = { ...next, id: crypto.randomUUID(), createdAt: new Date().toISOString(), thumbnail: preview };
      setCurrentMealId(saved.id);
      const nextHistory = [saved, ...history].slice(0, 8); setHistory(nextHistory);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory)) } catch {}
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not analyze this meal.'); setStatus('ready');
    }
  }

  function updateItem(id: string, itemPatch: Partial<MealItem>) {
    setAnalysis((current) => {
      if (!current) return current;
      const updated = { ...current, items: current.items.map((item) => item.id === id ? { ...item, ...itemPatch } : item) };
      if (currentMealId) {
        setHistory((savedMeals) => {
          const next = savedMeals.map((meal) => meal.id === currentMealId ? { ...meal, items: updated.items } : meal);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
          return next;
        });
      }
      return updated;
    });
  }
  function removePhoto() { setPhoto(null); setPreview(''); setAnalysis(null); setCurrentMealId(null); setStatus('idle'); setError('') }
  function loadMeal(meal: SavedMeal) { setAnalysis(meal); setCurrentMealId(meal.id); setPreview(meal.thumbnail); setPhoto(null); setStatus('result'); setShowHistory(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function clearHistory() { localStorage.removeItem(STORAGE_KEY); setHistory([]) }

  return (
    <main className="min-h-screen">
      <header className="site-header">
        <button className="brand" onClick={removePhoto} aria-label="Platewise home"><span className="brand-mark"><Leaf size={18} strokeWidth={2.4} /></span><span>platewise</span></button>
        <button className="history-button" type="button" onClick={() => setShowHistory(true)} aria-label="View recent meals"><History size={18} /><span>Recent meals</span>{history.length > 0 && <b>{history.length}</b>}</button>
      </header>
      <div id="top" className="page-shell">
        {status === 'idle' && <section className="intro" aria-labelledby="page-title"><p className="eyebrow"><span /> Your everyday nutrition companion</p><h1 id="page-title">Know what’s on<br />your plate.</h1><p className="intro-copy">Take a photo of your meal. We’ll estimate the calories, protein and nutrients in a few moments.</p></section>}
        <section className={'scanner-card ' + (status !== 'idle' ? 'scanner-active' : '')} aria-labelledby="scanner-title">
          {status === 'idle' && <>
            <div className="scanner-copy"><div><span className="step-label">01 · Add your meal</span><h2 id="scanner-title">Snap it. We’ll do the counting.</h2></div><p>For the clearest estimate, photograph the whole plate in good light.</p></div>
            <button className="photo-drop" type="button" aria-label="Take a meal photo" onClick={() => cameraRef.current?.click()}><Image src="/editorial-meal.png" alt="" fill sizes="(max-width: 920px) 100vw, 880px" priority /><span className="photo-overlay"><span className="camera-circle"><Camera size={25} /></span><strong>Take a photo</strong><small>or choose one from your phone</small></span></button>
            <div className="upload-actions"><button className="primary-action" onClick={() => cameraRef.current?.click()}><Camera size={19} /> Open camera <ChevronRight size={18} /></button><button className="secondary-action" onClick={() => libraryRef.current?.click()}><ImagePlus size={19} /> Choose a photo</button></div>
          </>}
          {(status === 'ready' || status === 'loading') && <div className="review-layout">
            <div className="review-photo"><Image src={preview} alt="Your selected meal" fill sizes="(max-width: 640px) 100vw, 500px" unoptimized />{status !== 'loading' && <button className="remove-photo" onClick={removePhoto} aria-label="Remove photo"><X size={18} /></button>}</div>
            <div className="review-copy"><span className="step-label">02 · Ready to analyze</span><h2 id="scanner-title">{status === 'loading' ? 'Looking at your meal…' : 'Good photo. Let’s read your plate.'}</h2><p>{status === 'loading' ? 'We’re identifying foods and estimating portions. This usually takes a few moments.' : 'Your photo will be sent securely to Gemini for this analysis.'}</p><button className="analyze-button" onClick={analyzeMeal} disabled={status === 'loading'}>{status === 'loading' ? <><LoaderCircle className="spin" size={20} /> Analyzing meal</> : <><Sparkles size={19} /> Analyze my meal <ChevronRight size={18} /></>}</button>{status !== 'loading' && <button className="text-button" onClick={() => libraryRef.current?.click()}><RotateCcw size={15} /> Choose another photo</button>}</div>
          </div>}
          {status === 'result' && analysis && totals && <div className="results">
            <div className="result-top"><div className="result-photo"><Image src={preview} alt="" width={96} height={96} unoptimized /></div><div><span className="step-label">Your meal estimate</span><h2>{analysis.title}</h2><p className={'confidence ' + analysis.confidence}>{analysis.confidence} confidence</p></div><button className="start-over" onClick={removePhoto}><Camera size={17} /> Scan another</button></div>
            <div className="headline-metrics"><div className="calorie-block"><small>Estimated energy</small><strong>{Math.round(totals.calories)}</strong><span>calories</span></div><div className="protein-block"><small>Protein</small><strong>{Math.round(totals.protein)}<span>g</span></strong><div className="protein-line"><i style={{ width: Math.min(100, totals.protein / .5) + '%' }} /></div></div></div>
            <div className="macro-grid"><div><span>Carbs</span><strong>{Math.round(totals.carbs)}g</strong></div><div><span>Fat</span><strong>{Math.round(totals.fat)}g</strong></div><div><span>Fiber</span><strong>{Math.round(totals.fiber)}g</strong></div></div>
            <div className="food-list"><div className="section-heading"><div><span className="step-label">What we found</span><h3>Foods & portions</h3></div><small>Adjust amounts to update totals</small></div>{analysis.items.map((item) => <article className="food-item" key={item.id}><div className="food-main"><input aria-label="Food name" value={item.name} maxLength={80} onChange={(e) => updateItem(item.id, { name: e.target.value })} /><input className="portion-input" aria-label={'Portion for ' + item.name} value={item.portion} maxLength={60} onChange={(e) => updateItem(item.id, { portion: e.target.value })} /></div><div className="food-nutrition"><strong>{Math.round(item.calories * item.quantity)} cal</strong><span>{Math.round(item.protein * item.quantity)}g protein</span></div><div className="quantity-control" aria-label={'Quantity of ' + item.name}><button aria-label="Decrease quantity" onClick={() => updateItem(item.id, { quantity: Math.max(.5, item.quantity - .5) })}><Minus size={15} /></button><span>{item.quantity}×</span><button aria-label="Increase quantity" onClick={() => updateItem(item.id, { quantity: Math.min(5, item.quantity + .5) })}><Plus size={15} /></button></div></article>)}</div>
            {analysis.notes.length > 0 && <div className="notes"><AlertCircle size={18} /><p>{analysis.notes.join(' ')}</p></div>}
          </div>}
        </section>
        {error && <div className="error-message" role="alert"><AlertCircle size={19} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={17} /></button></div>}
        <section className="trust-row" aria-label="How Platewise handles your meal"><div><Sparkles size={18} /><span><strong>Clear estimates</strong><small>Simple numbers, no nutrition jargon.</small></span></div><div><ShieldCheck size={18} /><span><strong>Your photo stays yours</strong><small>Sent only to Gemini for this analysis.</small></span></div></section>
        <p className="disclaimer">Platewise provides estimates, not medical advice. Portions and recipes can change nutritional values.</p>
      </div>
      <input ref={cameraRef} className="visually-hidden" type="file" accept={ALLOWED_TYPES.join(',')} capture="environment" onChange={pickPhoto} /><input ref={libraryRef} className="visually-hidden" type="file" accept={ALLOWED_TYPES.join(',')} onChange={pickPhoto} />
      {showHistory && <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHistory(false) }}><aside className="history-drawer" aria-label="Recent meals"><div className="drawer-header"><div><span className="step-label">Saved on this device</span><h2>Recent meals</h2></div><button onClick={() => setShowHistory(false)} aria-label="Close history"><X /></button></div>{history.length === 0 ? <div className="empty-history"><History size={28} /><h3>No meals yet</h3><p>Your latest scans will appear here.</p></div> : <div className="history-list">{history.map((meal) => { const mealTotal = totalMeal(meal.items); return <button key={meal.id} onClick={() => loadMeal(meal)}><Image src={meal.thumbnail} alt="" width={64} height={64} unoptimized /><span><strong>{meal.title}</strong><small>{new Date(meal.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {Math.round(mealTotal.calories)} cal · {Math.round(mealTotal.protein)}g protein</small></span><ChevronRight size={18} /></button> })}<button className="clear-history" onClick={clearHistory}><Trash2 size={16} /> Clear recent meals</button></div>}</aside></div>}
    </main>
  );
}
