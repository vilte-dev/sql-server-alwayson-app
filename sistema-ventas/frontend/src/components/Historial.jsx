import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { api } from '../lib/api'
import { fmtFecha, money } from '../lib/utils'
import TicketModal from './TicketModal'

export default function Historial({ user, onClose, onAnulada }) {
  const [ventas, setVentas] = useState(null)
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState(null)

  const cargar = () =>
    api('/ventas/hoy').then(setVentas).catch((e) => setError(e.message))

  useEffect(() => { cargar() }, [])

  async function abrir(id) {
    try { setTicket(await api(`/ventas/${id}`)) } catch (e) { setError(e.message) }
  }

  const resumen = useMemo(() => {
    const validas = (ventas ?? []).filter((v) => v.estado)
    const porPago = {}
    validas.forEach((v) => { porPago[v.tipoPago] = (porPago[v.tipoPago] ?? 0) + v.total })
    return { n: validas.length, total: validas.reduce((s, v) => s + v.total, 0), porPago }
  }, [ventas])

  const esAdmin = user.rol === 'admin'

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-stone-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-extrabold">Ventas de hoy</h2>
            <p className="text-sm text-stone-500">{esAdmin ? 'Todas las cajas' : 'Tus ventas'}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-stone-500 hover:text-stone-700"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-stone-100 bg-stone-50 px-6 py-4 sm:grid-cols-5">
          <div><div className="text-xs text-stone-500">Ventas válidas</div><div className="text-2xl font-black">{resumen.n}</div></div>
          <div><div className="text-xs text-stone-500">Total vendido</div><div className="text-2xl font-black text-brand-600">{money(resumen.total)}</div></div>
          {['Efectivo', 'Tarjeta', 'QR'].map((t) => (
            <div key={t}><div className="text-xs text-stone-500">{t}</div><div className="text-lg font-bold">{money(resumen.porPago[t] ?? 0)}</div></div>
          ))}
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto">
          {!ventas && !error && <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-brand-600" /></div>}
          {error && <p role="alert" className="m-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {ventas && ventas.length === 0 && <p className="py-16 text-center text-stone-500">Todavía no hay ventas hoy.</p>}
          {ventas && ventas.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs text-stone-500">
                <tr>
                  <th className="px-6 py-2 font-semibold">N.º</th>
                  <th className="px-2 py-2 font-semibold">Fecha</th>
                  {esAdmin && <th className="px-2 py-2 font-semibold">Cajero</th>}
                  <th className="px-2 py-2 font-semibold">Pago</th>
                  <th className="px-2 py-2 text-right font-semibold">Total</th>
                  <th className="px-6 py-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.idVenta} onClick={() => abrir(v.idVenta)} className="cursor-pointer border-t border-stone-100 hover:bg-brand-50/50">
                    <td className="px-6 py-3 font-bold">#{v.idVenta}</td>
                    <td className="px-2 py-3 text-stone-500">{fmtFecha(v.fechaVenta)}</td>
                    {esAdmin && <td className="px-2 py-3">{v.cajero}</td>}
                    <td className="px-2 py-3">{v.tipoPago}</td>
                    <td className={`px-2 py-3 text-right font-bold ${v.estado ? '' : 'text-stone-500 line-through'}`}>{money(v.total)}</td>
                    <td className="px-6 py-3">
                      {v.estado
                        ? <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Válida</span>
                        : <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Anulada</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {ticket && (
        <TicketModal
          ticket={ticket}
          user={user}
          onClose={() => setTicket(null)}
          onActualizado={(t) => { setTicket(t); cargar(); onAnulada?.() }}
        />
      )}
    </div>
  )
}
