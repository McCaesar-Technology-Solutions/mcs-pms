import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import Sidebar from '@/components/dashboard/sidebar'
import Topbar from '@/components/dashboard/topbar'
import { AppProviders } from '@/components/providers/app-providers'
import './globals.css'

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] })
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Abɔfa PMS - Property Management System',
  description: 'Professional property management system for Ghana hospitality',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased text-foreground">
        <AppProviders>
          <div className="flex h-screen w-full">
            <Sidebar />
            <main className="app-main h-screen min-w-0 flex-1 overflow-y-auto">
              <Topbar />
              {children}
            </main>
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
