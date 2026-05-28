'use client'

import { X } from 'lucide-react'
import { POLITICA_DATOS_SECCIONES, POLITICA_DATOS_TITULO } from '@/lib/legal/politica-datos-content'

type Props = {
  open: boolean
  onClose: () => void
}

export function PoliticaDatosDialog({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="politica-datos-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div
        className="relative flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 id="politica-datos-title" className="pr-6 text-base font-bold text-slate-900">
            {POLITICA_DATOS_TITULO}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar política"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-700">
          {POLITICA_DATOS_SECCIONES.map((sec) => (
            <section key={sec.titulo} className="mb-4 last:mb-0">
              <h3 className="mb-1 font-semibold text-slate-900">{sec.titulo}</h3>
              {sec.parrafos.map((p, i) => (
                <p key={i} className="mb-2 last:mb-0">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-lg bg-slate-900 text-sm font-bold text-white hover:bg-slate-800"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
