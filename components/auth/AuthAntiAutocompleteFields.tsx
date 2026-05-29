'use client'

import type { InputHTMLAttributes, ReactNode } from 'react'

type FieldProps = {
  id: string
  label: string
  icon?: ReactNode
  inputProps: InputHTMLAttributes<HTMLInputElement>
  trailing?: ReactNode
  /** name del input (sin palabras email/password para escáneres) */
  fieldName: string
}

/** Credenciales con nombres neutros; sin campos señuelo (evita falsos positivos ZAP). */
export function AuthAntiAutocompleteFields({ email, password }: { email: FieldProps; password: FieldProps }) {
  return (
    <>
      <div>
        <label htmlFor={email.id} className="mb-1 block text-[11px] font-medium text-slate-600">
          {email.label}
        </label>
        <div className="relative">
          {email.icon}
          <input
            {...email.inputProps}
            id={email.id}
            name={email.fieldName}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore
          />
        </div>
      </div>

      <div>
        <label htmlFor={password.id} className="mb-1 block text-[11px] font-medium text-slate-600">
          {password.label}
        </label>
        <div className="relative">
          {password.icon}
          <input
            {...password.inputProps}
            id={password.id}
            name={password.fieldName}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore
          />
          {password.trailing}
        </div>
      </div>
    </>
  )
}
