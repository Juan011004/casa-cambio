'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { Users, UserCheck, UserX, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { SkeletonTable } from '@/components/ui/Skeletons'
import type { Usuario } from '@/types/database'

const ROL_STYLES: Record<string, string> = {
  admin: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30',
  supervisor: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  cajero: 'bg-slate-700/80 text-slate-300 ring-1 ring-slate-600/80',
}

export default function UsersPage() {
  const supabase = createBrowserSupabaseClient()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<Usuario[]>([])

  const fetchUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers((data ?? []) as Usuario[])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const toggleActivo = async (u: Usuario) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !u.activo })
      .eq('id', u.id)
    if (error) {
      toast.error('No se pudo actualizar el usuario')
    } else {
      toast.success(
        u.activo
          ? `Usuario ${u.nombre} desactivado`
          : `Usuario ${u.nombre} activado`
      )
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, activo: !x.activo } : x))
      )
    }
  }

  const changeRol = async (u: Usuario, rol: Usuario['rol']) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ rol })
      .eq('id', u.id)
    if (error) {
      toast.error('No se pudo cambiar el rol')
    } else {
      toast.success(`Rol de ${u.nombre} actualizado a ${rol}`)
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, rol } : x))
      )
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <header className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Usuarios</h1>
          <p className="text-sm text-slate-400">Gestión de accesos y roles del sistema</p>
        </header>
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-400">
          <Users className="h-4 w-4 text-emerald-500" aria-hidden />
          {users.length} usuarios
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
        <div className="card-pro overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90">
                <th className="table-header">Usuario</th>
                <th className="table-header">Email</th>
                <th className="table-header">Rol</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Creado</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-slate-800/35">
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold uppercase text-emerald-400 ring-1 ring-slate-700">
                        {u.nombre.charAt(0)}
                      </div>
                      <span className="font-medium capitalize text-white">{u.nombre}</span>
                    </div>
                  </td>
                  <td className="table-cell text-slate-400">{u.email}</td>
                  <td className="table-cell">
                    <select
                      value={u.rol}
                      onChange={(e) =>
                        changeRol(u, e.target.value as Usuario['rol'])
                      }
                      className={`cursor-pointer rounded-full border-0 px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${ROL_STYLES[u.rol] ?? ROL_STYLES.cajero}`}
                    >
                      <option value="cajero">Cajero</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                        u.activo
                          ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                          : 'bg-slate-800 text-slate-500 ring-slate-700'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          u.activo ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="table-cell text-right">
                    <button
                      type="button"
                      onClick={() => toggleActivo(u)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${
                        u.activo
                          ? 'text-slate-400 hover:bg-rose-950/35 hover:text-rose-400'
                          : 'text-slate-400 hover:bg-emerald-950/40 hover:text-emerald-400'
                      }`}
                    >
                      {u.activo ? (
                        <>
                          <UserX className="w-3.5 h-3.5" /> Desactivar
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" /> Activar
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card-pro p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-500" aria-hidden />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Roles del sistema</span>
        </div>
        <div className="grid gap-4 text-xs md:grid-cols-3">
          {[
            { t: 'Cajero', d: 'Registra compras y ventas. Sin configuración ni usuarios.' },
            { t: 'Supervisor', d: 'Historial completo, inventario y reportes. No usuarios.' },
            { t: 'Admin', d: 'Acceso total: usuarios, TRM y auditoría.' },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-400">
              <p className="mb-2 font-bold text-white">{x.t}</p>
              <p className="leading-relaxed">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
