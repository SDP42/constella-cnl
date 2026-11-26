// MapLibre v6 loads its web worker from a URL next to its own module, which a bundled production build
// does not ship. Bundle the worker with Vite and register its URL explicitly (works in dev and on Vercel).
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(workerUrl)

export { maplibregl }
export type { GeoJSONSource, Map as MLMap } from 'maplibre-gl'
