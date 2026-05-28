'use client'

import { useState } from 'react'
import { PoliticaDatosDialog } from '@/components/legal/PoliticaDatosDialog'

type Props = {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  id?: string
  className?: string
}

export function AceptacionPoliticaDatos({ checked, onCheckedChange, id = 'acepta-politica-datos', className }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-800 ${className ?? ''}`}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          required
        />
        <span>
          Acepto la{' '}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDialogOpen(true)
            }}
            className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            Política de Tratamiento de Datos
          </button>
          .
        </span>
      </label>
      <PoliticaDatosDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  )
}
