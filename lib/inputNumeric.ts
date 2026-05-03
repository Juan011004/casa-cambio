import type React from 'react'

export function blockWheelChangeNumber(e: React.WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur()
}

export function clearZeroOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  const v = e.target.value.trim()
  if (v === '' || v === '-') return
  const n = parseFloat(v.replace(',', '.'))
  if (n === 0 && !Number.isNaN(n)) {
    e.target.value = ''
    e.target.dispatchEvent(new Event('input', { bubbles: true }))
  }
}
