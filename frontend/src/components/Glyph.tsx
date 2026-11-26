/** Division mark — a small glass orb in the division's spectrum colour (MASTER v3). */
export type DivCode = 'EB' | 'HON' | 'FMSG' | 'FMCT' | 'SVC'

export const DIV_HEX: Record<DivCode, string> = {
  EB: '#3e5c76', HON: '#c99a2e', FMSG: '#c2553d', FMCT: '#6b4e71', SVC: '#3f7d5c',
}
export const DIV_LABEL: Record<DivCode, string> = {
  EB: 'Enterprise Business', HON: 'Licensed & Own Brands', FMSG: 'Gadgets & Drones', FMCT: 'Consumer & AI Tech', SVC: 'Services & Annuity',
}

export function Glyph({ div, size = 14, className, title }: { div: DivCode | string; size?: number; className?: string; title?: string }) {
  const c = DIV_HEX[div as DivCode] ?? '#5b6275'
  return (
    <span role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      className={`inline-block shrink-0 rounded-full ${className ?? ''}`}
      style={{
        width: size, height: size,
        background: `radial-gradient(circle at 32% 28%, #ffffffee 0 14%, ${c}cc 38%, ${c} 70%)`,
        boxShadow: `0 0 0 1px #ffffffaa inset, 0 ${size / 6}px ${size / 2}px -${size / 6}px ${c}88`,
      }} />
  )
}

export function GlyphRow({ size = 10, gap = 4 }: { size?: number; gap?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap }}>
      {(['EB', 'HON', 'FMSG', 'FMCT', 'SVC'] as DivCode[]).map((d) => <Glyph key={d} div={d} size={size} />)}
    </span>
  )
}
