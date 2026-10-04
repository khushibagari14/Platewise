import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Platewise — Understand what is on your plate',
  description:
    'Photograph a meal and get a clear estimate of calories, protein, carbs, fat, and fiber.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){var t;try{t=localStorage.getItem('platewise:theme')}catch(e){}document.documentElement.dataset.theme=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'})()` }} /></head>
      <body>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: 'var(--primary)',
              colorBackground: 'var(--paper)',
              colorForeground: 'var(--foreground)',
              colorMutedForeground: 'var(--ink-muted)',
              colorInput: 'var(--paper)',
              colorInputForeground: 'var(--foreground)',
              borderRadius: '0.875rem',
            },
          }}
        >
          {children}
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  );
}


