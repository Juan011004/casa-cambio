export default function Loading() {
  return (
    <div className="flex min-h-[30vh] items-center justify-center px-4 py-12" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
    </div>
  )
}
