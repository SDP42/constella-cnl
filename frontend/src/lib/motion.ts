import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useEffect } from 'react'

gsap.registerPlugin(ScrollTrigger)

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Lenis smooth scroll driven by GSAP's ticker so ScrollTrigger and Lenis never disagree. */
export function useSmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return
    const lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    ;(window as any).__lenis = lenis
    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      delete (window as any).__lenis
    }
  }, [])
}

export const scrollToId = (id: string) => {
  const el = document.getElementById(id)
  if (!el) return
  const lenis = (window as any).__lenis
  if (lenis) lenis.scrollTo(el, { offset: -40 })
  else el.scrollIntoView({ behavior: 'smooth' })
}

export { gsap, ScrollTrigger }
