'use client'

import { NumericFormat } from 'react-number-format'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { blockWheelChangeNumber } from '@/lib/inputNumeric'

type Props = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  disabled?: boolean
  maxFrac?: number
  className?: string
  inputClassName?: string
  /** Si true, no muestra etiqueta (usa aria-label con `label`). */
  omitLabel?: boolean
}

export function MoneyTextField({
  id,
  label,
  value,
  onChange,
  required,
  disabled,
  maxFrac = 2,
  className,
  inputClassName = 'input-field input-numeric min-h-[42px] py-2 text-base',
  omitLabel,
}: Props) {
  return (
    <div className={className}>
      {omitLabel ? null : (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      )}
      <NumericFormat
        id={id}
        aria-label={omitLabel ? label : undefined}
        thousandSeparator="."
        decimalSeparator=","
        allowedDecimalSeparators={[',', '.']}
        decimalScale={maxFrac}
        fixedDecimalScale={false}
        allowNegative={false}
        allowLeadingZeros
        value={value}
        valueIsNumericString={false}
        onValueChange={(vals) => {
          onChange(vals.formattedValue)
        }}
        onFocus={(e) => {
          const n = parseFlexibleNumber(e.target.value)
          if (e.target.value === '0' || e.target.value === '0,' || n === 0) onChange('')
        }}
        className={inputClassName}
        disabled={disabled}
        autoComplete="off"
        required={required}
        inputMode="decimal"
        onWheel={blockWheelChangeNumber}
      />
    </div>
  )
}
