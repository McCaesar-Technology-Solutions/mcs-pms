import type { Metadata } from 'next'
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
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: 'MOJO APARTMENTS',
    description: 'Professional property management system for Ghana hospitality',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
