'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Scale,
  LayoutDashboard,
  Wallet,
  Landmark,
  History,
  PiggyBank,
  type LucideIcon,
} from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { FechaOperativaProvider } from '@/components/fecha-operativa/FechaOperativaProvider'
import { cn } from '@/lib/utils'

const NO_SHELL_ROUTES = ['/login']

const MOBILE: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'INICIO', href: '/dashboard', icon: LayoutDashboard },
  { label: 'COMP.', href: '/comprar', icon: ArrowDownLeft },
  { label: 'VEND.', href: '/vender', icon: ArrowUpRight },
  { label: 'CAJA', href: '/caja', icon: Landmark },
  { label: 'TGO', href: '/tengo', icon: PiggyBank },
  { label: 'GASTOS', href: '/gastos', icon: Wallet },
  { label: 'DEBEN', href: '/nos-deben', icon: HandCoins },
  { label: 'DEBO', href: '/debemos', icon: Scale },
  { label: 'HIST.', href: '/historial', icon: History },
]

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const hideShell = NO_SHELL_ROUTES.includes(pathname)

  if (hideShell) return <>{children}</>

  return (
    <FechaOperativaProvider>
    <div className="flex min-h-screen bg-white text-base text-black">
      <Suspense
        fallback={
          <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] border-r border-slate-100 bg-white lg:block" />
        }
      >
        <Sidebar />
      </Suspense>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex gap-px border-t border-slate-100 bg-white lg:hidden"
        aria-label="Menú rápido"
      >
        {MOBILE.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-0.5 text-[10px] font-bold leading-tight text-black no-underline',
                active ? 'bg-blue-600 text-white' : 'bg-white'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-center">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col pb-[52px] lg:pb-0 lg:pl-[var(--sidebar-width)]">
        <Header />
        <main className="flex-1 overflow-y-auto bg-white p-3 lg:p-5">
          <div className="mx-auto w-full max-w-5xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </div>
    </FechaOperativaProvider>
  )
}
