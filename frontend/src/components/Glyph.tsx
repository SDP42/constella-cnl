/** Division glyphs — the five Bauhaus primitives used as icons everywhere (MASTER.md). */
export type DivCode = 'EB' | 'HON' | 'FMSG' | 'FMCT' | 'SVC'

export const DIV_HEX: Record<DivCode, string> = {
  EB: '#1040c0', HON: '#f5b700', FMSG: '#d02020', FMCT: '#121212', SVC: '#1e8f4e',
}
export const DIV_LABEL: Record<DivCode, string> = {
  EB: 'Enterprise Business', HON: 'Honeywell Licensing', FMSG: 'Social-Media Gadgets', FMCT: 'Consumer Tech', SVC: 'Services & Annuity',
}

export function Glyph({ div, size = 16, className, title }: { div: DivCode | string; size?: number; className?: string; title?: string }) {
  const c = DIV_HEX[div as DivCode] ?? '#121212'
  const s = size
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" className={className} role={title ? 'img' : undefined}
      aria-label={title} aria-hidden={title ? undefined : true}>
      {div === 'EB' && <rect x="2" y="2" width="16" height="16" fill={c} stroke="#121212" strokeWidth="1.5" />}
      {div === 'HON' && <circle cx="10" cy="10" r="8" fill={c} stroke="#121212" strokeWidth="1.5" />}
      {div === 'FMSG' && <polygon points="10,2 18.5,18 1.5,18" fill={c} stroke="#121212" strokeWidth="1.5" strokeLinejoin="round" />}
      {div === 'FMCT' && <rect x="4" y="1.5" width="12" height="17" rx="6" fill={c} stroke="#121212" strokeWidth="1.5" />}
      {div === 'SVC' && <circle cx="10" cy="10" r="7" fill="none" stroke={c} strokeWidth="4" />}
    </svg>
  )
}

export function GlyphRow({ size = 14, gap = 4 }: { size?: number; gap?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap }}>
      {(['EB', 'HON', 'FMSG', 'FMCT', 'SVC'] as DivCode[]).map((d) => <Glyph key={d} div={d} size={size} />)}
    </span>
  )
}
