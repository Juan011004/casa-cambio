import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes safely
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número como moneda COP
 * Ejemplo: 4200 → $ 4.200,00
 */
export function formatCOP(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Formatea un número como moneda USD
 */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Parsea un string de moneda COP a número
 */
export function parseCOP(value: string): number {
  return parseFloat(value.replace(/[^0-9,-]/g, '').replace(',', '.')) || 0
}

/**
 * Formatea fecha a formato legible en español
 */
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateStr))
}
