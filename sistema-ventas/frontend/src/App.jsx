import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api, getToken, setToken } from './lib/api'
import Login from './pages/Login'
import Caja from './pages/Caja'

export default function App() {
  const [user, setUser] = useState(null)
  const [cargando, setCargando] = useState(!!getToken())

  // Si hay un token guardado, comprueba que siga siendo válido
  useEffect(() => {
    if (!getToken()) return
    api('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    const salir = () => setUser(null)
    window.addEventListener('caja:unauthorized', salir)
    return () => window.removeEventListener('caja:unauthorized', salir)
  }, [])

  if (cargando) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={(token, u) => { setToken(token); setUser(u) }} />
  }

  return <Caja user={user} onLogout={() => { setToken(null); setUser(null) }} />
}
