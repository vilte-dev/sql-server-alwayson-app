import { useEffect, useState } from 'react'
import { Minus, Plus, ShoppingCart, X } from 'lucide-react'
import ProductImage from './ProductImage'
import { fmtQty, money, round2, stepOf } from '../lib/utils'

export default function ProductModal({ producto: p, enCarrito, onClose, onAdd }) {
  const paso = stepOf(p)
  const disponible = round2(p.stockActual - enCarrito)
  const [cant, setCant] = useState(Math.min(paso, Math.max(disponible, 0)))

  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])

  const sinStock = disponible < paso

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={p.nombre}
        onClick={(e) => e.stopPropagation()}
        className="relative grid w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2"
      >
        <button onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 z-10 text-stone-500 hover:text-stone-700">
          <X size={20} />
        </button>

        <div className="grid place-items-center p-8">
          <ProductImage producto={p} className="h-64 w-full rounded-2xl" />
        </div>

        <div className="flex flex-col p-8">
          <div className="flex items-start justify-between gap-4 pr-6">
            <div>
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
                {p.categoria}
              </span>
              <h2 className="mt-3 text-3xl font-black text-stone-900">{p.nombre}</h2>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-brand-600">{money(p.precioVenta)}</div>
              <div className="text-xs text-stone-500">por {p.unidadMedida}</div>
            </div>
          </div>

          <dl className="mt-4 space-y-1 text-sm text-stone-500">
            {p.origen && <div>Origen: <span className="font-semibold text-stone-800">{p.origen}</span></div>}
            {p.calorias != null && <div>Calorías: <span className="font-semibold text-stone-800">{p.calorias} kcal por 100 g</span></div>}
            <div>Disponible: <span className="font-semibold text-stone-800">{fmtQty(disponible)} {p.unidadMedida}</span></div>
            <div>Código: <span className="font-mono text-stone-700">{p.codigoBarras}</span></div>
          </dl>

          <div className="mt-6">
            <div className="text-sm font-bold text-stone-900">Cantidad</div>
            <div className="mt-2 flex items-center justify-center gap-6">
              <button
                onClick={() => setCant((c) => Math.max(paso, round2(c - paso)))}
                disabled={cant <= paso}
                aria-label="Menos"
                className="grid h-12 w-12 place-items-center rounded-full border border-stone-200 shadow-sm hover:bg-stone-50 disabled:opacity-40"
              >
                <Minus size={18} />
              </button>
              <div className="min-w-16 text-center text-4xl font-black">{fmtQty(cant)}</div>
              <button
                onClick={() => setCant((c) => Math.min(disponible, round2(c + paso)))}
                disabled={cant + paso > disponible}
                aria-label="Más"
                className="grid h-12 w-12 place-items-center rounded-full border border-stone-200 shadow-sm hover:bg-stone-50 disabled:opacity-40"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-3 pt-6">
            <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-stone-600">
              Total <span className="ml-1 text-2xl font-black text-brand-600">{money(p.precioVenta * cant)}</span>
            </div>
            <button
              disabled={sinStock}
              onClick={() => { onAdd(p, cant); onClose() }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700 disabled:bg-stone-300 disabled:shadow-none"
            >
              <ShoppingCart size={20} />
              {sinStock ? 'Sin stock disponible' : 'Agregar a la orden'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
