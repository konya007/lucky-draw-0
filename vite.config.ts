import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages project sites live at https://<owner>.github.io/<repo>/, so the deploy
  // workflow passes VITE_BASE_PATH=/<repo>/. Local dev/build keeps the root.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          physics: ['@react-three/rapier'],
          fx: ['postprocessing', '@react-three/postprocessing'],
        },
      },
    },
  },
})
