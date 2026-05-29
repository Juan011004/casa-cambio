import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { CsrfProvider } from '@/components/security/CsrfProvider'
import { getServerCsrfToken } from '@/lib/get-server-csrf'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Casa Cambio Bogotá',
  description: 'Operaciones de compra y venta',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const csrfToken = getServerCsrfToken()

  return (
    <html lang="es" className={`${inter.variable} h-full bg-white`} suppressHydrationWarning>
      <body className={`${inter.className} min-h-full bg-white text-base leading-relaxed text-black antialiased lg:text-[17px]`}>
        <CsrfProvider token={csrfToken}>
          <nav className="sr-only" aria-hidden="true">
            <a href="/login">Acceso</a>
            <a href="/dashboard">Inicio</a>
          </nav>
          <AppShell>{children}</AppShell>
        </CsrfProvider>
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
