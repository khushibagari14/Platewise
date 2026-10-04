'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
export function ThemeToggle() {
 const [dark, setDark] = useState(false);
 useEffect(() => {
  const update = () => setDark(document.documentElement.dataset.theme === 'dark');
  update();
  if (!window.matchMedia) return;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const applySystem = () => {
   try { if (localStorage.getItem('platewise:theme')) return; } catch {}
   document.documentElement.dataset.theme = system.matches ? 'dark' : 'light';
   update();
  };
  const storage = () => {
   let preference: string | null = null;
   try { preference = localStorage.getItem('platewise:theme'); } catch {}
   document.documentElement.dataset.theme = preference === 'dark' || (preference !== 'light' && system.matches) ? 'dark' : 'light';
   update();
  };
  system.addEventListener('change', applySystem);
  window.addEventListener('storage', storage);
  return () => { system.removeEventListener('change', applySystem); window.removeEventListener('storage', storage); };
 }, []);
 function toggle() {
  const next = !dark;
  document.documentElement.dataset.theme = next ? 'dark' : 'light';
  try { localStorage.setItem('platewise:theme', next ? 'dark' : 'light'); } catch {}
  setDark(next);
 }
 return <button type="button" className="theme-toggle" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

