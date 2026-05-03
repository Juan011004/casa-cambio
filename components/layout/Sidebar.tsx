'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Scale,
  LogOut,
  Banknote,
  Wallet,
  Landmark,
  History,
} from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { cn } from '@/lib/utils'

type NavEntry = {
  label: string
  href: string
  icon: LucideIcon
}

const NAV_ITEMS: NavEntry[] = [
  { label: 'INICIO', href: '/dashboard', icon: LayoutDashboard },
  { label: 'COMPRAR', href: '/comprar', icon: ArrowDownLeft },
  { label: 'VENDER', href: '/vender', icon: ArrowUpRight },
  { label: 'CAJA', href: '/caja', icon: Landmark },
  { label: 'GASTOS', href: '/gastos', icon: Wallet },
  { label: 'NOS DEBEN', href: '/nos-deben', icon: HandCoins },
  { label: 'DEBEMOS', href: '/debemos', icon: Scale },
  { label: 'HISTORIAL', href: '/historial', icon: History },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.replace('/login')
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] flex-col border-r border-slate-100 bg-white lg:flex'
      )}
      aria-label="Menú principal"
    >
      <div className="flex min-h-[44px] items-center gap-2 border-b border-slate-100 px-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600">
          <Banknote className="h-4 w-4 text-white" aria-hidden />
        </div>
        <p className="text-xs font-semibold leading-tight text-black">Casa Cambio</p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-1.5 py-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-2 text-xs font-semibold text-black no-underline outline-none',
                active ? 'bg-blue-600 text-white' : 'hover:bg-slate-50'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-blue-600')} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-100 p-1.5">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-black hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Salir
        </button>
      </div>
    </aside>
  )
}
