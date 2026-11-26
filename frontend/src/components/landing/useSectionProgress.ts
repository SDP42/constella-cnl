import { useEffect, useRef, useState } from 'react'

/**
 * Scroll progress (0..1) of a tall section while its sticky child is pinned.
 * Returns a ref for per-frame reads (3D / CSS vars) and a throttled state value for React.
 */
export function useSectionProgress<T extends HTMLElement>(steps = 100) {
  const ref = useRef<T>(null)
  const value = useRef(0)
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const span = Math.max(1, el.offsetHeight - innerHeight)
        const v = Math.min(1, Math.max(0, -r.top / span))
        value.current = v
        el.style.setProperty('--p', v.toFixed(4))
        const q = Math.round(v * steps) / steps
        setP((prev) => (prev === q ? prev : q))
      })
    }
    on()
    addEventListener('scroll', on, { passive: true })
    addEventListener('resize', on)
    return () => {
      removeEventListener('scroll', on)
      removeEventListener('resize', on)
      cancelAnimationFrame(raf)
    }
  }, [steps])
  return { ref, value, p }
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
