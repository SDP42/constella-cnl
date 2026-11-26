import { useEffect } from 'react'

/** R3F measures its container once on mount; when a canvas mounts inside lazy/sticky/animated
 * layouts that measurement can be 0×0. Nudge it a few times after mount so it renders immediately. */
export function useCanvasKick(dep?: unknown) {
  useEffect(() => {
    const ids = [60, 300, 900].map((ms) => setTimeout(() => dispatchEvent(new Event('resize')), ms))
    return () => ids.forEach(clearTimeout)
  }, [dep])
}
