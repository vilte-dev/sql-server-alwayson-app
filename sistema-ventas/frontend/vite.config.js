import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // /api y las imágenes subidas (/uploads) se reenvían al backend (puerto 5080)
    proxy: {
      '/api': 'http://localhost:5080',
      '/uploads': 'http://localhost:5080',
    },
  },
})
