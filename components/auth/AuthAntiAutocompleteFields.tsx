'use client'

import type { InputHTMLAttributes, ReactNode } from 'react'

type FieldProps = {
  id: string
  label: string
  icon?: ReactNode
  inputProps: InputHTMLAttributes<HTMLInputElement>
  trailing?: ReactNode
}

/** Inputs de credenciales con trampa anti-autocompletado para Chrome/Edge. */
export function AuthAntiAutocompleteFields({ email, password }: { email: FieldProps; password: FieldProps }) {
  return (
    <>
      <input
        type="text"
        name="fake-email"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
        defaultValue=""
      />
      <input
        type="password"
        name="fake-password"
        autoComplete="new-password"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
        defaultValue=""
      />

      <div>
        <label htmlFor={email.id} className="mb-1 block text-[11px] font-medium text-slate-600">
          {email.label}
        </label>
        <div className="relative">
          {email.icon}
          <input
            {...email.inputProps}
            id={email.id}
            name={email.id}
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
            name={password.id}
            autoComplete="new-password"
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
