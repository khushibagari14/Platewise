import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Platewise — Understand what is on your plate',
  description: 'Photograph a meal and get a clear estimate of calories, protein, carbs, fat, and fiber.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
