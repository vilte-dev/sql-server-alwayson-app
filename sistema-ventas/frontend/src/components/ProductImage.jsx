import { useEffect, useState } from 'react'

/** Muestra la imagen del producto; si no existe, un recuadro con la inicial. */
import { imgSrc } from '../lib/utils'

export default function ProductImage({ producto, className = '' }) {
  const [fallo, setFallo] = useState(!producto.imagenUrl)
  useEffect(() => { setFallo(!producto.imagenUrl) }, [producto.imagenUrl])

  if (fallo) {
    return (
      <div className={`grid place-items-center bg-brand-50 font-black text-brand-700 ${className.includes('text-') ? '' : 'text-5xl'} ${className}`}>
        {producto.nombre.charAt(0)}
      </div>
    )
  }
  return (
    <img
      src={imgSrc(producto.imagenUrl)}
      alt={producto.nombre}
      onError={() => setFallo(true)}
      className={`object-contain ${className}`}
    />
  )
}
