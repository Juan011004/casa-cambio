'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { useEffect, useState } from 'react'

export function Header() {
  const [userLabel, setUserLabel] = useState('')

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserLabel(data.user?.email?.split('@')[0] ?? '')
    })
  }, [])

  return (
    <header className="sticky top-0 z-30 flex min-h-[44px] shrink-0 items-center justify-end border-b border-slate-100 bg-white px-3 py-2 lg:px-5">
      {userLabel ? (
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-slate-100 bg-white px-2 py-1 text-xs font-semibold uppercase text-black shadow-sm">
            {userLabel.charAt(0)}
          </span>
          <span className="max-w-[160px] truncate text-sm font-medium text-black">{userLabel}</span>
        </div>
      ) : null}
    </header>
  )
}
