import { Plus } from 'lucide-react'
import ProductImage from './ProductImage'
import { money, fmtQty } from '../lib/utils'

export default function ProductCard({ producto: p, enCarrito, onOpen, onAdd }) {
  const agotado = p.stockActual <= 0
  const bajo = !agotado && p.stockActual <= p.stockMinimo

  return (
    <div
      onClick={() => !agotado && onOpen(p)}
      className={`relative rounded-3xl border border-stone-100 bg-white p-4 shadow-sm transition ${
        agotado ? 'opacity-50' : 'cursor-pointer hover:shadow-md hover:border-brand-200'
      }`}
    >
      {enCarrito > 0 && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
          {fmtQty(enCarrito)} en orden
        </span>
      )}

      <ProductImage producto={p} className="h-32 w-full rounded-2xl" />

      <div className="mt-3">
        <div className="font-bold text-stone-900 leading-tight">{p.nombre}</div>
        <div className="text-xs text-stone-500">{p.origen || p.categoria}</div>
        <div className="mt-1 text-xs">
          {agotado && <span className="font-semibold text-red-600">Agotado</span>}
          {bajo && <span className="font-semibold text-amber-600">Quedan {fmtQty(p.stockActual)}</span>}
          {!agotado && !bajo && <span className="text-stone-500">Stock {fmtQty(p.stockActual)}</span>}
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between">
        <div className="text-2xl font-black text-stone-900">{money(p.precioVenta)}</div>
        <div className="text-xs text-stone-500 pb-1">por {p.unidadMedida}</div>
      </div>

      <button
        disabled={agotado}
        onClick={(e) => { e.stopPropagation(); onAdd(p) }}
        className="mt-3 flex items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-800 disabled:text-stone-500"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100">
          <Plus size={14} />
        </span>
        Agregar a la orden
      </button>
    </div>
  )
}
