/**
 * Resolve a `public/` asset against the deployed base path (`import.meta.env.BASE_URL`, always ends with `/`).
 * Needed because GitHub Pages project sites serve the app from `/<repo>/`, where a root-absolute
 * `/host.glb` would 404. Accepts a path with or without a leading slash.
 */
export function assetUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '')
}
