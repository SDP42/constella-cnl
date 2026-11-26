import { maplibregl } from '@/lib/maplibre'
import type { MLMap } from '@/lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Car, Clock, MapPin, Route } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { inr, pct } from '@/lib/format'
import { BASEMAPS, LABELS_TILES } from '@/lib/geoLayers'
import { Card, Loading, Page, Reasoning, Stat, useApi } from '../kit'

export default function BeatPlan() {
  const d = useApi<any>(['beat'], '/api/work/beat', { staleTime: 300_000, refetchOnWindowFocus: false } as any)
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap | null>(null)
  const x = d.data

  useEffect(() => {
    if (!box.current || !x?.stops?.length || map.current) return
    const m = new maplibregl.Map({
      container: box.current, center: [x.branch.lng, x.branch.lat], zoom: 10.5, pitch: 45, bearing: -10, attributionControl: false,
      style: { version: 8, sources: {
        sat: { type: 'raster', tiles: [...BASEMAPS.satellite.tiles], tileSize: 256, maxzoom: 15, attribution: BASEMAPS.satellite.attribution },
        lab: { type: 'raster', tiles: LABELS_TILES, tileSize: 256, maxzoom: 15 },
      }, layers: [{ id: 'sat', type: 'raster', source: 'sat' }, { id: 'lab', type: 'raster', source: 'lab' }] } as any,
    })
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    m.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    m.on('load', () => {
      const line = [[x.branch.lng, x.branch.lat], ...x.stops.map((s: any) => [s.lng, s.lat])]
      m.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } } as any })
      m.addLayer({ id: 'route-glow', type: 'line', source: 'route', paint: { 'line-color': '#F5B700', 'line-width': 10, 'line-opacity': 0.25, 'line-blur': 4 } })
      m.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#F5B700', 'line-width': 3, 'line-dasharray': [2, 1.2] } })
      const mk = (html: string, ll: [number, number]) => { const el = document.createElement('div'); el.innerHTML = html; new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(m) }
      mk('<div style="background:#0C0A09;color:#fff;border-radius:999px;padding:4px 10px;font:600 11px DM Sans;box-shadow:0 4px 14px #0006">CNL branch</div>', [x.branch.lng, x.branch.lat])
      x.stops.forEach((s: any) => mk(`<div style="width:28px;height:28px;border-radius:999px;background:#F5B700;color:#1C1917;display:grid;place-items:center;font:700 12px DM Sans;border:2px solid #fff;box-shadow:0 4px 14px #0006">${s.seq}</div>`, [s.lng, s.lat]))
      const b = new maplibregl.LngLatBounds()
      line.forEach((c: any) => b.extend(c))
      m.fitBounds(b, { padding: 70, pitch: 45, duration: 2200 })
    })
    map.current = m
    return () => { m.remove(); map.current = null }
  }, [!!x?.stops?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!x) return <Page title="Beat plan"><Loading rows={6} /></Page>
  if (!x.stops?.length) return <Page kicker={`Work · field day · ${x.rep?.name ?? ''}`} title="Today's beat plan"><Card title="No field visits today"><p className="text-sm text-ink-soft">{x.note ?? 'There are no open opportunities to visit for this seat today.'}</p></Card></Page>
  const sm = x.summary
  return (
    <Page kicker={`Work · field day · ${x.rep.name} · ${x.city}`} title="Today's beat plan">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Visits" value={sm.visits} sub={`finish by ${sm.finish}`} icon={<MapPin className="size-4" />} />
        <Stat label="Pipeline on the road" value={inr(sm.pipeline)} sub="value-at-stake of stops" tone="#A16207" />
        <Stat label="Drive" value={`${sm.km} km`} sub="road-adjusted" icon={<Car className="size-4" />} />
        <Stat label="Saved by routing" value={`${sm.km_saved_vs_list_order} km`} sub="vs visiting in list order" tone="#3F7D5C" icon={<Route className="size-4" />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="relative h-[62vh] min-h-[440px] overflow-hidden rounded-[26px] bg-night"><div ref={box} style={{ position: 'absolute', inset: 0 }} /></div>
        <Card title="Itinerary" sub="Ordered by a nearest-neighbour + 2-opt route from the branch" pad={false}>
          <ol className="relative">
            {x.stops.map((s: any) => (
              <li key={s.seq} className="relative flex gap-3 border-t border-ink/5 px-5 py-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold-bright text-xs font-bold">{s.seq}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><b className="truncate">{s.name}</b><span className="flex items-center gap-1 font-mono text-xs text-ink-soft"><Clock className="size-3" />{s.arrive}</span></div>
                  <Link to={`/app/inbox?opp=${s.opp_id}`} className="block truncate text-xs text-gold hover:underline">{s.opportunity}</Link>
                  <p className="text-[11px] text-ink-soft">{inr(s.value)} · p {pct(s.probability)} · {s.drive_km} km drive</p>
                  <p className="mt-1 text-[11px] italic text-ink-soft">{s.talk_track}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="px-5 pb-4"><Reasoning how={x.how} why="Field reps lose hours to unplanned driving. A value-ranked, routed day means more pipeline touched per rep, which is how CNL grows without adding headcount." /></div>
        </Card>
      </div>
    </Page>
  )
}
