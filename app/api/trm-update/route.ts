import { NextResponse } from 'next/server'
import { syncTrmMercadoFromExchange } from '@/lib/trm-sync-server'

/**
 * Actualiza `trm_mercado` vía service role.
 * Protegido con CRON_SECRET: Authorization: Bearer <CRON_SECRET>
 *
 * Uso en plan Vercel Hobby: sin Crons de Vercel; usar GitHub Actions (ver .github/workflows)
 * o depender del refresco perezoso al abrir el Dashboard (obtenerTrmMercado).
 */
function authorize(request: Request): NextResponse | null {
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

  return null
}

async function runSync(): Promise<NextResponse> {
  const res = await syncTrmMercadoFromExchange()
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function GET(request: Request) {
  const denied = authorize(request)
  if (denied) return denied
  return runSync()
}

export async function POST(request: Request) {
  const denied = authorize(request)
  if (denied) return denied
  return runSync()
}

export const dynamic = 'force-dynamic'
