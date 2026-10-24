const TOKEN_KEY = 'caja_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Llama a la API.
 *  - timeoutMs:   si el servidor no responde en este tiempo se corta (antes podía quedarse colgado).
 *  - reintentos:  cuántas veces repetir ante un corte de red o un 503 (base de datos en failover).
 *                 Por defecto las lecturas (GET) reintentan 2 veces y las escrituras 0.
 *                 Solo se debe usar en escrituras que sean idempotentes (ej. la venta con su clave).
 *  - onReintento: callback (intento, total) para avisar en pantalla "reconectando...".
 * El Error lanzado trae .status (0 = sin respuesta, 503 = BD no disponible, 4xx = rechazo definitivo).
 */
export async function api(path, { method = 'GET', body, timeoutMs = 20000, reintentos, onReintento } = {}) {
  const maxReintentos = reintentos ?? (method === 'GET' ? 2 : 0)
  const total = 1 + maxReintentos
  const esForm = body instanceof FormData   // con FormData el navegador pone el Content-Type (y el boundary)

  for (let intento = 1; ; intento++) {
    const token = getToken()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    let res
    try {
      res = await fetch('/api' + path, {
        method,
        signal: ctrl.signal,
        headers: {
          ...(esForm ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? (esForm ? body : JSON.stringify(body)) : undefined,
      })
    } catch {
      clearTimeout(timer)
      if (intento < total) {
        onReintento?.(intento, total - 1)
        await esperar(intento * 3000)
        continue
      }
      const e = new Error('Sin respuesta del servidor. Si se está cambiando de servidor de base de datos, espera unos segundos y reintenta.')
      e.status = 0
      throw e
    }
    clearTimeout(timer)

    // Base de datos no disponible (failover): espera y reintenta
    if (res.status === 503 && intento < total) {
      onReintento?.(intento, total - 1)
      await esperar(intento * 3000)
      continue
    }

    // Sesión vencida: vuelve al login
    if (res.status === 401 && path !== '/auth/login') {
      setToken(null)
      window.dispatchEvent(new Event('caja:unauthorized'))
    }

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const e = new Error(data?.error || data?.title || `Error del servidor (${res.status})`)
      e.status = res.status
      throw e
    }
    return data
  }
}
