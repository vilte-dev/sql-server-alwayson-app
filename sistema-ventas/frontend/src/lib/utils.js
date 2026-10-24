export const money = (n) => '$' + Number(n || 0).toFixed(2)
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
export const fmtQty = (n) => String(Number(Number(n).toFixed(2)))

// Los productos por 'kg' se venden de a 0.5; el resto de a 1
export const stepOf = (p) => (p.unidadMedida?.toLowerCase() === 'kg' ? 0.5 : 1)

export const fmtFecha = (iso) =>
  new Date(iso).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })

// Para buscar sin importar mayúsculas ni tildes
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Las imágenes que sube el administrador se guardan como /uploads/productos/<archivo>.
// Se piden por /api/uploads/... porque /api siempre se reenvía al backend (proxy de Vite).
export const imgSrc = (url) => (url && url.startsWith('/uploads/') ? '/api' + url : url)

/** GUID para la clave de idempotencia (crypto.randomUUID solo existe en https/localhost; esto funciona también por http en la red). */
export function nuevoGuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
