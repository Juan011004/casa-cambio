'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[error-boundary]', error.message)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <h1 className="text-lg font-semibold text-black">Algo salió mal</h1>
      <p className="text-sm text-slate-600">
        No pudimos cargar esta sección. Puede ser un fallo temporal de red o del servidor.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Reintentar
      </button>
    </div>
  )
}
