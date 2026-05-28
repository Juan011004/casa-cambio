import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { access_token?: string; refresh_token?: string }
    if (!body.access_token || !body.refresh_token) {
      return NextResponse.json({ error: 'Tokens requeridos' }, { status: 400 })
    }

    const supabase = createServerActionClient({ cookies })
    const { error } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
}

export async function DELETE() {
  const supabase = createServerActionClient({ cookies })
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
