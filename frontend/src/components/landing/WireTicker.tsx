import { useEffect, useState } from 'react'
import { liveSocket } from '@/lib/api'

const KIND_LABEL: Record<string, string> = {
  whitespace: 'WHITESPACE', solution_gap: 'SOLUTION GAP', annuity_gap: 'ANNUITY GAP', intent_note: 'INTENT',
  replenishment_due: 'RENEWAL', growth_spike: 'GROWTH', churn_risk: 'LEAKAGE RISK', credit_constraint: 'CREDIT',
  upsell_momentum: 'UPSELL',
}

/** A wire-service style feed of signals streamed from the backend over WebSocket. */
export function WireTicker() {
  const [items, setItems] = useState<{ kind: string; title: string; account: string; city: string; k: number }[]>([])
  useEffect(() => {
    let k = 0
    return liveSocket((e) => setItems((prev) => [{ ...e, k: k++ }, ...prev].slice(0, 14)))
  }, [])
  const row = items.length ? items : [{ kind: 'whitespace', title: 'Listening to the partner network…', account: 'Constella', city: 'Mumbai', k: -1 }]
  return (
    <div className="relative overflow-hidden border-y border-[rgb(23_20_15/0.14)] bg-[#efe6d4]" aria-label="Live signal wire">
      <div className="flex w-max animate-marquee gap-10 py-2 hover:[animation-play-state:paused]">
        {[...row, ...row].map((it, i) => (
          <span key={`${it.k}-${i}`} className="flex items-center gap-3 whitespace-nowrap text-[13px] text-ink">
            <span className="caps text-gold">{KIND_LABEL[it.kind] ?? it.kind}</span>
            <span className="font-medium">{it.account}</span>
            <span className="text-ink-soft">· {it.city} ·</span>
            <span className="max-w-[46ch] truncate text-ink-soft">{it.title.replace(/^Intent captured: /, '')}</span>
            <span aria-hidden className="text-gold">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}
