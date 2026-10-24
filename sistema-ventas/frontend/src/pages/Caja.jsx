import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Apple, Beef, Boxes, Carrot, Clock, Croissant, Fish, History, LayoutGrid,
  Loader2, LogOut, Milk, Package, Search, User,
} from 'lucide-react'
import { api } from '../lib/api'
import { round2, stepOf, fmtQty, nuevoGuid } from '../lib/utils'
import Brand from '../components/Brand'
import ProductCard from '../components/ProductCard'
import ProductModal from '../components/ProductModal'
import Cart from '../components/Cart'
import TicketModal from '../components/TicketModal'
import Historial from '../components/Historial'
import AdminProductos from '../components/AdminProductos'

const ICONOS = { verduras: Carrot, frutas: Apple, carnes: Beef, mariscos: Fish, lacteos: Milk, panaderia: Croissant }
const PILL = 'flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 font-semibold text-white ring-1 ring-white/10'
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function Caja({ user, onLogout }) {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [info, setInfo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [cat, setCat] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState([]) // [{ id, cantidad }]
  const [detalle, setDetalle] = useState(null)
  const [tipoPago, setTipoPago] = useState('Efectivo')
  const [recibido, setRecibido] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorVenta, setErrorVenta] = useState('')
  const [ticket, setTicket] = useState(null)
  const [verHistorial, setVerHistorial] = useState(false)
  const [verAdmin, setVerAdmin] = useState(false)
  const [aviso, setAviso] = useState('')
  const buscadorRef = useRef(null)
  const avisoTimer = useRef(null)
  // Clave única de la venta en curso: si el cobro se repite tras un corte (failover), el servidor no cobra dos veces
  const claveVenta = useRef(nuevoGuid())

  const cargarProductos = useCallback(() => api('/productos').then(setProductos), [])

  useEffect(() => {
    Promise.all([api('/categorias'), api('/productos'), api('/caja/info')])
      .then(([c, p, i]) => { setCategorias(c); setProductos(p); setInfo(i) })
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false))
  }, [])

  // Si el stock cambia (otra caja vendió), ajusta lo que hay en la orden
  useEffect(() => {
    setCarrito((prev) => {
      const nuevo = prev
        .map((c) => {
          const p = productos.find((x) => x.idProducto === c.id)
          return p ? { ...c, cantidad: Math.min(c.cantidad, p.stockActual) } : null
        })
        .filter((c) => c && c.cantidad > 0)
      const igual = nuevo.length === prev.length && nuevo.every((c, i) => c.cantidad === prev[i].cantidad)
      return igual ? prev : nuevo
    })
  }, [productos])

  function avisar(msg) {
    setAviso(msg)
    clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 2500)
  }

  const lineas = useMemo(
    () => carrito
      .map((c) => ({ p: productos.find((x) => x.idProducto === c.id), cantidad: c.cantidad }))
      .filter((l) => l.p),
    [carrito, productos]
  )

  const tasa = info?.tasaImpuesto ?? 0.05
  const subtotal = round2(lineas.reduce((s, l) => s + round2(l.p.precioVenta * l.cantidad), 0))
  const impuesto = round2(subtotal * tasa)
  const total = round2(subtotal + impuesto)

  const enCarrito = (id) => carrito.find((c) => c.id === id)?.cantidad ?? 0

  function agregar(p, cant = stepOf(p)) {
    const actual = enCarrito(p.idProducto)
    let c = cant
    if (actual + c > p.stockActual + 1e-9) {
      avisar(`Solo hay ${fmtQty(p.stockActual)} ${p.unidadMedida} de ${p.nombre}`)
      c = round2(p.stockActual - actual)
      if (c <= 0) return
    }
    setErrorVenta('')
    setCarrito((prev) =>
      prev.some((x) => x.id === p.idProducto)
        ? prev.map((x) => (x.id === p.idProducto ? { ...x, cantidad: round2(x.cantidad + c) } : x))
        : [...prev, { id: p.idProducto, cantidad: round2(c) }]
    )
  }

  function cambiar(p, delta) {
    const nueva = round2(enCarrito(p.idProducto) + delta)
    if (nueva <= 0) return quitar(p)
    if (nueva > p.stockActual + 1e-9) return avisar(`Solo hay ${fmtQty(p.stockActual)} ${p.unidadMedida} de ${p.nombre}`)
    setCarrito((prev) => prev.map((x) => (x.id === p.idProducto ? { ...x, cantidad: nueva } : x)))
  }

  const quitar = (p) => setCarrito((prev) => prev.filter((x) => x.id !== p.idProducto))

  function enterEnBuscador(e) {
    if (e.key !== 'Enter') return
    const codigo = busqueda.trim()
    if (!codigo) return
    const p = productos.find((x) => x.codigoBarras === codigo)
    if (p) {
      if (p.stockActual <= 0) avisar(`${p.nombre} está agotado`)
      else { agregar(p); avisar(`${p.nombre} agregado`) }
      setBusqueda('')
    } else if (/^\d+$/.test(codigo)) {
      avisar('Ese código no está registrado')
    }
  }

  async function cobrar() {
    setProcesando(true)
    setErrorVenta('')
    try {
      const t = await api('/ventas', {
        method: 'POST',
        body: {
          tipoPago,
          claveIdempotencia: claveVenta.current,
          items: carrito.map((c) => ({ idProducto: c.id, cantidad: c.cantidad })),
        },
        timeoutMs: 30000,
        reintentos: 3, // seguro: la clave evita cobros duplicados
        onReintento: (n, max) => setErrorVenta(`Reconectando con la base de datos… (intento ${n}/${max})`),
      })
      claveVenta.current = nuevoGuid() // venta registrada: la siguiente usa otra clave
      setErrorVenta('')
      setTicket(t)
      setCarrito([])
      setRecibido('')
      cargarProductos().catch(() => {})
    } catch (e) {
      // 4xx = el servidor rechazó la venta (no se registró): la próxima será una venta nueva.
      // Sin respuesta / 5xx = no se sabe si se registró: se conserva la clave para no duplicar al reintentar.
      if (e.status >= 400 && e.status < 500) claveVenta.current = nuevoGuid()
      setErrorVenta(
        e.status === 0 || e.status >= 500
          ? `${e.message} Tu pedido sigue en pantalla: vuelve a pulsar Cobrar y no se cobrará dos veces.`
          : e.message
      )
      cargarProductos().catch(() => {})
    } finally {
      setProcesando(false)
    }
  }

  const visibles = useMemo(() => {
    const q = norm(busqueda.trim())
    return productos.filter(
      (p) =>
        (cat === null || p.idCategoria === cat) &&
        (q === '' || norm(p.nombre).includes(q) || p.codigoBarras.includes(busqueda.trim()))
    )
  }, [productos, cat, busqueda])

  if (cargando) {
    return <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-brand-600" size={32} /></div>
  }
  if (errorCarga) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="font-bold text-stone-900">No se pudo cargar la caja</p>
          <p className="mt-2 text-sm text-stone-600">{errorCarga}</p>
          <button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white hover:bg-brand-700">Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-4 bg-brand-900 px-6 py-3 text-white shadow-md">
        <Brand claro />
        <div className="flex items-center gap-2 text-sm">
          {info?.turno ? (
            <span className={PILL}>
              <Clock size={16} className="text-brand-300" />
              Turno {info.turno.nombreTurno} ({info.turno.horaInicio}–{info.turno.horaFin})
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-2 font-semibold text-amber-800">
              <Clock size={16} /> Sin turno activo
            </span>
          )}
          <span className={PILL}>
            <User size={16} className="text-brand-300" />
            {user.nombre} <span className="font-normal text-brand-200">({user.rol})</span>
          </span>
          {user.rol === 'admin' && (
            <button
              onClick={() => setVerAdmin(true)}
              className="flex items-center gap-1.5 rounded-xl bg-accent-600 px-3 py-2 font-bold text-white shadow-sm hover:bg-accent-700"
            >
              <Boxes size={16} /> Productos
            </button>
          )}
          <button onClick={() => setVerHistorial(true)} className={`${PILL} hover:bg-white/20`}>
            <History size={16} className="text-brand-300" /> Ventas de hoy
          </button>
          <button onClick={onLogout} className={`${PILL} hover:bg-white/20`}>
            <LogOut size={16} className="text-brand-300" /> Salir
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-5 px-6 pb-5 pt-5">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="space-y-3 border-b border-stone-100 p-4">
            <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
              <TabCategoria activo={cat === null} onClick={() => setCat(null)} icon={LayoutGrid} texto="Todo" />
              {categorias.map((c) => (
                <TabCategoria
                  key={c.idCategoria}
                  activo={cat === c.idCategoria}
                  onClick={() => setCat(c.idCategoria)}
                  icon={ICONOS[norm(c.nombre)] ?? Package}
                  texto={c.nombre}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
              <Search size={18} className="text-stone-500" />
              <input
                ref={buscadorRef}
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={enterEnBuscador}
                placeholder="Busca por nombre o escanea el código de barras y presiona Enter"
                className="w-full bg-transparent py-2.5 outline-none"
              />
            </div>
          </div>

          <div className="scroll-thin flex-1 overflow-y-auto p-5">
            {visibles.length === 0 ? (
              <p className="py-20 text-center text-stone-500">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
                {visibles.map((p) => (
                  <ProductCard key={p.idProducto} producto={p} enCarrito={enCarrito(p.idProducto)} onOpen={setDetalle} onAdd={agregar} />
                ))}
              </div>
            )}
          </div>
        </main>

        <Cart
          lineas={lineas} tasa={tasa} subtotal={subtotal} impuesto={impuesto} total={total}
          tipoPago={tipoPago} setTipoPago={setTipoPago} recibido={recibido} setRecibido={setRecibido}
          onCambiar={cambiar} onQuitar={quitar} onVaciar={() => setCarrito([])}
          onCobrar={cobrar} procesando={procesando} error={errorVenta} turnoActivo={!!info?.turno}
        />
      </div>

      {detalle && (
        <ProductModal producto={detalle} enCarrito={enCarrito(detalle.idProducto)} onClose={() => setDetalle(null)} onAdd={agregar} />
      )}

      {ticket && (
        <TicketModal
          ticket={ticket} user={user} cerrarLabel="Nueva venta"
          onClose={() => { setTicket(null); buscadorRef.current?.focus() }}
          onActualizado={(t) => { setTicket(t); cargarProductos() }}
        />
      )}

      {verHistorial && (
        <Historial user={user} onClose={() => setVerHistorial(false)} onAnulada={cargarProductos} />
      )}

      {verAdmin && (
        <AdminProductos
          categorias={categorias}
          onClose={() => setVerAdmin(false)}
          onCambio={() => cargarProductos().catch(() => {})}
        />
      )}

      {aviso && (
        <div role="status" className="fixed left-1/2 top-5 z-[60] -translate-x-1/2 rounded-xl bg-brand-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          {aviso}
        </div>
      )}
    </div>
  )
}

function TabCategoria({ activo, onClick, icon: Icon, texto }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition ${
        activo
          ? 'border-brand-600 bg-brand-600 text-white shadow-lg shadow-brand-600/25'
          : 'border-stone-100 bg-white text-stone-700 hover:border-brand-200'
      }`}
    >
      <Icon size={18} />
      {texto}
    </button>
  )
}
