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
  maxFrac?: number
  className?: string
  inputClassName?: string
}

export function MoneyTextField({
  id,
  label,
  value,
  onChange,
  required,
  maxFrac = 2,
  className,
  inputClassName = 'input-field input-numeric min-h-[42px] py-2 text-base',
}: Props) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <NumericFormat
        id={id}
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
        autoComplete="off"
        required={required}
        inputMode="decimal"
        onWheel={blockWheelChangeNumber}
      />
    </div>
  )
}
