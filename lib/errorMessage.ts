/** Convierte errores PostgREST/Supabase (no siempre instanceof Error) a texto legible. */
export function errorMessage(error: unknown): string {
  if (error == null) return 'Error desconocido.'
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const o = error as Record<string, unknown>
    if (typeof o.message === 'string') return o.message
    if (typeof o.details === 'string') return o.details
    if (typeof o.hint === 'string') return o.hint
    if (typeof o.error_description === 'string') return o.error_description
    try {
      return JSON.stringify(o)
    } catch {
      /* empty */
    }
  }
  return String(error)
}
