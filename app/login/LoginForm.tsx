'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { useRouter } from 'next/navigation'
import { Banknote, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errorMessage'
import { LoginSecurityBanner } from '@/components/auth/LoginSecurityBanner'
import { AuthAntiAutocompleteFields } from '@/components/auth/AuthAntiAutocompleteFields'
import { AceptacionPoliticaDatos } from '@/components/legal/AceptacionPoliticaDatos'
import { CsrfHiddenInput } from '@/components/security/CsrfHiddenInput'
import { syncServerSessionFromClient } from '@/lib/auth/sync-server-session'

function isTooManyRequests(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const status = (err as { status?: number; code?: string }).status
    const code = (err as { code?: string }).code
    if (status === 429) return true
    if (code === 'over_request_rate_limit' || code === 'too_many_requests') return true
  }
  const msg = errorMessage(err).toLowerCase()
  return msg.includes('429') || msg.includes('too many') || msg.includes('rate limit')
}

type Props = {
  csrfToken: string
}

export default function LoginForm({ csrfToken }: Props) {
  const supabase = createBrowserSupabaseClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [cred, setCred] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [aceptaPolitica, setAceptaPolitica] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aceptaPolitica) {
      toast.error('Debe aceptar la Política de Tratamiento de Datos para ingresar.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: cred })
      if (error) throw error
      await syncServerSessionFromClient()
      await router.refresh()
      router.replace('/dashboard')
    } catch (err: unknown) {
      if (isTooManyRequests(err)) {
        toast.error('Demasiados intentos', {
          description: 'Por favor espera un minuto e inténtalo de nuevo.',
        })
      } else {
        toast.error('No pudo iniciar sesión', { description: errorMessage(err) })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-10 text-[13px] text-slate-800"
      aria-label="Login"
    >
      <div className="w-full max-w-[340px]">
        <LoginSecurityBanner />

        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgb(15,23,42,0.06)]">
          <header className="mb-6 flex flex-col items-center gap-2.5 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 shadow-sm">
              <Banknote className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div>
              <h1 className="text-[13px] font-semibold tracking-tight text-slate-900">Casa Cambio Bogotá</h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">Acceso seguro</p>
            </div>
          </header>

          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Iniciar sesión</p>

          <form
            onSubmit={handleLogin}
            className="relative mt-3 space-y-2.5"
            autoComplete="off"
            noValidate
            method="post"
            action="/login"
          >
            <CsrfHiddenInput token={csrfToken} />
            <AuthAntiAutocompleteFields
              userField={{
                id: 'cc-fld-a',
                fieldName: 'cc_fld_a',
                label: 'Correo',
                icon: (
                  <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                ),
                inputProps: {
                  type: 'email',
                  value: email,
                  onChange: (e) => setEmail(e.target.value),
                  required: true,
                  placeholder: 'correo@ejemplo.com',
                  className: 'input-field min-h-[38px] py-2 pl-8 text-[13px]',
                },
              }}
              credField={{
                id: 'cc-fld-b',
                fieldName: 'cc_fld_b',
                label: 'Contraseña',
                icon: (
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                ),
                inputProps: {
                  type: 'text',
                  inputMode: 'text',
                  value: cred,
                  onChange: (e) => setCred(e.target.value),
                  required: true,
                  placeholder: '••••••••',
                  className: `input-field min-h-[38px] py-2 pl-8 pr-9 text-[13px] font-mono ${showPass ? '' : '[--webkit-text-security:disc]'}`,
                  style: showPass ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties),
                },
                trailing: (
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-slate-100 bg-white text-slate-500 hover:bg-slate-50"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                ),
              }}
            />

            <AceptacionPoliticaDatos
              id="acepta-politica-login"
              checked={aceptaPolitica}
              onCheckedChange={setAceptaPolitica}
            />

            <button
              type="submit"
              disabled={loading || !aceptaPolitica}
              className="mt-1 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {loading ? 'Entrando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-500">Uso autorizado del sistema.</p>
      </div>
    </main>
  )
}
