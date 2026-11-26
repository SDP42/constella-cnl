import { useEffect, useRef, useState } from 'react'

/** Blend-mode cursor that grows and shows a verb over [data-cursor] targets (pointer: fine only). */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduced) return
    setEnabled(true)
    let x = innerWidth / 2
    let y = innerHeight / 2
    let cx = x
    let cy = y
    let raf = 0
    const move = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      const t = (e.target as HTMLElement)?.closest?.('[data-cursor]') as HTMLElement | null
      setLabel(t ? t.dataset.cursor || '' : null)
    }
    const loop = () => {
      cx += (x - cx) * 0.2
      cy += (y - cy) * 0.2
      if (dot.current) dot.current.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`
      raf = requestAnimationFrame(loop)
    }
    addEventListener('pointermove', move)
    raf = requestAnimationFrame(loop)
    document.documentElement.classList.add('custom-cursor')
    return () => {
      removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
      document.documentElement.classList.remove('custom-cursor')
    }
  }, [])

  if (!enabled) return null
  const big = label !== null
  return (
    <div
      ref={dot}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] grid place-items-center rounded-full bg-[#f0ede6] mix-blend-difference transition-[width,height] duration-200 ease-out"
      style={{ width: big ? 88 : 18, height: big ? 88 : 18 }}
    >
      {big && label && <span className="caps text-[10px] font-bold text-[#121212] mix-blend-normal">{label}</span>}
    </div>
  )
}
