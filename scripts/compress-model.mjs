// Usage: npm run compress-model -- <pack-folder>   (e.g. foxy)
// Compresses src/assets/<pack>/source/source.glb → src/assets/<pack>/host.glb (meshopt + webp ≤ 2048).
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const pack = process.argv[2]
if (!pack) {
  console.error('Usage: npm run compress-model -- <pack-folder>')
  process.exit(1)
}
const src = `src/assets/${pack}/source/source.glb`
if (!existsSync(src)) {
  console.error(`Not found: ${src}`)
  process.exit(1)
}
execFileSync('npx', ['gltf-transform', 'optimize', src, `src/assets/${pack}/host.glb`, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '2048'], { stdio: 'inherit', shell: true })
