'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { AuditoriaVivoTable } from '@/components/auditoria/AuditoriaVivoTable'
import { useAuditoriaDia } from '@/hooks/useAuditoriaDia'

type Props = {
  open: boolean
  onClose: () => void
  fecha: string
  onAfterSave?: () => void
}

export function ModalAuditoriaCaja({ open, onClose, fecha, onAfterSave }: Props) {
  const { loading, filas, auditOverrides, etiquetaMoneda, reload } = useAuditoriaDia(fecha, open)
  const [editAudit, setEditAudit] = useState(true)

  useEffect(() => {
    if (open) setEditAudit(true)
  }, [open])

  if (!open) return null

  const handleSaved = async () => {
    await reload()
    onAfterSave?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/50"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="mx-auto mt-auto flex max-h-[92vh] w-full max-w-5xl flex-col rounded-t-2xl bg-white shadow-2xl sm:my-4 sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-audit-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="modal-audit-titulo" className="text-lg font-bold text-slate-900">
            Promedios y ganancia — {fecha}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">
          Toque un valor y salga del campo para guardar. Solo afecta el día {fecha}.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="p-6 text-center text-slate-500">…</p>
          ) : (
            <AuditoriaVivoTable
              fechaDia={fecha}
              filas={filas}
              auditOverrides={auditOverrides}
              editAudit={editAudit}
              etiquetaMoneda={etiquetaMoneda}
              onSaved={handleSaved}
            />
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-3 border-t border-slate-200 px-4 py-4">
          <button
            type="button"
            onClick={() => setEditAudit((v) => !v)}
            className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-5 text-base font-bold text-slate-800"
          >
            {editAudit ? 'Solo ver' : 'Editar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] min-w-[140px] rounded-xl bg-slate-800 px-6 text-base font-bold text-white"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
