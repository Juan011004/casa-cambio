/**
 * Reduce riesgo XSS al persistir texto: sin tags ni scripts.
 * No sustituye encoding en salida; los datos se muestran como texto en React.
 */
export function safePlainText(input: string, maxLen: number): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen)
}

/** Códigos de divisa alfanuméricos cortos (evita inyección en columnas text). */
export function safeDivisaCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 12)
}
