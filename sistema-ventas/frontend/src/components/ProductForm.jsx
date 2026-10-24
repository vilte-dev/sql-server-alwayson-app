import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { fmtQty, imgSrc, money, round2 } from '../lib/utils'

const UNIDADES = ['unidad', 'kg']
const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 3

const campo =
  'w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20'

function Campo({ label, ayuda, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      <div className="mt-1">{children}</div>
      {ayuda && <span className="mt-1 block text-xs text-stone-500">{ayuda}</span>}
    </label>
  )
}

/** Alta y edición de un producto. `producto` = null → producto nuevo. */
export default function ProductForm({ producto, categorias, onClose, onGuardado }) {
  const editando = !!producto

  const [f, setF] = useState(() => ({
    codigoBarras: producto?.codigoBarras ?? '',
    nombre: producto?.nombre ?? '',
    idCategoria: producto?.idCategoria ?? categorias[0]?.idCategoria ?? '',
    precioCompra: producto?.precioCompra ?? '',
    precioVenta: producto?.precioVenta ?? '',
    stockActual: producto?.stockActual ?? 0,
    stockMinimo: producto?.stockMinimo ?? 0,
    unidadMedida: producto?.unidadMedida ?? 'unidad',
    origen: producto?.origen ?? '',
    calorias: producto?.calorias ?? '',
  }))
  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }))

  // Imagen: archivo nuevo elegido, o la actual (que se puede quitar)
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [quitar, setQuitar] = useState(false)
  const [imgRota, setImgRota] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [urlWeb, setUrlWeb] = useState('')
  const inputRef = useRef(null)

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const urlWebOk = /^https?:\/\/\S+$/i.test(urlWeb.trim())
  const imagenMostrada = preview ?? (urlWebOk ? urlWeb.trim() : null) ?? (!quitar ? imgSrc(producto?.imagenUrl) : null)
  useEffect(() => { setImgRota(false) }, [imagenMostrada])

  // Libera la vista previa anterior cada vez que cambia y al cerrar
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  useEffect(() => {
    const salir = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', salir)
    return () => window.removeEventListener('keydown', salir)
  }, [onClose])

  function elegir(file) {
    if (!file) return
    if (!TIPOS_OK.includes(file.type)) return setError('La imagen debe ser JPG, PNG o WEBP.')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`La imagen supera los ${MAX_MB} MB.`)
    setError('')
    setArchivo(file)
    setPreview(URL.createObjectURL(file))
    setUrlWeb('')
    setQuitar(false)
  }

  // Escribir una URL reemplaza al archivo elegido (solo se usa una de las dos fuentes)
  function cambiarUrl(valor) {
    setUrlWeb(valor)
    if (valor.trim()) {
      setArchivo(null)
      setPreview(null)
      setQuitar(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function quitarImagen() {
    setArchivo(null)
    setPreview(null)
    setUrlWeb('')
    setQuitar(!!producto?.imagenUrl)   // solo hace falta avisar al servidor si ya había una imagen guardada
    if (inputRef.current) inputRef.current.value = ''
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')

    if (!f.codigoBarras.toString().trim()) return setError('Ingresa el código de barras.')
    if (!f.nombre.trim()) return setError('Ingresa el nombre del producto.')
    if (f.idCategoria === '') return setError('Elige una categoría.')
    if (f.precioCompra === '' || f.precioVenta === '') return setError('Ingresa el precio de compra y el de venta.')

    if (urlWeb.trim() && !urlWebOk) return setError('La URL de la imagen debe empezar por http:// o https://')

    const fd = new FormData()
    fd.append('codigoBarras', f.codigoBarras.toString().trim())
    fd.append('nombre', f.nombre.trim())
    fd.append('idCategoria', String(f.idCategoria))
    fd.append('precioCompra', String(f.precioCompra))
    fd.append('precioVenta', String(f.precioVenta))
    fd.append('stockActual', String(f.stockActual === '' ? 0 : f.stockActual))
    fd.append('stockMinimo', String(f.stockMinimo === '' ? 0 : f.stockMinimo))
    fd.append('unidadMedida', f.unidadMedida)
    if (String(f.origen).trim()) fd.append('origen', String(f.origen).trim())
    if (f.calorias !== '') fd.append('calorias', String(f.calorias))
    if (archivo) fd.append('imagen', archivo)
    else if (urlWebOk) fd.append('imagenWeb', urlWeb.trim())
    if (quitar) fd.append('quitarImagen', 'true')

    setGuardando(true)
    try {
      const r = await api(editando ? `/admin/productos/${producto.idProducto}` : '/admin/productos', {
        method: editando ? 'PUT' : 'POST',
        body: fd,
      })
      onGuardado(r, editando)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // Ayudas visuales (no bloquean el guardado)
  const hayPrecios = f.precioCompra !== '' && f.precioVenta !== ''
  const compra = Number(f.precioCompra)
  const venta = Number(f.precioVenta)
  const ganancia = round2(venta - compra)
  const porcentaje = venta > 0 ? Math.round((ganancia / venta) * 100) : 0
  const stockCambia = editando && f.stockActual !== '' && Number(f.stockActual) !== producto.stockActual

  const categoriasOpc =
    !editando || categorias.some((c) => c.idCategoria === producto.idCategoria)
      ? categorias
      : [{ idCategoria: producto.idCategoria, nombre: producto.categoria }, ...categorias]
  const unidadesOpc = UNIDADES.includes(f.unidadMedida) ? UNIDADES : [f.unidadMedida, ...UNIDADES]

  return (
    // stopPropagation: este formulario se dibuja dentro del panel de administración, cuyo fondo cierra el panel al hacer clic.
    // Sin esto, cualquier clic dentro del formulario "subía" hasta ese fondo y cerraba todo.
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={(e) => e.stopPropagation()}>
      <form
        onSubmit={guardar}
        role="dialog"
        aria-modal="true"
        aria-label={editando ? 'Editar producto' : 'Nuevo producto'}
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-stone-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-extrabold text-stone-900">{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
            <p className="text-sm text-stone-500">
              {editando ? producto.nombre : 'Completa los datos y sube una imagen (opcional).'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-stone-500 hover:text-stone-800">
            <X size={20} />
          </button>
        </div>

        <div className="scroll-thin grid flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[220px_1fr]">
          {/* ---------- Imagen ---------- */}
          <div>
            <span className="text-sm font-semibold text-stone-700">Imagen</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]) }}
              className={`mt-1 grid h-48 w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed p-2 transition ${
                arrastrando ? 'border-brand-600 bg-brand-50' : 'border-stone-200 bg-stone-50 hover:border-brand-300'
              }`}
            >
              {imagenMostrada && !imgRota ? (
                <img
                  src={imagenMostrada}
                  alt="Vista previa"
                  referrerPolicy="no-referrer"
                  onError={() => setImgRota(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="flex flex-col items-center gap-2 px-3 text-center text-xs text-stone-500">
                  <ImagePlus size={30} className="text-brand-600" />
                  <span className="font-semibold text-stone-700">
                    {imagenMostrada
                      ? (urlWebOk && !preview ? 'No se pudo previsualizar; al guardar el servidor intentará descargarla' : 'No se pudo mostrar la imagen')
                      : 'Haz clic o arrastra una imagen'}
                  </span>
                  JPG, PNG o WEBP · máx. {MAX_MB} MB
                </span>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => elegir(e.target.files?.[0])}
            />
            {imagenMostrada && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex-1 rounded-xl border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={quitarImagen}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-200 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} /> Quitar
                </button>
              </div>
            )}
            {archivo && <p className="mt-2 truncate text-xs text-stone-500">{archivo.name}</p>}

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-stone-700">o pega la URL de una imagen de la web</span>
              <input
                type="url"
                value={urlWeb}
                onChange={(e) => cambiarUrl(e.target.value)}
                placeholder="https://sitio.com/foto.jpg"
                className={`${campo} mt-1`}
              />
            </label>
            {urlWebOk && !archivo && (
              <p className="mt-1 text-xs text-stone-500">
                Al guardar, el servidor descargará la imagen y la guardará en el sistema. Debe ser un enlace directo a un JPG, PNG o WEBP.
              </p>
            )}
          </div>

          {/* ---------- Datos ---------- */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nombre" className="sm:col-span-2">
              <input autoFocus value={f.nombre} onChange={set('nombre')} maxLength={100} className={campo} />
            </Campo>

            <Campo label="Código de barras">
              <input value={f.codigoBarras} onChange={set('codigoBarras')} maxLength={30} inputMode="numeric" className={`${campo} font-mono`} />
            </Campo>

            <Campo label="Categoría">
              <select value={f.idCategoria} onChange={set('idCategoria')} className={campo}>
                {categoriasOpc.map((c) => (
                  <option key={c.idCategoria} value={c.idCategoria}>{c.nombre}</option>
                ))}
              </select>
            </Campo>

            <Campo label="Precio de compra">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={f.precioCompra} onChange={set('precioCompra')} className={campo} />
            </Campo>

            <Campo label="Precio de venta">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={f.precioVenta} onChange={set('precioVenta')} className={campo} />
            </Campo>

            {hayPrecios && (
              <p
                className={`rounded-xl px-3 py-2 text-xs sm:col-span-2 ${
                  venta < compra ? 'bg-amber-50 text-amber-800' : 'bg-brand-50 text-brand-800'
                }`}
              >
                {venta < compra
                  ? 'El precio de venta es menor que el de compra: se vendería con pérdida.'
                  : `Ganancia por ${f.unidadMedida}: ${money(ganancia)} (${porcentaje}% del precio de venta).`}
              </p>
            )}

            <Campo label="Unidad de medida" ayuda="Los productos por kg se venden de a 0.5.">
              <select value={f.unidadMedida} onChange={set('unidadMedida')} className={campo}>
                {unidadesOpc.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Campo>

            <Campo label="Origen (opcional)">
              <input value={f.origen} onChange={set('origen')} maxLength={60} className={campo} />
            </Campo>

            <Campo label="Stock actual">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={f.stockActual} onChange={set('stockActual')} className={campo} />
            </Campo>

            <Campo label="Stock mínimo" ayuda="Avisa en caja cuando quede poco.">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={f.stockMinimo} onChange={set('stockMinimo')} className={campo} />
            </Campo>

            {stockCambia && (
              <p className="rounded-xl bg-accent-50 px-3 py-2 text-xs text-accent-800 sm:col-span-2">
                El stock pasará de {fmtQty(producto.stockActual)} a {fmtQty(f.stockActual)}; se registrará como ajuste de inventario.
              </p>
            )}

            <Campo label="Calorías por 100 g (opcional)">
              <input type="number" min="0" step="1" inputMode="numeric" value={f.calorias} onChange={set('calorias')} className={campo} />
            </Campo>
          </div>
        </div>

        <div className="space-y-3 border-t border-stone-100 bg-stone-50 px-6 py-4">
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 font-semibold text-stone-700 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              disabled={guardando}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700 disabled:opacity-60 disabled:shadow-none"
            >
              {guardando && <Loader2 className="animate-spin" size={18} />}
              {editando ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
