export const inr = (v: number | null | undefined, digits = 1): string => {
  if (v == null || Number.isNaN(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(digits)} Cr`
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(digits)} L`
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(0)}K`
  return `₹${Math.round(v)}`
}
export const pct = (v: number | null | undefined, digits = 0) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`)
export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
export const ago = (iso: string, now: string | Date = new Date()) => {
  const d = (new Date(now).getTime() - new Date(iso).getTime()) / 1000
  if (d < 0) return `in ${Math.round(-d / 3600)}h`
  if (d < 3600) return `${Math.max(1, Math.round(d / 60))}m ago`
  if (d < 86400) return `${Math.round(d / 3600)}h ago`
  return `${Math.round(d / 86400)}d ago`
}
export const DIV_COLORS: Record<string, string> = {
  EB: '#38bdf8',
  HON: '#f5b700',
  FMSG: '#f472b6',
  FMCT: '#a78bfa',
  SVC: '#22c55e',
}
export const DIV_NAMES: Record<string, string> = {
  EB: 'Enterprise Business',
  HON: 'Honeywell Licensing',
  FMSG: 'Social-Media Gadgets',
  FMCT: 'Consumer Technology',
  SVC: 'Services & Annuity',
}
export const KIND_META: Record<string, { label: string; color: string }> = {
  cross_sell: { label: 'Cross-sell', color: '#38bdf8' },
  upsell: { label: 'Upsell', color: '#a78bfa' },
  solution: { label: 'Solution', color: '#f5b700' },
  recurring: { label: 'Annuity', color: '#22c55e' },
}
