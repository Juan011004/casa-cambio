import { NextResponse } from 'next/server'
import { syncTrmMercadoFromExchange } from '@/lib/trm-sync-server'

/**
 * Vercel Cron cada hora. Configura CRON_SECRET en Vercel y la misma en el cron auth.
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')

  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: 'Defina CRON_SECRET en el proyecto para proteger este endpoint.' },
        { status: 501 }
      )
    }
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    }
  } else if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const res = await syncTrmMercadoFromExchange()
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
