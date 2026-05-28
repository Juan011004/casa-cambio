import { createClient } from '@supabase/supabase-js'
import { isBrowser } from '@supabase/auth-helpers-shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/database'

const noopLock = async <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> =>
  fn()

let instance: SupabaseClient<Database> | undefined

export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY son requeridos')
  }

  const browser = isBrowser()

  if (!instance) {
    instance = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: browser,
        detectSessionInUrl: browser,
        persistSession: true,
        storage: browser ? window.sessionStorage : undefined,
        lock: noopLock,
      },
      global: {
        headers: { 'X-Client-Info': 'casa-cambio-web' },
      },
    })
  }

  return instance
}
