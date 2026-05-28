import { AlertTriangle } from 'lucide-react'

export function LoginSecurityBanner() {
  return (
    <div
      role="alert"
      className="mb-4 flex gap-2.5 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-left text-[11px] leading-snug text-amber-950"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
      <p>
        <span className="font-bold uppercase tracking-wide">Aviso de seguridad:</span>{' '}
        Este portal es de uso estrictamente interno y administrativo. El acceso no autorizado está prohibido y
        monitoreado.
      </p>
    </div>
  )
}
