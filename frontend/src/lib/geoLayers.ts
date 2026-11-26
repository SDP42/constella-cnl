/** Free, open imagery used by the territory twin and the landing globe — see docs/DATA_SOURCES.md. */
export const BASEMAPS = {
  satellite: {
    label: 'Satellite',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg'],
    maxzoom: 15,
    attribution: 'Sentinel-2 cloudless – s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2023)',
  },
  night: {
    label: 'Night lights',
    tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png'],
    maxzoom: 8,
    attribution: 'NASA GIBS · VIIRS Black Marble',
  },
  terrain: {
    label: 'Terrain',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg'],
    maxzoom: 15,
    attribution: 'Terrain Light { Data © OpenStreetMap contributors and others, Rendering © EOX }',
  },
} as const
export type BasemapKey = keyof typeof BASEMAPS

export const LABELS_TILES = ['https://tiles.maps.eox.at/wmts/1.0.0/overlay_bright_3857/default/g/{z}/{y}/{x}.png']

/** Equirectangular whole-earth images from NASA GIBS WMS (CORS-enabled) for the 3D globe. */
export const GIBS_GLOBE = {
  day: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg',
  night: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=VIIRS_Black_Marble&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg&TIME=2016-01-01',
}

export const POI_COLORS: Record<string, string> = {
  school: '#F5B700', college: '#6B4E71', university: '#3E5C76', hospital: '#C2553D', clinic: '#E28B6D', townhall: '#3F7D5C',
}

/** Overpass from the browser (the public endpoint serves browser tools, not servers). Only a radius + centre is sent. */
export async function overpassPois(lat: number, lng: number, radius: number, signal?: AbortSignal) {
  const q = `[out:json][timeout:20];(nwr["amenity"~"^(school|college|university|hospital|clinic|doctors|townhall)$"](around:${radius},${lat},${lng}););out center 800;`
  const key = `osm:${lat.toFixed(3)},${lng.toFixed(3)},${radius}`
  const hit = sessionStorage.getItem(key)
  if (hit) return JSON.parse(hit)
  // race the main instance against a public mirror; first valid answer wins
  const ask = async (url: string) => {
    const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), signal })
    if (!r.ok) throw new Error(`Overpass ${r.status}`)
    return r.json()
  }
  const j: any = await Promise.any(OVERPASS_MIRRORS.map(ask))
  const items = (j.elements as any[]).map((e) => ({
    id: `osm-${e.type[0]}${e.id}`, kind: e.tags?.amenity === 'doctors' ? 'clinic' : e.tags?.amenity, name: e.tags?.name ?? null,
    lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon,
  })).filter((p) => p.lat && p.lng)
  try { sessionStorage.setItem(key, JSON.stringify(items)) } catch { /* quota */ }
  return items
}

const OVERPASS_MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']

/** Circle polygon (approx.) for extrusions and catchment rings. */
export function circle(lng: number, lat: number, km: number, steps = 40): number[][] {
  const out: number[][] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    out.push([lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(t), lat + (km / 110.57) * Math.sin(t)])
  }
  return out
}
