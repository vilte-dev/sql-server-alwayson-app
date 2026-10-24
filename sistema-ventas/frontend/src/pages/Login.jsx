import { useState } from 'react'
import { Loader2, Lock, User } from 'lucide-react'
import { api } from '../lib/api'
import Brand from '../components/Brand'

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const r = await api('/auth/login', { method: 'POST', body: { usuario, password } })
      onLogin(r.token, r.usuario)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="h-full grid place-items-center bg-linear-to-br from-brand-900 via-brand-800 to-brand-700 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-6">
        <Brand />

        <div>
          <h1 className="text-xl font-extrabold text-stone-900">Inicia sesión</h1>
          <p className="text-sm text-stone-500">Ingresa con tu usuario del sistema para abrir la caja.</p>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-stone-700">Usuario</span>
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-stone-200 px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
            <User size={18} className="text-stone-500" />
            <input
              autoFocus
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              className="w-full py-2.5 outline-none bg-transparent"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-stone-700">Contraseña</span>
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-stone-200 px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
            <Lock size={18} className="text-stone-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full py-2.5 outline-none bg-transparent"
            />
          </div>
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2">{error}</p>
        )}

        <button
          disabled={enviando || !usuario || !password}
          className="w-full rounded-xl bg-brand-600 py-3 font-bold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
        >
          {enviando && <Loader2 className="animate-spin" size={18} />}
          Entrar a caja
        </button>
      </form>
    </div>
  )
}
