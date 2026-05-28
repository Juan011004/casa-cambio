import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'

/** Replica la sesión del cliente (sessionStorage) en cookies httpOnly para server actions y middleware. */
export async function syncServerSessionFromClient(): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token || !session.refresh_token) return

  await fetch('/api/auth/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  })
}

export async function clearServerSessionCookies(): Promise<void> {
  await fetch('/api/auth/sync', { method: 'DELETE', credentials: 'same-origin' })
}
