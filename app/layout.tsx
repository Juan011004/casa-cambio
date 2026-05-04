import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Casa Cambio Bogotá',
  description: 'Operaciones de compra y venta',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full bg-white`} suppressHydrationWarning>
      <body className={`${inter.className} min-h-full bg-white text-base leading-relaxed text-black antialiased lg:text-[17px]`}>
        <AppShell>{children}</AppShell>
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: 'text-sm border border-slate-100 bg-white text-black',
            },
          }}
        />
      </body>
    </html>
  )
}
