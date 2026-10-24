import { Banknote, CreditCard, Loader2, Minus, Plus, QrCode, ScanLine, Trash2 } from 'lucide-react'
import ProductImage from './ProductImage'
import { fmtQty, money, round2, stepOf } from '../lib/utils'

const PAGOS = [
  { id: 'Efectivo', icon: Banknote },
  { id: 'Tarjeta', icon: CreditCard },
  { id: 'QR', icon: QrCode },
]

export default function Cart({
  lineas, tasa, subtotal, impuesto, total,
  tipoPago, setTipoPago, recibido, setRecibido,
  onCambiar, onQuitar, onVaciar, onCobrar, procesando, error, turnoActivo,
}) {
  const recibidoNum = Number(recibido)
  const faltante = tipoPago === 'Efectivo' && recibido !== '' && recibidoNum < total
  const cambio = tipoPago === 'Efectivo' && recibido !== '' && recibidoNum >= total ? round2(recibidoNum - total) : null
  const vacio = lineas.length === 0

  return (
    <aside className="flex w-[390px] shrink-0 flex-col overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="flex items-start justify-between border-b border-dashed border-stone-200 px-6 py-5">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900">Orden actual</h2>
          <p className="text-sm text-stone-500">{vacio ? 'Sin productos todavía' : `${lineas.length} producto${lineas.length > 1 ? 's' : ''}`}</p>
        </div>
        {!vacio && (
          <button onClick={onVaciar} className="text-sm font-semibold text-red-500 hover:text-red-700">
            Vaciar
          </button>
        )}
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
        {vacio ? (
          <div className="grid h-full place-items-center text-center text-stone-400">
            <div>
              <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-stone-50">
                <ScanLine size={30} />
              </div>
              <p className="font-medium">Escanea un código o elige<br />productos del catálogo</p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {lineas.map(({ p, cantidad }) => (
              <li key={p.idProducto} className="flex items-center gap-3 rounded-2xl border border-stone-100 p-2.5">
                <ProductImage producto={p} className="h-12 w-12 shrink-0 rounded-xl text-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-stone-900">{p.nombre}</div>
                  <div className="text-xs text-stone-500">{money(p.precioVenta)} por {p.unidadMedida}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <button onClick={() => onCambiar(p, -stepOf(p))} aria-label="Menos" className="grid h-6 w-6 place-items-center rounded-full border border-stone-200 hover:bg-stone-50">
                      <Minus size={12} />
                    </button>
                    <span className="min-w-8 text-center text-sm font-bold">{fmtQty(cantidad)}</span>
                    <button onClick={() => onCambiar(p, stepOf(p))} aria-label="Más" className="grid h-6 w-6 place-items-center rounded-full border border-stone-200 hover:bg-stone-50">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-sm font-black text-stone-900">{money(round2(p.precioVenta * cantidad))}</div>
                  <button onClick={() => onQuitar(p)} aria-label={`Quitar ${p.nombre}`} className="text-stone-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-stone-100 bg-stone-50/70 px-6 py-4">
        <div className="grid grid-cols-3 gap-2">
          {PAGOS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTipoPago(id)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-xs font-bold transition ${
                tipoPago === id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
              }`}
            >
              <Icon size={18} />
              {id}
            </button>
          ))}
        </div>

        {tipoPago === 'Efectivo' && (
          <div className="flex items-center gap-3">
            <input
              type="number" min="0" step="0.01" inputMode="decimal"
              value={recibido}
              onChange={(e) => setRecibido(e.target.value)}
              placeholder="Monto recibido"
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
            {cambio !== null && <div className="whitespace-nowrap text-sm font-bold text-brand-700">Cambio {money(cambio)}</div>}
            {faltante && <div className="whitespace-nowrap text-sm font-bold text-red-600">Faltan {money(round2(total - recibidoNum))}</div>}
          </div>
        )}

        <div className="space-y-1 text-sm text-stone-500">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between"><span>Impuesto ({Math.round(tasa * 100)}%)</span><span>{money(impuesto)}</span></div>
        </div>
        <div className="flex items-end justify-between border-t border-stone-200 pt-2">
          <span className="font-bold text-stone-900">Total</span>
          <span className="text-4xl font-black text-stone-900">{money(total)}</span>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          onClick={onCobrar}
          disabled={vacio || procesando || faltante || !turnoActivo}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700 disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none"
        >
          {procesando && <Loader2 className="animate-spin" size={20} />}
          {!turnoActivo ? 'No hay turno activo' : `Cobrar ${vacio ? '' : money(total)}`}
        </button>
      </div>
    </aside>
  )
}
