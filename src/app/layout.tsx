import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Grinta — Football Organisé',
  description: 'Organise tes matchs, équilibre les équipes, vote pour le MVP.',

  // ── Manifest ────────────────────────────────────────────────────────────────
  manifest: '/manifest.webmanifest',

  // ── Apple PWA ───────────────────────────────────────────────────────────────
  appleWebApp: {
    capable: true,
    title: 'Grinta',
    statusBarStyle: 'black-translucent',
    startupImage: [
      // iPhone 15 Pro Max / 14 Pro Max
      { url: '/icons/apple-touch-icon.png', media: '(device-width: 430px) and (device-height: 932px)' },
      // Fallback for all others
      { url: '/icons/apple-touch-icon.png' },
    ],
  },

  // ── Icons ───────────────────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192x192.png',
  },

  // ── Open Graph (sharing) ────────────────────────────────────────────────────
  openGraph: {
    title: 'Grinta — Football Organisé',
    description: 'Organise tes matchs, équilibre les équipes, vote pour le MVP.',
    type: 'website',
    locale: 'fr_FR',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Fills the whole screen (hides browser chrome when installed as PWA)
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0D0D0D' },
    { media: '(prefers-color-scheme: light)', color: '#0D0D0D' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* ── Additional Apple meta tags not covered by Next.js Metadata API ── */}
        {/* Force full-screen immersive mode on iOS when launched from home screen */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Prevent iOS from detecting phone numbers and turning them into links */}
        <meta name="format-detection" content="telephone=no" />

        {/* Service worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .catch(function(err) { console.warn('SW registration failed:', err); });
                });
              }
            `,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1A1A1A',
              border: '1px solid #2A2A2A',
              color: '#F5F5F5',
              fontFamily: "'DM Sans', sans-serif",
            },
          }}
        />
      </body>
    </html>
  )
}
