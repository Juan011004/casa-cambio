'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { upsertAuditoriaOverride } from '@/app/actions/auditoriaOverrides'
import {
  buildAuditFieldText,
  fmtProm,
  formatGananciaCopCell,
  type AuditFieldTextRow,
} from '@/lib/auditoriaDisplay'
import type { AuditoriaOverrideVals, FilaAuditoriaViva } from '@/lib/auditoriaVivo'
import { parseFlexibleNumber } from '@/lib/parseMoney'

const inputCls =
  'mx-auto w-full max-w-[150px] border-0 border-b-2 border-slate-300 bg-slate-50/90 py-2 px-2 text-center font-mono text-[13px] shadow-inner focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-0'

type Props = {
  fechaDia: string
  filas: FilaAuditoriaViva[]
  auditOverrides: Map<string, AuditoriaOverrideVals>
  editAudit: boolean
  etiquetaMoneda: (codigo: string) => string
  onSaved?: () => void | Promise<void>
}

export function AuditoriaVivoTable({
  fechaDia,
  filas,
  auditOverrides,
  editAudit,
  etiquetaMoneda,
  onSaved,
}: Props) {
  const [auditFieldText, setAuditFieldText] = useState<Record<string, AuditFieldTextRow>>({})
  const [savingAudit, setSavingAudit] = useState<Record<string, boolean>>({})
  const auditFieldTextRef = useRef(auditFieldText)
  auditFieldTextRef.current = auditFieldText

  useEffect(() => {
    if (!editAudit) {
      setAuditFieldText({})
      return
    }
    setAuditFieldText(buildAuditFieldText(filas, auditOverrides))
  }, [editAudit, filas, auditOverrides])

  if (!filas.length) {
    return <p className="p-4 text-center text-base text-slate-500">Sin divisas con movimiento para este día.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-center text-base">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100">
            <th className="px-1.5 py-2 font-bold text-slate-700">Moneda</th>
            <th className="px-1.5 py-2 font-bold text-slate-700">Prom. compra ant.</th>
            <th className="px-1.5 py-2 font-bold text-slate-700">Prom. compra hoy</th>
            <th className="px-1.5 py-2 font-bold text-slate-700">Prom. venta hoy</th>
            <th className="px-1.5 py-2 font-bold text-slate-700">Δ</th>
            <th className="px-1.5 py-2 font-bold text-slate-700">Ganancia (COP)</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((row) => {
            const key = row.moneda
            const saving = !!savingAudit[key]
            const ov = auditOverrides.get(key) ?? {}
            const tx = auditFieldText[key] ?? { pa: '', pch: '', g: '' }

            const saveField = async (field: 'pa' | 'pch' | 'g') => {
              setSavingAudit((p) => ({ ...p, [key]: true }))
              try {
                const cur = auditFieldTextRef.current[key] ?? { pa: '', pch: '', g: '' }
                const payload: Record<string, unknown> = { fecha: fechaDia, moneda: key }
                if (field === 'pa') {
                  const t = cur.pa.trim()
                  payload.promedio_anterior = t ? parseFlexibleNumber(t) : undefined
                }
                if (field === 'pch') {
                  const t = cur.pch.trim()
                  payload.promedio_compra_hoy = t ? parseFlexibleNumber(t) : undefined
                }
                if (field === 'g') {
                  const t = cur.g.trim()
                  payload.ganancia_cop = t ? parseFlexibleNumber(t) : null
                }
                const res = await upsertAuditoriaOverride(payload)
                if (!res.ok) {
                  toast.error(res.error)
                  return
                }
                toast.success('Guardado')
                await onSaved?.()
              } finally {
                setSavingAudit((p) => ({ ...p, [key]: false }))
              }
            }

            const patchTx = (patch: Partial<AuditFieldTextRow>) => {
              setAuditFieldText((prev) => {
                const base = prev[key] ?? { pa: '', pch: '', g: '' }
                return { ...prev, [key]: { ...base, ...patch } }
              })
            }

            return (
              <tr key={row.moneda} className="border-b border-slate-100">
                <td className="px-1.5 py-1.5 text-left font-medium sm:text-center">{etiquetaMoneda(row.moneda)}</td>
                <td className="px-1.5 py-1.5 font-mono tabular-nums">
                  {editAudit ? (
                    <input
                      value={tx.pa}
                      disabled={saving}
                      onChange={(e) => patchTx({ pa: e.target.value })}
                      onBlur={() => void saveField('pa')}
                      className={inputCls}
                      inputMode="decimal"
                    />
                  ) : (
                    fmtProm(row.promedioAnterior)
                  )}
                </td>
                <td className="px-1.5 py-1.5 font-mono tabular-nums">
                  {editAudit ? (
                    <input
                      value={tx.pch}
                      disabled={saving}
                      onChange={(e) => patchTx({ pch: e.target.value })}
                      onBlur={() => void saveField('pch')}
                      className={inputCls}
                      inputMode="decimal"
                    />
                  ) : (
                    fmtProm(row.promedioCompraHoy)
                  )}
                </td>
                <td className="px-1.5 py-1.5 font-mono tabular-nums">
                  {row.promedioVentaHoy > 1e-12 ? fmtProm(row.promedioVentaHoy) : fmtProm(0)}
                </td>
                <td className="px-1.5 py-1.5 font-mono tabular-nums text-slate-800">{fmtProm(row.deltaVentaMenosCompraHoy)}</td>
                <td className="px-1.5 py-1.5 font-mono tabular-nums font-semibold text-slate-900">
                  {editAudit ? (
                    <input
                      value={tx.g}
                      disabled={saving}
                      placeholder="Auto"
                      onChange={(e) => patchTx({ g: e.target.value })}
                      onBlur={() => void saveField('g')}
                      className={`${inputCls} max-w-[130px]`}
                      inputMode="decimal"
                    />
                  ) : (
                    <span className="inline-flex flex-col items-center gap-0.5">
                      <span>{formatGananciaCopCell(row.gananciaCop)}</span>
                      {ov.ganancia_cop != null ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Manual</span>
                      ) : null}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
