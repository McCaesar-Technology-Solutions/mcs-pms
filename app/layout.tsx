import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Analytics } from '@vercel/analytics/next'
import { Cormorant_Garamond, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { AppProviders } from '@/components/providers/app-providers'
import './globals.css'

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] })
const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'MOJO APARTMENTS - Property Management System',
  description: 'Professional property management system for Ghana hospitality',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MOJO Apartments',
  },
  openGraph: {
    title: 'MOJO APARTMENTS',
    description: 'Professional property management system for Ghana hospitality',
    type: 'website',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'MOJO Apartments' }],
  },
}

export const viewport = {
  themeColor: '#22124c',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Force dynamic rendering so Next.js can stamp the per-request nonce (from the
  // request CSP header set in middleware) onto its own bootstrap scripts.
  // @vercel/analytics/next 1.6.1 does not accept a nonce prop.
  await headers()

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${cormorant.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased text-foreground" suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
        <Analytics />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
