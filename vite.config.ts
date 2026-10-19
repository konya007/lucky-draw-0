import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `virtual:audio-files`: the list of sound files sitting in public/audio, read at dev/build time.
 * Lets the game use `hitBall.mp3`, `music.mp3`… just by dropping them in the folder (no manifest
 * edit, and no 404 probing for files that are not there). Adding/removing files reloads the page.
 */
function audioFiles(): Plugin {
  const dir = resolve(__dirname, 'public/audio')
  const id = 'virtual:audio-files'
  const resolved = '\0' + id
  const list = () => {
    try {
      return readdirSync(dir).filter((f) => /\.(mp3|ogg|wav|m4a|aac|webm|flac)$/i.test(f))
    } catch {
      return []
    }
  }
  return {
    name: 'audio-files',
    resolveId: (s) => (s === id ? resolved : null),
    load: (s) => (s === resolved ? `export default ${JSON.stringify(list())}` : null),
    configureServer(server) {
      server.watcher.add(dir)
      const changed = (f: string) => {
        if (!f.replace(/\\/g, '/').includes('public/audio')) return
        const mod = server.moduleGraph.getModuleById(resolved)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', changed)
      server.watcher.on('unlink', changed)
    },
  }
}

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string; author?: string | { name?: string } }
const author = typeof pkg.author === 'string' ? pkg.author.replace(/s*[<(].*$/, '') : (pkg.author?.name ?? '')

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_AUTHOR__: JSON.stringify(author),
  },
  // GitHub Pages project sites live at https://<owner>.github.io/<repo>/, so the deploy
  // workflow passes VITE_BASE_PATH=/<repo>/. Local dev/build keeps the root.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss(), audioFiles()],
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
