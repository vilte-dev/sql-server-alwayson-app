import { ShoppingCart } from 'lucide-react'

/** `claro` = versión para fondos oscuros (cabecera verde). */
export default function Brand({ subtitle = 'Punto de venta · Caja', claro = false }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid h-12 w-12 place-items-center rounded-2xl ${
          claro ? 'bg-white/10 ring-1 ring-white/20' : 'bg-brand-600 shadow-lg shadow-brand-600/30'
        }`}
      >
        <ShoppingCart className={claro ? 'text-brand-200' : 'text-white'} size={24} />
      </div>
      <div className="leading-tight">
        <div className={`text-2xl font-black tracking-tight ${claro ? 'text-white' : 'text-stone-900'}`}>
          TES <span className={claro ? 'text-accent-300' : 'text-brand-600'}>SUPERMARKET</span>
        </div>
        <div className={`text-[11px] font-medium tracking-widest ${claro ? 'text-brand-200/80' : 'text-stone-500'}`}>
          {subtitle}
        </div>
      </div>
    </div>
  )
}
