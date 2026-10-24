import { useState } from 'react'
import { Ban, Loader2, Printer } from 'lucide-react'
import { api } from '../lib/api'
import { fmtFecha, fmtQty, money } from '../lib/utils'

export default function TicketModal({ ticket, user, cerrarLabel = 'Cerrar', onClose, onActualizado }) {
  const [anulando, setAnulando] = useState(false)
  const [error, setError] = useState('')

  async function anular() {
    if (!window.confirm(`¿Anular la venta #${ticket.idVenta}? El stock volverá al inventario.`)) return
    setAnulando(true)
    setError('')
    try {
      const t = await api(`/ventas/${ticket.idVenta}/anular`, { method: 'POST' })
      onActualizado?.(t)
    } catch (e) {
      setError(e.message)
    } finally {
      setAnulando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div id="ticket" className="scroll-thin flex-1 overflow-y-auto bg-white p-6 text-sm">
          <div className="text-center">
            <div className="text-xl font-black">TES <span className="text-brand-600">SUPERMARKET</span></div>
            <div className="mt-1 text-stone-500">Venta #{ticket.idVenta}</div>
            <div className="text-stone-500">{fmtFecha(ticket.fechaVenta)}</div>
            <div className="text-stone-500">Cajero: {ticket.cajero} · Turno {ticket.nombreTurno}</div>
            {!ticket.estado && (
              <div className="mt-2 inline-block rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">VENTA ANULADA</div>
            )}
          </div>

          <div className="my-4 border-t border-dashed border-stone-300" />

          <ul className="space-y-2">
            {ticket.detalles.map((d, i) => (
              <li key={i} className="flex justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{d.nombre}</div>
                  <div className="text-xs text-stone-500">{fmtQty(d.cantidad)} {d.unidadMedida} × {money(d.precioUnitario)}</div>
                </div>
                <div className="font-semibold">{money(d.subtotal)}</div>
              </li>
            ))}
          </ul>

          <div className="my-4 border-t border-dashed border-stone-300" />

          <div className="space-y-1">
            <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{money(ticket.subtotal)}</span></div>
            <div className="flex justify-between text-stone-500"><span>Impuesto</span><span>{money(ticket.impuesto)}</span></div>
            <div className="flex justify-between text-lg font-black"><span>Total</span><span>{money(ticket.total)}</span></div>
            <div className="flex justify-between text-stone-500"><span>Pago</span><span>{ticket.tipoPago}</span></div>
          </div>
        </div>

        <div className="no-print space-y-2 border-t border-stone-100 bg-stone-50 p-4">
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-2.5 font-semibold hover:bg-stone-50">
              <Printer size={18} /> Imprimir
            </button>
            {user.rol === 'admin' && ticket.estado && (
              <button onClick={anular} disabled={anulando} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-2.5 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                {anulando ? <Loader2 className="animate-spin" size={18} /> : <Ban size={18} />} Anular
              </button>
            )}
          </div>
          <button onClick={onClose} className="w-full rounded-xl bg-brand-600 py-3 font-bold text-white hover:bg-brand-700">
            {cerrarLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
