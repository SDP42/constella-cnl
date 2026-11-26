/** Slow, blurred spectrum light behind every page — what the liquid glass refracts. */
export function Aura({ intensity = 1 }: { intensity?: number }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-pearl">
      <div className="absolute -left-[10%] -top-[15%] size-[55vw] animate-drift rounded-full bg-spec-eb blur-[120px]" style={{ opacity: 0.18 * intensity }} />
      <div className="absolute -right-[12%] top-[10%] size-[45vw] animate-drift-2 rounded-full bg-spec-fmct blur-[130px]" style={{ opacity: 0.14 * intensity }} />
      <div className="absolute bottom-[-20%] left-[20%] size-[50vw] animate-drift-2 rounded-full bg-spec-hon blur-[140px]" style={{ opacity: 0.14 * intensity }} />
      <div className="absolute bottom-[-10%] right-[5%] size-[35vw] animate-drift rounded-full bg-spec-svc blur-[120px]" style={{ opacity: 0.12 * intensity }} />
      <div className="absolute left-[45%] top-[35%] size-[25vw] animate-drift rounded-full bg-spec-fmsg blur-[120px]" style={{ opacity: 0.08 * intensity }} />
    </div>
  )
}
