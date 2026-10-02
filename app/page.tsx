'use client';
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useClerk,
} from '@clerk/nextjs';
import {
  AlertCircle,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  History,
  ImagePlus,
  Leaf,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { AppTour } from './app-tour';
import { MealProcessing } from './meal-processing';
import { syncErrorMessage } from '@/lib/sync-error';
import { restoreAccountHistory } from '@/lib/account-history';
import { MealAnalysis, MealItem, SavedMeal, totalMeal } from '@/lib/nutrition';
import { flushMealOperations, queueMealOperation } from '@/lib/meal-sync';
import { validateMeal } from '@/lib/database-validation';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_PHOTOS = 4;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const STORAGE_KEY = 'platewise:recent-meals';
const HISTORY_SEEN_KEY = 'platewise:history-seen-at';
type Photo = { id: string; blob: Blob; preview: string };

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: unknown,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

function historyKey(userId?: string | null) {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

function storageValue(key: string) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

async function mealThumbnail(preview: string) {
  const bitmap = await createImageBitmap(await (await fetch(preview)).blob());
  const scale = Math.min(1, 360 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.65);
}

function readHistory(userId?: string | null): SavedMeal[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(historyKey(userId)) || '[]',
    );
    return Array.isArray(value)
      ? value
          .map(validateMeal)
          .filter((meal): meal is SavedMeal => meal !== null)
      : [];
  } catch {
    return [];
  }
}

function dateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function compressImage(
  file: File,
): Promise<{ blob: Blob; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('We could not prepare this photo.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error('We could not prepare this photo.')),
      'image/jpeg',
      0.82,
    ),
  );
  return { blob, preview: canvas.toDataURL('image/jpeg', 0.68) };
}

export default function Home() {
  const { isLoaded, userId } = useAuth();
  const [guestPhotos, setGuestPhotos] = useState<Photo[]>([]);
  if (!isLoaded)
    return (
      <main className="page-shell">
        <p>Loading your account…</p>
      </main>
    );
  return (
    <AccountHome
      key={userId || 'guest'}
      initialPhotos={guestPhotos}
      onGuestPhotosChange={setGuestPhotos}
    />
  );
}

function AccountHome({
  initialPhotos,
  onGuestPhotosChange,
}: {
  initialPhotos: Photo[];
  onGuestPhotosChange: (photos: Photo[]) => void;
}) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { openSignUp, openSignIn } = useClerk();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const swipeStartX = useRef<number | null>(null);

  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [preview, setPreview] = useState(initialPhotos[0]?.preview || '');
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [currentMealId, setCurrentMealId] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedMeal[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [status, setStatus] = useState<'idle' | 'ready' | 'loading' | 'result'>(
    initialPhotos.length ? 'ready' : 'idle',
  );
  const [error, setError] = useState('');
  const [openDeleteId, setOpenDeleteId] = useState<string | null>(null);
  const [pendingMealDeleteId, setPendingMealDeleteId] = useState<string | null>(
    null,
  );
  const [hasUnseenHistory, setHasUnseenHistory] = useState(false);
  const [cloudHistory, setCloudHistory] = useState(false);
  const [historySyncError, setHistorySyncError] = useState('');
  const [restoringHistory, setRestoringHistory] = useState(Boolean(userId));
  const [syncNotice, setSyncNotice] = useState('');
  const [savingMeals, setSavingMeals] = useState(0);
  useEffect(() => {
    if (userId) queueMicrotask(() => onGuestPhotosChange([]));
  }, [userId, onGuestPhotosChange]);
  const historyRevision = useRef(0);

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    let refreshing = false;

    async function refresh() {
      if (!userId || !active || refreshing) return;
      refreshing = true;
      const revision = historyRevision.current;
      try {
        const { meals, imported } = await restoreAccountHistory(userId);
        if (!active || revision !== historyRevision.current) return;
        if (imported)
          setSyncNotice(
            imported === 1
              ? 'Your browser meal is now in your account.'
              : `${imported} browser meals are now in your account.`,
          );
        setCloudHistory(true);
        setHistory(meals);
        setHasUnseenHistory(
          Boolean(
            meals[0] &&
            meals[0].createdAt > storageValue(`${HISTORY_SEEN_KEY}:${userId}`),
          ),
        );
        setHistorySyncError('');
        try {
          localStorage.setItem(historyKey(userId), JSON.stringify(meals));
        } catch {
          setHistorySyncError(
            'Cloud history is available, but this browser cannot keep an offline copy.',
          );
        }
      } catch (reason) {
        if (active) setHistorySyncError(syncErrorMessage(reason));
      } finally {
        refreshing = false;
        if (active) setRestoringHistory(false);
      }
    }
    queueMicrotask(async () => {
      const saved = readHistory(userId);
      const seenAt = storageValue(`${HISTORY_SEEN_KEY}:${userId || 'guest'}`);
      if (!active) return;
      setHistory(saved);
      setHasUnseenHistory(Boolean(saved[0] && saved[0].createdAt > seenAt));
      setCloudHistory(false);

      await refresh();
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const retry = () => {
      if (!refreshing) {
        setRestoringHistory(true);
        void refresh();
      }
    };
    window.addEventListener('platewise:retry-history', retry);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(onVisible, 30_000);
    return () => {
      active = false;
      window.removeEventListener('platewise:retry-history', retry);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [isLoaded, userId]);

  function saveHistoryLocal(meals: SavedMeal[]) {
    historyRevision.current++;
    try {
      localStorage.setItem(historyKey(userId), JSON.stringify(meals));
    } catch {
      setHistorySyncError(
        'This browser could not save an offline copy. Keep this tab open until cloud sync finishes.',
      );
    }
  }

  async function syncMeal(meal: SavedMeal) {
    if (!userId) return;
    setSavingMeals((count) => count + 1);
    try {
      queueMealOperation(userId, { type: 'save', meal });
      await flushMealOperations(userId);
      setHistorySyncError('');
      setCloudHistory(true);
      setSyncNotice('Saved to your account. Available on your other devices.');
    } catch (reason) {
      setHistorySyncError(syncErrorMessage(reason));
    } finally {
      setSavingMeals((count) => count - 1);
    }
  }

  async function deleteCloudMeal(id?: string) {
    if (!userId) return;
    try {
      queueMealOperation(
        userId,
        id ? { type: 'delete', id } : { type: 'clear' },
      );
      await flushMealOperations(userId);
      setHistorySyncError('');
    } catch {
      setHistorySyncError(
        'Cloud sync failed. This change is saved on this device only.',
      );
    }
  }

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'start_meal_scan',
            title: 'Start meal scan',
            description:
              'Open the photo picker so the person can select a meal to analyze.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: async () => {
              libraryRef.current?.click();
              return { status: 'waiting_for_photo' };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {}
    return () => lifecycle.abort();
  }, []);

  const totals = useMemo(
    () => (analysis ? totalMeal(analysis.items) : null),
    [analysis],
  );
  const mealsByDate = useMemo(
    () =>
      history.reduce<Record<string, SavedMeal[]>>((groups, meal) => {
        const key = dateKey(meal.createdAt);
        (groups[key] ||= []).push(meal);
        return groups;
      }, {}),
    [history],
  );
  const selectedMeals = useMemo(
    () => mealsByDate[selectedDate] || [],
    [mealsByDate, selectedDate],
  );
  const selectedTotals = useMemo(
    () => totalMeal(selectedMeals.flatMap((meal) => meal.items)),
    [selectedMeals],
  );
  const calendarDays = useMemo(() => {
    const start = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1 - calendarMonth.getDay(),
    );
    return Array.from(
      { length: 42 },
      (_, index) =>
        new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate() + index,
        ),
    );
  }, [calendarMonth]);
  const todayKey = dateKey(new Date());
  const viewingCurrentMonth =
    calendarMonth.getFullYear() === new Date().getFullYear() &&
    calendarMonth.getMonth() === new Date().getMonth();

  async function pickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    if (photos.length >= MAX_PHOTOS)
      return setError(`You can add up to ${MAX_PHOTOS} photos per meal.`);
    const available = files.slice(0, MAX_PHOTOS - photos.length);
    if (available.some((file) => !ALLOWED_TYPES.includes(file.type)))
      return setError('Please choose JPEG, PNG or WebP photos.');
    if (available.some((file) => file.size > MAX_FILE_SIZE))
      return setError('Each photo must be under 8 MB.');
    try {
      const compressed = await Promise.all(available.map(compressImage));
      const additions = compressed.map((photo) => ({
        id: crypto.randomUUID(),
        blob: photo.blob,
        preview: photo.preview,
      }));
      const nextPhotos = [...photos, ...additions];
      setPhotos(nextPhotos);
      if (!userId) onGuestPhotosChange(nextPhotos);
      if (!preview) setPreview(additions[0].preview);
      setAnalysis(null);
      setStatus('ready');
      if (files.length > available.length)
        setError(
          `We added the first ${available.length}. A meal can have up to ${MAX_PHOTOS} photos.`,
        );
    } catch {
      setError('We could not open one of those photos. Please try again.');
    }
  }

  async function analyzeMeal() {
    if (!photos.length) return;
    if (!isSignedIn) {
      if (isLoaded) openSignIn();
      return;
    }
    if (!navigator.onLine)
      return setError('You’re offline. Reconnect to analyze this meal.');
    setStatus('loading');
    setError('');
    try {
      const form = new FormData();
      photos.forEach((photo, index) =>
        form.append('images', photo.blob, `meal-${index + 1}.jpg`),
      );
      const response = await fetch('/api/analyze-meal', {
        method: 'POST',
        body: form,
        headers: { 'X-Platewise-Account': userId || '' },
      });
      const body = (await response.json()) as MealAnalysis & { error?: string };
      if (!response.ok)
        throw new Error(body.error || 'We could not analyze this meal.');
      const next: MealAnalysis = body;
      const saved: SavedMeal = {
        ...next,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        thumbnail: await mealThumbnail(preview),
      };
      setCurrentMealId(saved.id);
      const nextHistory = [saved, ...history];
      setHistory(nextHistory);
      setHasUnseenHistory(true);
      saveHistoryLocal(nextHistory);
      void syncMeal(saved);
      setAnalysis(next);
      setStatus('result');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'We could not analyze this meal.',
      );
      setStatus('ready');
    }
  }

  function updateItem(id: string, itemPatch: Partial<MealItem>) {
    if (!analysis) return;
    const updated = {
      ...analysis,
      items: analysis.items.map((item) =>
        item.id === id ? { ...item, ...itemPatch } : item,
      ),
    };
    setAnalysis(updated);
    if (!currentMealId) return;
    const next = history.map((meal) =>
      meal.id === currentMealId ? { ...meal, items: updated.items } : meal,
    );
    setHistory(next);
    saveHistoryLocal(next);
    const changed = next.find((meal) => meal.id === currentMealId);
    if (changed) void syncMeal(changed);
  }
  function deleteItem(id: string) {
    setOpenDeleteId(null);
    if (!analysis) return;
    const updated = {
      ...analysis,
      items: analysis.items.filter((item) => item.id !== id),
    };
    setAnalysis(updated);
    if (!currentMealId) return;
    const next = history.map((meal) =>
      meal.id === currentMealId ? { ...meal, items: updated.items } : meal,
    );
    setHistory(next);
    saveHistoryLocal(next);
    const changed = next.find((meal) => meal.id === currentMealId);
    if (changed) void syncMeal(changed);
  }
  function removePhoto(id?: string) {
    if (id) {
      const next = photos.filter((photo) => photo.id !== id);
      setPhotos(next);
      if (!userId) onGuestPhotosChange(next);
      setPreview(next[0]?.preview || '');
      if (!next.length) setStatus('idle');
      return;
    }
    setPhotos([]);
    if (!userId) onGuestPhotosChange([]);
    setPreview('');
    setAnalysis(null);
    setCurrentMealId(null);
    setStatus('idle');
    setError('');
  }
  function loadMeal(meal: SavedMeal) {
    setAnalysis(meal);
    setCurrentMealId(meal.id);
    setPreview(meal.thumbnail);
    setPhotos([]);
    if (!userId) onGuestPhotosChange([]);
    setStatus('result');
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function clearHistory() {
    saveHistoryLocal([]);
    try {
      localStorage.removeItem(`${HISTORY_SEEN_KEY}:${userId || 'guest'}`);
    } catch {}
    setHistory([]);
    setHasUnseenHistory(false);
    void deleteCloudMeal();
  }
  function deleteSavedMeal(id: string) {
    const next = history.filter((meal) => meal.id !== id);
    setHistory(next);
    setPendingMealDeleteId(null);
    saveHistoryLocal(next);
    void deleteCloudMeal(id);
  }
  function openHistory() {
    const today = new Date();
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(dateKey(today));
    setHasUnseenHistory(false);
    try {
      localStorage.setItem(
        `${HISTORY_SEEN_KEY}:${userId || 'guest'}`,
        history[0]?.createdAt || new Date().toISOString(),
      );
    } catch {}
    setShowHistory(true);
  }

  return (
    <main className="min-h-screen">
      <header className="site-header">
        <button
          className="brand"
          onClick={() => removePhoto()}
          aria-label="Platewise home"
        >
          <span className="brand-mark">
            <Leaf size={18} strokeWidth={2.4} />
          </span>
          <span>platewise</span>
        </button>
        <div className="header-actions">
          <AppTour
            signedIn={Boolean(isSignedIn)}
            onSignIn={() => openSignIn()}
            onSignUp={() => openSignUp()}
          />
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="sign-in-button">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="sign-up-button">Get started</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton userProfileMode="modal" />
          </Show>
        </div>
        <button
          className="history-button"
          type="button"
          onClick={openHistory}
          aria-label="View recent meals"
        >
          <History size={18} aria-hidden="true" />
          <span>Recent meals</span>
          {hasUnseenHistory && <b aria-hidden="true" />}
        </button>
      </header>
      <div id="top" className="page-shell">
        {status === 'idle' && (
          <section className="intro" aria-labelledby="page-title">
            <p className="eyebrow">
              <span /> Your everyday nutrition companion
            </p>
            <h1 id="page-title">
              Know what’s on <br />
              your plate.
            </h1>
            <p className="intro-copy">
              <span className="intro-copy-desktop">
                Take a photo of your meal. We’ll estimate the calories, protein
                and nutrients in a few moments.
              </span>
              <span className="intro-copy-phone">
                One photo. Calories, protein and more.
              </span>
            </p>
          </section>
        )}
        <section
          className={
            'scanner-card ' + (status !== 'idle' ? 'scanner-active' : '')
          }
          aria-labelledby="scanner-title"
        >
          {status === 'idle' && (
            <>
              <div className="scanner-copy">
                <div>
                  <span className="step-label">01 · Add your meal</span>
                  <h2 id="scanner-title">Snap it. We’ll do the counting.</h2>
                </div>
                <p>
                  For the clearest estimate, photograph the whole plate in good
                  light.
                </p>
              </div>
              <button
                className="photo-drop"
                type="button"
                aria-label="Take a meal photo"
                onClick={() => cameraRef.current?.click()}
              >
                <Image
                  src="/editorial-meal.png"
                  alt=""
                  fill
                  sizes="(max-width: 920px) 100vw, 880px"
                  priority
                />
                <span className="photo-overlay">
                  <span className="camera-circle">
                    <Camera size={25} />
                  </span>
                  <strong>Take a photo</strong>
                  <small>or choose one from your phone</small>
                </span>
              </button>
              <div className="upload-actions">
                <button
                  className="primary-action"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera size={19} /> Open camera <ChevronRight size={18} />
                </button>
                <button
                  className="secondary-action"
                  onClick={() => libraryRef.current?.click()}
                >
                  <ImagePlus size={19} /> Choose a photo
                </button>
              </div>
            </>
          )}
          {(status === 'ready' || status === 'loading') && (
            <div className="review-layout">
              <div className="photo-review">
                <div
                  className={`photo-review-grid ${photos.length === 1 ? 'single-photo' : ''}`}
                >
                  {photos.map((photo, index) => (
                    <div
                      className={
                        'review-photo ' +
                        (index === 0 ? 'review-photo-main' : '')
                      }
                      key={photo.id}
                    >
                      <Image
                        src={photo.preview}
                        alt={`Meal photo ${index + 1}`}
                        fill
                        sizes="(max-width: 640px) 90vw, 420px"
                        unoptimized
                      />
                      {status !== 'loading' && (
                        <button
                          className="remove-photo"
                          onClick={() => removePhoto(photo.id)}
                          aria-label={`Remove meal photo ${index + 1}`}
                        >
                          <X size={18} />
                        </button>
                      )}
                      <span className="photo-number">{index + 1}</span>
                      {status === 'loading' && (
                        <span className="scan-sweep" aria-hidden="true" />
                      )}
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && status !== 'loading' && (
                    <button
                      className="add-photo-tile"
                      type="button"
                      onClick={() => cameraRef.current?.click()}
                    >
                      <span>
                        <Camera size={22} />
                      </span>
                      <strong>Add another</strong>
                      <small>
                        {photos.length}/{MAX_PHOTOS} photos
                      </small>
                    </button>
                  )}
                </div>
              </div>
              <div className="review-copy">
                <span className="step-label">
                  {status === 'loading'
                    ? 'Working on your estimate'
                    : '02 · Your meal'}
                </span>
                <h2 id="scanner-title">
                  {status === 'loading'
                    ? 'Looking at your meal…'
                    : photos.length > 1
                      ? `${photos.length} views. One clear estimate.`
                      : 'Ready to see what’s on your plate?'}
                </h2>
                <p>
                  {status === 'loading'
                    ? 'Every photo is treated as one meal, so the same food is counted once.'
                    : 'Tap Analyze meal for your estimate. Extra angles are optional.'}
                </p>
                {status === 'loading' ? (
                  <MealProcessing />
                ) : (
                  <button className="analyze-button" onClick={analyzeMeal}>
                    <Sparkles size={19} /> Analyze meal{' '}
                    <ChevronRight size={18} />
                  </button>
                )}
                {status !== 'loading' && photos.length < MAX_PHOTOS && (
                  <div className="add-more-actions">
                    <button
                      type="button"
                      onClick={() => cameraRef.current?.click()}
                    >
                      <Camera size={18} /> Take another
                    </button>
                    <button
                      type="button"
                      onClick={() => libraryRef.current?.click()}
                    >
                      <ImagePlus size={18} /> Add from library
                    </button>
                  </div>
                )}
                {status !== 'loading' && (
                  <button className="text-button" onClick={() => removePhoto()}>
                    <RotateCcw size={15} /> Start over
                  </button>
                )}
              </div>
            </div>
          )}
          {status === 'result' && analysis && totals && (
            <div className="results">
              <output className="meal-save-state">
                {savingMeals
                  ? 'Saving this meal to your account…'
                  : historySyncError
                    ? 'Saved on this device. Account sync needs attention.'
                    : cloudHistory
                      ? 'Saved to your account · available across devices'
                      : 'Saved on this device'}
              </output>
              <div className="result-top">
                <div className="result-photo">
                  <Image
                    src={preview}
                    alt=""
                    width={96}
                    height={96}
                    unoptimized
                  />
                </div>
                <div>
                  <span className="step-label">Your meal estimate</span>
                  <h2>{analysis.title}</h2>
                  <p className={'confidence ' + analysis.confidence}>
                    {analysis.confidence} confidence
                  </p>
                </div>
                <button className="start-over" onClick={() => removePhoto()}>
                  <Camera size={17} /> Scan another
                </button>
              </div>
              <div className="headline-metrics">
                <div className="calorie-block">
                  <small>Estimated energy</small>
                  <strong>{Math.round(totals.calories)}</strong>
                  <span>calories</span>
                </div>
                <div className="protein-block">
                  <small>Protein</small>
                  <strong>
                    {Math.round(totals.protein)}
                    <span>g</span>
                  </strong>
                  <div className="protein-line">
                    <i
                      style={{
                        width: Math.min(100, totals.protein / 0.5) + '%',
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="macro-grid">
                <div>
                  <span>Carbs</span>
                  <strong>{Math.round(totals.carbs)}g</strong>
                </div>
                <div>
                  <span>Fat</span>
                  <strong>{Math.round(totals.fat)}g</strong>
                </div>
                <div>
                  <span>Fiber</span>
                  <strong>{Math.round(totals.fiber)}g</strong>
                </div>
              </div>
              <div className="food-list">
                <div className="section-heading">
                  <div>
                    <span className="step-label">What we found</span>
                    <h3>Foods & portions</h3>
                  </div>
                  <small>Adjust amounts or swipe left to remove</small>
                </div>
                {analysis.items.map((item) => (
                  <div
                    className={
                      'food-swipe ' +
                      (openDeleteId === item.id ? 'is-open' : '')
                    }
                    key={item.id}
                  >
                    <button
                      className="delete-food"
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={18} />
                      <span>Remove</span>
                    </button>
                    <article
                      className="food-item"
                      onTouchStart={(event) => {
                        swipeStartX.current = event.touches[0].clientX;
                      }}
                      onTouchEnd={(event) => {
                        const start = swipeStartX.current;
                        swipeStartX.current = null;
                        if (start === null) return;
                        const distance =
                          event.changedTouches[0].clientX - start;
                        if (distance < -45) setOpenDeleteId(item.id);
                        else if (distance > 35) setOpenDeleteId(null);
                      }}
                    >
                      <div className="food-main">
                        <input
                          aria-label="Food name"
                          value={item.name}
                          maxLength={80}
                          onChange={(e) =>
                            updateItem(item.id, { name: e.target.value })
                          }
                        />
                        <input
                          className="portion-input"
                          aria-label={'Portion for ' + item.name}
                          value={item.portion}
                          maxLength={60}
                          onChange={(e) =>
                            updateItem(item.id, { portion: e.target.value })
                          }
                        />
                      </div>
                      <div className="food-nutrition">
                        <strong>
                          {Math.round(item.calories * item.quantity)} cal
                        </strong>
                        <span>
                          {Math.round(item.protein * item.quantity)}g protein
                        </span>
                      </div>
                      <div
                        className="quantity-control"
                        aria-label={'Quantity of ' + item.name}
                      >
                        <button
                          aria-label="Decrease quantity"
                          onClick={() =>
                            updateItem(item.id, {
                              quantity: Math.max(0.5, item.quantity - 0.5),
                            })
                          }
                        >
                          <Minus size={15} />
                        </button>
                        <span>{item.quantity}×</span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() =>
                            updateItem(item.id, {
                              quantity: Math.min(5, item.quantity + 0.5),
                            })
                          }
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      <button
                        className="desktop-delete-food"
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </article>
                  </div>
                ))}
                {analysis.items.length === 0 && (
                  <div className="empty-foods">
                    <strong>No foods left</strong>
                    <span>
                      Remove the photo and scan again if this result wasn’t your
                      meal.
                    </span>
                  </div>
                )}
              </div>
              {analysis.notes.length > 0 && (
                <div className="notes">
                  <AlertCircle size={18} />
                  <p>{analysis.notes.join(' ')}</p>
                </div>
              )}
            </div>
          )}
        </section>
        {error && (
          <div className="error-message" role="alert">
            <AlertCircle size={19} />
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss">
              <X size={17} />
            </button>
          </div>
        )}
        {userId && (
          <div
            className={`account-sync-banner ${historySyncError ? 'sync-pending' : ''}`}
          >
            <span className="account-sync-icon">
              {restoringHistory ? (
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
              ) : (
                <ShieldCheck size={17} aria-hidden="true" />
              )}
            </span>
            <div>
              <output>
                {restoringHistory
                  ? 'Bringing your meals together…'
                  : savingMeals
                    ? 'Saving your meal to your account…'
                    : historySyncError
                      ? 'Your meals are safe here. Sync is pending.'
                      : syncNotice || 'Your meal history is up to date.'}
              </output>
              <span>
                {restoringHistory
                  ? 'Loading your account and saving meals from this browser.'
                  : historySyncError
                    ? historySyncError
                    : 'Pick up where you left off, on any device.'}
              </span>
            </div>
            {historySyncError && (
              <button
                type="button"
                disabled={restoringHistory}
                onClick={() =>
                  window.dispatchEvent(new Event('platewise:retry-history'))
                }
              >
                Retry sync
              </button>
            )}
          </div>
        )}
        {!userId && (
          <p className="guest-account-note">
            <ShieldCheck size={15} aria-hidden="true" /> Sign in to bring your
            browser meals with you.
          </p>
        )}
        <section
          className="trust-row"
          aria-label="How Platewise handles your meal"
        >
          <div>
            <Sparkles size={18} />
            <span>
              <strong>Clear estimates</strong>
              <small>Simple numbers, no nutrition jargon.</small>
            </span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>
              <strong>Your photo stays yours</strong>
              <small>Used only to estimate this meal.</small>
            </span>
          </div>
        </section>
        <p className="disclaimer">
          Platewise provides estimates, not medical advice. Portions and recipes
          can change nutritional values.
        </p>
      </div>
      <input
        ref={cameraRef}
        className="visually-hidden"
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        capture="environment"
        onChange={pickPhoto}
      />
      <input
        ref={libraryRef}
        className="visually-hidden"
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        multiple
        onChange={pickPhoto}
      />
      {showHistory && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowHistory(false);
          }}
        >
          <aside className="history-drawer" aria-label="Meal calendar">
            <div className="drawer-header">
              <div>
                <span className="step-label">
                  {cloudHistory && !historySyncError && !savingMeals
                    ? 'Saved to your account'
                    : 'Saved on this device'}
                </span>
                <h2>Meal calendar</h2>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                aria-label="Close history"
              >
                <X />
              </button>
            </div>
            {historySyncError ? (
              <output className="history-sync-note">{historySyncError}</output>
            ) : null}
            <section
              className="calendar-card"
              aria-label={calendarMonth.toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            >
              <div className="calendar-toolbar">
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() - 1,
                        1,
                      ),
                    )
                  }
                  aria-label="Previous month"
                >
                  <ChevronLeft />
                </button>
                <strong>
                  {calendarMonth.toLocaleDateString(undefined, {
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() + 1,
                        1,
                      ),
                    )
                  }
                  aria-label="Next month"
                  disabled={viewingCurrentMonth}
                >
                  <ChevronRight />
                </button>
              </div>
              <div className="calendar-weekdays" aria-hidden="true">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                  (day) => (
                    <span key={day}>{day}</span>
                  ),
                )}
              </div>
              <div className="calendar-grid">
                {calendarDays.map((day) => {
                  const key = dateKey(day);
                  const count = mealsByDate[key]?.length || 0;
                  const outside = day.getMonth() !== calendarMonth.getMonth();
                  const future = key > todayKey;
                  return (
                    <button
                      key={key}
                      className={`${selectedDate === key ? 'selected ' : ''}${outside ? 'outside ' : ''}${future ? 'future' : ''}`}
                      disabled={future}
                      onClick={() => {
                        setSelectedDate(key);
                        if (outside)
                          setCalendarMonth(
                            new Date(day.getFullYear(), day.getMonth(), 1),
                          );
                      }}
                      aria-label={`${day.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}${count ? `, ${count} meal${count > 1 ? 's' : ''}` : ', no meals'}`}
                    >
                      <span>{day.getDate()}</span>
                      {count > 0 && <i>{count}</i>}
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="day-summary">
              <div className="day-summary-heading">
                <div>
                  <span className="step-label">Daily summary</span>
                  <h3>
                    {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                      undefined,
                      { weekday: 'long', month: 'long', day: 'numeric' },
                    )}
                  </h3>
                </div>
                <span>
                  {selectedMeals.length} meal
                  {selectedMeals.length === 1 ? '' : 's'}
                </span>
              </div>
              {selectedMeals.length > 0 ? (
                <>
                  <div className="day-total">
                    <div>
                      <small>Total energy</small>
                      <strong>{Math.round(selectedTotals.calories)}</strong>
                      <span>calories</span>
                    </div>
                    <dl>
                      <div>
                        <dt>Protein</dt>
                        <dd>{Math.round(selectedTotals.protein)}g</dd>
                      </div>
                      <div>
                        <dt>Carbs</dt>
                        <dd>{Math.round(selectedTotals.carbs)}g</dd>
                      </div>
                      <div>
                        <dt>Fat</dt>
                        <dd>{Math.round(selectedTotals.fat)}g</dd>
                      </div>
                      <div>
                        <dt>Fiber</dt>
                        <dd>{Math.round(selectedTotals.fiber)}g</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="history-list">
                    {selectedMeals.map((meal) => {
                      const mealTotal = totalMeal(meal.items);
                      const confirming = pendingMealDeleteId === meal.id;
                      return (
                        <div className="saved-meal-row" key={meal.id}>
                          <button
                            className="saved-meal-open"
                            onClick={() => loadMeal(meal)}
                          >
                            <Image
                              src={meal.thumbnail}
                              alt=""
                              width={64}
                              height={64}
                              unoptimized
                            />
                            <span>
                              <strong>{meal.title}</strong>
                              <small>
                                {new Date(meal.createdAt).toLocaleTimeString(
                                  undefined,
                                  { hour: 'numeric', minute: '2-digit' },
                                )}{' '}
                                · {Math.round(mealTotal.calories)} cal ·{' '}
                                {Math.round(mealTotal.protein)}g protein
                              </small>
                            </span>
                            <ChevronRight size={18} />
                          </button>
                          <button
                            className={`saved-meal-delete ${confirming ? 'confirming' : ''}`}
                            onClick={() =>
                              confirming
                                ? deleteSavedMeal(meal.id)
                                : setPendingMealDeleteId(meal.id)
                            }
                            aria-label={
                              confirming
                                ? `Confirm deletion of ${meal.title}`
                                : `Delete ${meal.title}`
                            }
                          >
                            <Trash2 size={17} />
                            <span>{confirming ? 'Delete' : 'Remove'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="empty-day">
                  <CalendarDays size={25} />
                  <strong>No meals saved</strong>
                  <span>Scans from this day will appear here.</span>
                </div>
              )}
            </section>
            {history.length > 0 && (
              <button className="clear-history" onClick={clearHistory}>
                <Trash2 size={16} /> Clear meal history
              </button>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
