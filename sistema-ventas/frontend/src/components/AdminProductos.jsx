import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { fmtQty, money, norm } from '../lib/utils'
import ProductImage from './ProductImage'
import ProductForm from './ProductForm'

const TOAST = {
  ok: 'bg-brand-950 text-white',
  info: 'bg-accent-700 text-white',
  error: 'bg-red-700 text-white',
}

/** Panel del administrador: lista de productos con alta, edición, eliminación e imagen. */
export default function AdminProductos({ categorias, onClose, onCambio }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [verInactivos, setVerInactivos] = useState(false)
  const [form, setForm] = useState(null)          // null = cerrado · { producto } (producto null = nuevo)
  const [aviso, setAviso] = useState(null)        // { texto, tipo }
  const [trabajando, setTrabajando] = useState(null)
  const avisoTimer = useRef(null)

  const cargar = useCallback(
    () => api('/admin/productos').then((d) => { setLista(d); setError('') }).catch((e) => setError(e.message)),
    []
  )
  useEffect(() => { cargar() }, [cargar])

  // Esc cierra el panel (si hay un formulario abierto, Esc solo cierra el formulario)
  useEffect(() => {
    const salir = (e) => e.key === 'Escape' && !form && onClose()
    window.addEventListener('keydown', salir)
    return () => window.removeEventListener('keydown', salir)
  }, [form, onClose])

  function avisar(texto, tipo = 'ok') {
    setAviso({ texto, tipo })
    clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(null), tipo === 'ok' ? 3000 : 7000)
  }

  const visibles = useMemo(() => {
    const q = norm(busqueda.trim())
    return (lista ?? []).filter(
      (p) =>
        (verInactivos || p.estado) &&
        (q === '' || norm(p.nombre).includes(q) || norm(p.categoria).includes(q) || p.codigoBarras.includes(busqueda.trim()))
    )
  }, [lista, busqueda, verInactivos])

  const nActivos = (lista ?? []).filter((p) => p.estado).length
  const nInactivos = (lista ?? []).length - nActivos

  async function eliminar(p) {
    const ok = window.confirm(
      `¿Eliminar "${p.nombre}"?\n\nSi ya tiene ventas o ajustes de inventario no se borra: se desactiva y deja de aparecer en caja, para conservar el historial.`
    )
    if (!ok) return
    setTrabajando(p.idProducto)
    try {
      const r = await api(`/admin/productos/${p.idProducto}`, { method: 'DELETE' })
      avisar(r.mensaje, r.desactivado ? 'info' : 'ok')
      await cargar()
      onCambio?.()
    } catch (e) {
      avisar(e.message, 'error')
    } finally {
      setTrabajando(null)
    }
  }

  async function reactivar(p) {
    setTrabajando(p.idProducto)
    try {
      await api(`/admin/productos/${p.idProducto}/reactivar`, { method: 'POST' })
      avisar(`"${p.nombre}" volvió a estar activo.`)
      await cargar()
      onCambio?.()
    } catch (e) {
      avisar(e.message, 'error')
    } finally {
      setTrabajando(null)
    }
  }

  function guardado(_producto, editando) {
    setForm(null)
    avisar(editando ? 'Producto actualizado.' : 'Producto creado.')
    cargar()
    onCambio?.()
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Administrar productos"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-extrabold text-stone-900">Administrar productos</h2>
            <p className="text-sm text-stone-500">
              {lista ? `${nActivos} activos${nInactivos ? ` · ${nInactivos} desactivados` : ''}` : 'Cargando…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setForm({ producto: null })}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700"
            >
              <Plus size={18} /> Nuevo producto
            </button>
            <button onClick={onClose} aria-label="Cerrar" className="text-stone-500 hover:text-stone-800">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Búsqueda y filtro */}
        <div className="flex flex-wrap items-center gap-4 border-b border-stone-100 bg-stone-50 px-6 py-3">
          <div className="flex min-w-64 flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
            <Search size={18} className="text-stone-500" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, categoría o código"
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            Mostrar desactivados{nInactivos > 0 && ` (${nInactivos})`}
          </label>
        </div>

        {/* Tabla */}
        <div className="scroll-thin flex-1 overflow-auto">
          {!lista && !error && (
            <div className="grid place-items-center py-20"><Loader2 className="animate-spin text-brand-600" /></div>
          )}
          {error && <p role="alert" className="m-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {lista && visibles.length === 0 && (
            <p className="py-20 text-center text-stone-500">No hay productos que coincidan.</p>
          )}
          {lista && visibles.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white text-xs text-stone-500 shadow-[0_1px_0_var(--color-stone-100)]">
                <tr>
                  <th className="px-6 py-2.5 font-semibold">Producto</th>
                  <th className="px-2 py-2.5 font-semibold">Código</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Compra</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Venta</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Stock</th>
                  <th className="px-2 py-2.5 font-semibold">Estado</th>
                  <th className="px-6 py-2.5 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => {
                  const agotado = p.stockActual <= 0
                  const bajo = !agotado && p.stockActual <= p.stockMinimo
                  const ocupado = trabajando === p.idProducto
                  return (
                    <tr key={p.idProducto} className={`border-t border-stone-100 hover:bg-brand-50/40 ${p.estado ? '' : 'opacity-60'}`}>
                      <td className="px-6 py-2.5">
                        <div className="flex items-center gap-3">
                          <ProductImage producto={p} className="h-11 w-11 shrink-0 rounded-lg text-base" />
                          <div className="min-w-0">
                            <div className="truncate font-bold text-stone-900">{p.nombre}</div>
                            <div className="text-xs text-stone-500">{p.categoria}{p.origen ? ` · ${p.origen}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 font-mono text-xs text-stone-600">{p.codigoBarras}</td>
                      <td className="px-2 py-2.5 text-right text-stone-600">{money(p.precioCompra)}</td>
                      <td className="px-2 py-2.5 text-right font-bold text-stone-900">{money(p.precioVenta)}</td>
                      <td className="px-2 py-2.5 text-right">
                        <span className={`font-semibold ${agotado ? 'text-red-600' : bajo ? 'text-amber-600' : 'text-stone-800'}`}>
                          {fmtQty(p.stockActual)}
                        </span>{' '}
                        <span className="text-xs text-stone-500">{p.unidadMedida}</span>
                        {agotado && <div className="text-xs font-semibold text-red-600">Agotado</div>}
                        {bajo && <div className="text-xs font-semibold text-amber-600">Stock bajo</div>}
                      </td>
                      <td className="px-2 py-2.5">
                        {p.estado ? (
                          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Activo</span>
                        ) : (
                          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">Desactivado</span>
                        )}
                      </td>
                      <td className="px-6 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {ocupado ? (
                            <Loader2 className="animate-spin text-stone-500" size={18} />
                          ) : p.estado ? (
                            <>
                              <button
                                onClick={() => setForm({ producto: p })}
                                aria-label={`Editar ${p.nombre}`}
                                title="Editar"
                                className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 text-stone-700 hover:border-brand-300 hover:bg-brand-50"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => eliminar(p)}
                                aria-label={`Eliminar ${p.nombre}`}
                                title="Eliminar"
                                className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 text-red-600 hover:border-red-200 hover:bg-red-50"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => reactivar(p)}
                              className="flex items-center gap-1.5 rounded-lg border border-brand-200 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50"
                            >
                              <RotateCcw size={14} /> Reactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {form && (
        <ProductForm
          producto={form.producto}
          categorias={categorias}
          onClose={() => setForm(null)}
          onGuardado={guardado}
        />
      )}

      {aviso && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[70] max-w-lg -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${TOAST[aviso.tipo]}`}
        >
          {aviso.texto}
        </div>
      )}
    </div>
  )
}
