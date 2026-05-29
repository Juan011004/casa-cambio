'use client'

import type { InputHTMLAttributes, ReactNode } from 'react'

type FieldProps = {
  id: string
  label: string
  icon?: ReactNode
  inputProps: InputHTMLAttributes<HTMLInputElement>
  trailing?: ReactNode
  fieldName: string
}

export function AuthAntiAutocompleteFields({
  userField,
  credField,
}: {
  userField: FieldProps
  credField: FieldProps
}) {
  return (
    <>
      <div>
        <label htmlFor={userField.id} className="mb-1 block text-[11px] font-medium text-slate-600">
          {userField.label}
        </label>
        <div className="relative">
          {userField.icon}
          <input
            {...userField.inputProps}
            id={userField.id}
            name={userField.fieldName}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore
          />
        </div>
      </div>

      <div>
        <label htmlFor={credField.id} className="mb-1 block text-[11px] font-medium text-slate-600">
          {credField.label}
        </label>
        <div className="relative">
          {credField.icon}
          <input
            {...credField.inputProps}
            id={credField.id}
            name={credField.fieldName}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore
          />
          {credField.trailing}
        </div>
      </div>
    </>
  )
}
