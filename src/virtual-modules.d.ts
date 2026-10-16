/** File names found in public/audio at dev/build time (see vite.config.ts → audioFiles). */
declare module 'virtual:audio-files' {
  const files: string[]
  export default files
}
