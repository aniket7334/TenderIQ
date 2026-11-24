import type { Metadata } from 'next';
import { Fraunces, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import AuthProvider from '@/components/auth-provider';
import './globals.css';

/* Fraunces — editorial display serif, variable optical sizing */
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'opsz'],
  variable: '--font-display-face',
});

/* Public Sans — understated, high-signal UI sans used across government
   procurement surfaces (US Web Design System). Fits the tender context. */
const publicSans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans-face',
});

/* IBM Plex Mono — tabular figures for reference numbers, EMD amounts,
   deadlines, lat/long. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-mono-face',
});

export const metadata: Metadata = {
  title: 'TenderIQ — Maritime & Infrastructure Tenders',
  description:
    'Intelligence desk for port, dredging and marine infrastructure tenders. Discover, qualify, and track every bid from a single admiralty-grade workspace.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}
    >
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgb(253 250 243)',
              color: 'rgb(26 29 33)',
              border: '1px solid rgb(26 29 33 / 0.18)',
              borderRadius: '2px',
              padding: '10px 14px',
              fontSize: '13.5px',
              fontFamily: 'var(--font-sans)',
              boxShadow: '0 1px 0 rgb(26 29 33 / 0.04), 0 10px 32px -16px rgb(11 46 79 / 0.25)',
            },
            success: {
              iconTheme: { primary: 'rgb(74 107 63)', secondary: 'rgb(253 250 243)' },
            },
            error: {
              iconTheme: { primary: 'rgb(139 26 26)', secondary: 'rgb(253 250 243)' },
            },
          }}
        />
      </body>
    </html>
  );
}
