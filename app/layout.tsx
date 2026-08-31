import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_Tamil } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerRegistrar } from '@/components/sw-register'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const notoSansTamil = Noto_Sans_Tamil({
  subsets: ['tamil', 'latin'],
  variable: '--font-tamil',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Finance Tracker',
  description: 'Collection & Staff Finance Tracker',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfcfd' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d12' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${notoSansTamil.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          {children}
          <ServiceWorkerRegistrar />
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
