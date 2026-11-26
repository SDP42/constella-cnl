import { maplibregl } from '@/lib/maplibre'
import type { GeoJSONSource, MLMap } from '@/lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMutation } from '@tanstack/react-query'
import { Box, Building2, Globe2, Layers, Loader2, Moon, Mountain, Radar, Satellite, ScanSearch } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { inr, pct, titleCase } from '@/lib/format'
import { BASEMAPS, type BasemapKey, circle, LABELS_TILES, overpassPois, POI_COLORS } from '@/lib/geoLayers'
import { Bar, Card, Loading, Page, Reasoning, Stat, useApi } from '../kit'
import { DIV_COLORS_MAP } from '../theme'

const SHARE_RAMP: any = ['interpolate', ['linear'], ['get', 'share'], 0, '#C2553D', 0.1, '#F5B700', 0.25, '#9CC17A', 0.4, '#3F7D5C']
const ICONS: Record<BasemapKey, any> = { satellite: Satellite, night: Moon, terrain: Mountain }

export default function Territory() {
  const d = useApi<any>(['geo-territory'], '/api/geo/territory')
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap | null>(null)
  const [ready, setReady] = useState(false)
  const [base, setBase] = useState<BasemapKey>('satellite')
  const [show, setShow] = useState({ columns: true, partners: true, catchments: false, labels: true, terrain: false })
  const [globe, setGlobe] = useState(true)
  const [sel, setSel] = useState<any>(null)
  const [radius, setRadius] = useState(3000)
  const x = d.data

  const demand = useMutation({
    mutationFn: async (p: any) => {
      let pois: any[] = []
      let source = 'openstreetmap'
      try {
        const ctl = new AbortController()
        const t = setTimeout(() => ctl.abort(), 25000)
        pois = await overpassPois(p.lat, p.lng, radius, ctl.signal)
        clearTimeout(t)
      } catch {
        source = 'synthetic'
      }
      return api<any>('/api/geo/demand', { method: 'POST', json: { lat: p.lat, lng: p.lng, radius, source, pois } })
    },
  })

  const maxLeak = useMemo(() => Math.max(1, ...(x?.cities ?? []).map((c: any) => c.leakage)), [x])

  // ---- init map once
  useEffect(() => {
    if (!box.current || map.current) return
    const sources: Record<string, any> = {}
    const layers: any[] = [{ id: 'bg', type: 'background', paint: { 'background-color': '#0C0A09' } }]
    for (const [k, b] of Object.entries(BASEMAPS)) {
      sources[`base-${k}`] = { type: 'raster', tiles: b.tiles, tileSize: 256, maxzoom: b.maxzoom, attribution: b.attribution }
      layers.push({ id: `base-${k}`, type: 'raster', source: `base-${k}`, layout: { visibility: k === 'satellite' ? 'visible' : 'none' },
        paint: { 'raster-fade-duration': 250, ...(k === 'satellite' ? { 'raster-saturation': -0.1, 'raster-contrast': 0.08 } : {}) } })
    }
    sources.labels = { type: 'raster', tiles: LABELS_TILES, tileSize: 256, maxzoom: 15, attribution: 'Labels © OpenStreetMap contributors, EOX' }
    sources.dem = { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], tileSize: 256, encoding: 'terrarium', maxzoom: 13,
      attribution: 'Terrain tiles: Mapzen / AWS Open Data' }
    layers.push({ id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.9 } })
    const m = new maplibregl.Map({
      container: box.current, center: [79, 21.5], zoom: 1.6, pitch: 0, bearing: 0, maxPitch: 80,
      style: { version: 8, sources, layers, sky: { 'sky-color': '#0b1220', 'horizon-color': '#26324a', 'fog-color': '#0C0A09', 'atmosphere-blend': 0.8 } } as any,
      attributionControl: false,
    })
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    m.on('style.load', () => { try { (m as any).setProjection({ type: 'globe' }) } catch { /* older GL */ } })
    m.on('load', () => {
      const empty = { type: 'FeatureCollection', features: [] } as any
      for (const id of ['cities', 'partners', 'catch', 'pois', 'scan']) m.addSource(id, { type: 'geojson', data: empty })
      m.addLayer({ id: 'catch-line', type: 'line', source: 'catch', layout: { visibility: 'none' }, paint: { 'line-color': '#F5B700', 'line-width': 1.2, 'line-dasharray': [2, 2], 'line-opacity': 0.7 } })
      m.addLayer({ id: 'scan-fill', type: 'fill', source: 'scan', paint: { 'fill-color': '#F5B700', 'fill-opacity': 0.08 } })
      m.addLayer({ id: 'scan-line', type: 'line', source: 'scan', paint: { 'line-color': '#F5B700', 'line-width': 2 } })
      m.addLayer({ id: 'columns', type: 'fill-extrusion', source: 'cities', maxzoom: 7.5, paint: {
        'fill-extrusion-color': SHARE_RAMP, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.88 } })
      m.addLayer({ id: 'partners', type: 'circle', source: 'partners', paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['interpolate', ['linear'], ['get', 'w'], 0, 1.5, 1, 4], 10, ['interpolate', ['linear'], ['get', 'w'], 0, 5, 1, 14]],
        'circle-color': SHARE_RAMP, 'circle-stroke-color': '#fff', 'circle-stroke-width': ['case', ['==', ['get', 'id'], -1], 3, 0.8], 'circle-opacity': 0.92 } })
      m.addLayer({ id: 'pois', type: 'circle', source: 'pois', paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 7], 'circle-color': ['match', ['get', 'kind'], ...Object.entries(POI_COLORS).flat(), '#999'] as any,
        'circle-stroke-color': '#0C0A09', 'circle-stroke-width': 1 } })
      m.on('click', 'partners', (e: any) => { const f = e.features?.[0]; if (f) setSel((f.properties as any).id) })
      m.on('mouseenter', 'partners', () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', 'partners', () => { m.getCanvas().style.cursor = '' })
      const pop = new maplibregl.Popup({ closeButton: false, offset: 8, className: 'poi-pop' })
      m.on('mousemove', 'pois', (e: any) => { const p: any = e.features?.[0]?.properties; if (p) pop.setLngLat(e.lngLat).setHTML(`<b>${p.name ?? titleCase(p.kind)}</b><br/>${titleCase(p.kind)}`).addTo(m) })
      m.on('mouseleave', 'pois', () => pop.remove())
      setReady(true)
      m.flyTo({ center: [80, 21.5], zoom: 4.1, pitch: 48, bearing: -12, duration: 4200, essential: true })
    })
    map.current = m
    return () => { m.remove(); map.current = null }
  }, [])

  // ---- data -> sources
  useEffect(() => {
    const m = map.current
    if (!ready || !m || !x) return
    const maxW = Math.max(...x.partners.map((p: any) => p.wallet))
    ;(m.getSource('cities') as GeoJSONSource).setData({ type: 'FeatureCollection', features: x.cities.map((c: any) => ({
      type: 'Feature', properties: { ...c, h: 20000 + (c.leakage / maxLeak) * 420000 }, geometry: { type: 'Polygon', coordinates: [circle(c.lng, c.lat, 24, 6)] } })) } as any)
    ;(m.getSource('partners') as GeoJSONSource).setData({ type: 'FeatureCollection', features: x.partners.map((p: any) => ({
      type: 'Feature', properties: { id: p.id, share: p.share, w: Math.sqrt(p.wallet / maxW) }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) } as any)
    ;(m.getSource('catch') as GeoJSONSource).setData({ type: 'FeatureCollection', features: x.branches.map((b: any) => ({
      type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: circle(b.lng, b.lat, 120) } })) } as any)
  }, [ready, x, maxLeak])

  // ---- toggles
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    for (const k of Object.keys(BASEMAPS)) m.setLayoutProperty(`base-${k}`, 'visibility', k === base ? 'visible' : 'none')
    m.setLayoutProperty('labels', 'visibility', show.labels ? 'visible' : 'none')
    m.setLayoutProperty('columns', 'visibility', show.columns ? 'visible' : 'none')
    m.setLayoutProperty('partners', 'visibility', show.partners ? 'visible' : 'none')
    m.setLayoutProperty('catch-line', 'visibility', show.catchments ? 'visible' : 'none')
    try { m.setTerrain(show.terrain ? { source: 'dem', exaggeration: 1.6 } : null) } catch { /* ignore */ }
    try { (m as any).setProjection({ type: globe ? 'globe' : 'mercator' }) } catch { /* ignore */ }
  }, [ready, base, show, globe])

  const partner = useMemo(() => x?.partners.find((p: any) => p.id === sel), [x, sel])
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    m.setPaintProperty('partners', 'circle-stroke-width', ['case', ['==', ['get', 'id'], sel ?? -1], 3, 0.8])
    if (partner) {
      m.flyTo({ center: [partner.lng, partner.lat], zoom: 12.4, pitch: 55, bearing: 20, duration: 2600 })
      ;(m.getSource('scan') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(partner.lng, partner.lat, radius / 1000)] } } as any)
      ;(m.getSource('pois') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [] } as any)
      demand.reset()
    }
  }, [sel, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!ready || !m || !demand.data) return
    ;(m.getSource('pois') as GeoJSONSource).setData({ type: 'FeatureCollection', features: demand.data.pois.map((p: any) => ({
      type: 'Feature', properties: { kind: p.kind, name: p.name }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) } as any)
  }, [demand.data, ready])

  const flyCity = (c: any) => map.current?.flyTo({ center: [c.lng, c.lat], zoom: 9.5, pitch: 55, bearing: 0, duration: 2400 })
  const overview = () => { setSel(null); map.current?.flyTo({ center: [80, 21.5], zoom: 4.1, pitch: 48, bearing: -12, duration: 2400 }) }

  return (
    <Page kicker="Digital twin · territory · open satellite & OSM data" title="Territory twin"
      actions={<button onClick={overview} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm"><Globe2 className="size-4" />India overview</button>}>
      {x ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Partners on the map" value={x.totals.partners} sub={`${x.cities.length} hub cities · ${x.branches.length} branches`} icon={<Building2 className="size-4" />} />
          <Stat label="Wallet (12 m)" value={inr(x.totals.wallet)} sub="estimated tech spend of the network" tone="#3E5C76" />
          <Stat label="CNL share" value={pct(x.totals.spend / x.totals.wallet, 1)} sub={inr(x.totals.spend)} tone="#3F7D5C" />
          <Stat label="Leakage" value={inr(x.totals.leakage)} sub="wallet bought elsewhere — column height" tone="#C2553D" />
        </div>
      ) : <Loading rows={1} />}

      <div className="relative h-[72vh] min-h-[520px] overflow-hidden rounded-[26px] bg-night shadow-[0_40px_80px_-40px_rgba(12,10,9,.6)]">
        <div ref={box} style={{ position: "absolute", inset: 0 }} />

        {/* left console */}
        <div className="absolute left-4 top-4 z-10 w-60 space-y-3">
          <div className="rounded-2xl bg-night/75 p-2 text-white backdrop-blur-md">
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(BASEMAPS) as BasemapKey[]).map((k) => {
                const I = ICONS[k]
                return <button key={k} onClick={() => setBase(k)} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] transition ${base === k ? 'bg-white text-ink' : 'hover:bg-white/10'}`}><I className="size-4" />{BASEMAPS[k].label}</button>
              })}
            </div>
          </div>
          <div className="space-y-1 rounded-2xl bg-night/75 p-3 text-[12px] text-white backdrop-blur-md">
            <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/50"><Layers className="size-3" />Layers</p>
            {([['columns', '3D leakage columns'], ['partners', 'Partners (colour = share)'], ['catchments', 'Branch catchments 120 km'], ['labels', 'Place labels'], ['terrain', '3D terrain (DEM)']] as const).map(([k, l]) => (
              <label key={k} className="flex cursor-pointer items-center justify-between gap-2 py-0.5">
                <span>{l}</span>
                <input type="checkbox" checked={show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} className="accent-[#F5B700]" />
              </label>
            ))}
            <label className="flex cursor-pointer items-center justify-between gap-2 py-0.5"><span>Globe projection</span><input type="checkbox" checked={globe} onChange={(e) => setGlobe(e.target.checked)} className="accent-[#F5B700]" /></label>
          </div>
          {x && (
            <div className="max-h-44 overflow-y-auto rounded-2xl bg-night/75 p-3 text-white backdrop-blur-md">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/50">Fly to · by leakage</p>
              {x.cities.slice(0, 10).map((c: any) => (
                <button key={c.city} onClick={() => flyCity(c)} className="flex w-full items-center justify-between rounded-lg px-1.5 py-1 text-left text-[12px] hover:bg-white/10">
                  <span>{c.city}</span><span className="num text-white/60">{inr(c.leakage, 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* legend */}
        <div className="absolute bottom-4 right-16 z-10 hidden rounded-full md:block bg-night/75 px-4 py-2 text-[11px] text-white backdrop-blur-md">
          <span className="mr-2 text-white/60">CNL share of wallet</span>
          <span className="inline-block h-2 w-40 rounded-full align-middle" style={{ background: 'linear-gradient(90deg,#C2553D,#F5B700 25%,#9CC17A 62%,#3F7D5C)' }} />
          <span className="ml-2 text-white/60">0% → 40%+</span>
        </div>

        {/* right panel */}
        {partner && (
          <div className="absolute right-4 top-4 z-10 max-h-[calc(100%-2rem)] w-80 overflow-y-auto rounded-2xl bg-white/95 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="label">{titleCase(partner.type)} · {partner.vertical}</p><h3 className="truncate text-lg font-semibold">{partner.name}</h3><p className="text-xs text-ink-soft">{partner.city} · {partner.region} · {partner.tier}</p></div>
              <button onClick={overview} aria-label="Close" className="rounded-full bg-ink/5 px-2 text-sm">×</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[['Wallet', partner.wallet], ['CNL', partner.spend], ['Leakage', partner.leakage]].map(([l, v]) => <div key={l} className="rounded-xl bg-pearl p-2"><p className="text-[10px] text-ink-soft">{l}</p><p className="num text-sm font-semibold">{inr(v as number, 0)}</p></div>)}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs"><span className="w-16 text-ink-soft">Share</span><Bar value={partner.share} max={0.5} color="#A16207" /><span className="num">{pct(partner.share, 1)}</span></div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">Buys from: {partner.divisions.length ? partner.divisions.map((dv: string) => <span key={dv} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ background: DIV_COLORS_MAP[dv] }}>{dv}</span>) : '—'}</div>
            {partner.top_opp && <Link to={`/app/inbox?opp=${partner.top_opp.id}`} className="mt-3 block rounded-xl border border-gold/30 bg-gold/5 p-2.5 text-xs"><span className="label">Top open opportunity</span><div className="mt-0.5 font-medium text-ink">{partner.top_opp.title}</div><div className="num text-gold">{inr(partner.top_opp.value)}</div></Link>}

            <div className="mt-3 rounded-xl bg-night p-3 text-white">
              <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><Radar className="size-3.5 text-gold-bright" />Demand scan radius</span><span className="num">{(radius / 1000).toFixed(1)} km</span></div>
              <input type="range" min={1000} max={6000} step={500} value={radius} onChange={(e) => setRadius(+e.target.value)} className="mt-2 w-full accent-[#F5B700]" aria-label="Scan radius" />
              <button onClick={() => { const m = map.current; (m?.getSource('scan') as GeoJSONSource)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(partner.lng, partner.lat, radius / 1000)] } } as any); demand.mutate(partner) }}
                disabled={demand.isPending} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gold-bright py-2 text-sm font-semibold text-ink">
                {demand.isPending ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />} Scan schools & hospitals (OSM)
              </button>
            </div>
            {demand.data && (
              <div className="mt-3">
                <div className="flex items-baseline justify-between"><p className="label">Addressable in 24 months</p><span className="num text-xl font-semibold">{inr(demand.data.addressable_24m)}</span></div>
                <p className="text-[10px] text-ink-soft">{demand.data.pois.length} sites · {demand.data.attribution}</p>
                <ul className="mt-2 space-y-1.5">
                  {demand.data.plays.map((pl: any) => (
                    <li key={pl.kind} className="rounded-lg bg-pearl px-2.5 py-1.5 text-xs">
                      <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: POI_COLORS[pl.kind] }} /><b className="capitalize">{pl.count} {pl.kind}s</b> → {pl.solution}</span><span className="num">{inr(pl.addressable, 0)}</span></div>
                      <div className="text-[10px] text-ink-soft">{pl.why}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to={`/app/site/${partner.id}`} className="flex items-center justify-center gap-1.5 rounded-full bg-ink py-2 text-xs font-medium text-white"><Box className="size-3.5" />Site twin (3D)</Link>
              <Link to={`/app/accounts/${partner.id}`} className="flex items-center justify-center gap-1.5 rounded-full bg-ink/5 py-2 text-xs font-medium">Account twin</Link>
            </div>
          </div>
        )}
        {!partner && ready && <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-full bg-night/75 px-3 py-1.5 text-[11px] text-white backdrop-blur-md">Click any partner dot to inspect it and scan local demand</div>}
      </div>

      {x && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card title="Where to recruit partners next" sub="Expansion score = 60% leakage + 25% low share + 15% thin partner density" pad={false}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft"><th className="px-5 py-2">City</th><th className="text-right">Partners</th><th className="text-right">Share</th><th className="text-right">Leakage</th><th className="text-right">Single-division</th><th className="w-36 px-5">Score</th></tr></thead>
              <tbody>
                {[...x.cities].sort((a: any, b: any) => b.expansion_score - a.expansion_score).slice(0, 10).map((c: any) => (
                  <tr key={c.city} onClick={() => flyCity(c)} className="cursor-pointer border-t border-ink/5 hover:bg-ink/[0.02]">
                    <td className="px-5 py-2 font-medium">{c.city} <span className="text-xs text-ink-soft">{c.region}</span></td>
                    <td className="num text-right">{c.partners}</td><td className="num text-right">{pct(c.share, 1)}</td><td className="num text-right">{inr(c.leakage)}</td>
                    <td className="num text-right">{c.single_division}</td>
                    <td className="px-5"><Bar value={c.expansion_score} max={1} color="#A16207" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="How the territory twin works">
            <ul className="space-y-2 text-sm text-ink-soft">
              <li><b className="text-ink">Real imagery:</b> Sentinel-2 cloudless (10 m) from EOX, NASA VIIRS Black Marble night lights from GIBS, and an AWS Terrarium DEM for 3D relief. All are open and attributed on the map.</li>
              <li><b className="text-ink">Columns:</b> one per hub city. Height is wallet leakage (what partners buy from other distributors) and colour is CNL's share.</li>
              <li><b className="text-ink">Demand scan:</b> your browser asks OpenStreetMap for schools, colleges, hospitals and civic buildings around a partner. The backend turns the counts into rupees per solution.</li>
            </ul>
            <Reasoning how="Leakage = Σ partner wallet − CNL 12-month billing. Wallet = employees × vertical tech-spend benchmark. Addressable demand = POIs × typical deal × 24-month attach rate." why="A rep sees not just who to call but where the market sits: a Pune SI with 40 schools within 3 km and no Smart Classroom sale is a mapped, quantified pitch." source="docs/DATA_SOURCES.md" />
          </Card>
        </div>
      )}
    </Page>
  )
}
