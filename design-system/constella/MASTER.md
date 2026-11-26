# Constella — Design System (MASTER, v3 "Liquid Glass Prism")

Chosen by the user from three skill-backed options (v1 paper atlas and v2 Bauhaus were rejected as
common/retro). Sources: UI UX Pro Max `--domain style` rows **Liquid Glass** and **Spatial UI (VisionOS)**,
typography pairing **Premium Sans (DM Sans)**.

## Metaphor
A partner is white light. CNL's divisions are the spectrum. Today the prism *splits* the partner into five
separate beams (silos). Constella *recombines* them: on scroll the beams fold back into one white beam — the
integrated solution. Small glass shards drifting in the scene are individual SKUs.

| Division | Spectrum colour |
|---|---|
| EB — Enterprise Business | `#3B6BFF` |
| HON — Licensed & Own Brands (Honeywell, AT&T, WOZOYO) | `#F5B700` (CNL logo gold) |
| FMSG — social-media gadgets & drones | `#FF4D6D` |
| FMCT — consumer tech & AI workstations | `#8B5CF6` |
| SVC — services & annuity | `#10B981` |

## Materials (skill: Spatial UI variables)
- Page: pearl `#F5F6FA` with 3–5 slow, large, blurred colour fields (the light the glass refracts). No grids, no lines.
- **Glass (navigation, controls, overlays only)**: `rgba(255,255,255,.42)`, `backdrop-filter: blur(28px) saturate(180%)`,
  1px inner highlight `rgba(255,255,255,.75)`, iridescent hairline edge, radius 24px, shadow `0 8px 32px rgba(14,18,32,.10)`.
- **Content layer (cards, tables, charts)**: near-opaque `rgba(255,255,255,.82)`, blur 12px, radius 20px — the skill says
  keep content on a separate, legible layer.
- `@media (prefers-reduced-transparency: reduce)` → opaque white panels.

## Type
- DM Sans variable — display 600–700, tracking −0.035em, sentence case; body 16px / 1.55.
- JetBrains Mono for figures and labels (tabular numbers).
- Ink `#0E1220`, secondary `#5B6275` (≥ 7:1 on pearl).

## Motion
- Landing: GSAP ScrollTrigger pin + scrub drives the prism stage (split → converge → white beam). SplitText-style
  word rises; fluid morph transitions (skill: "fluid morph transitions"). 600–900 ms `expo.out`.
- App: 150–250 ms, scale-on-focus 1.02, no scroll-jacking.
- Reduced motion → static final states.

## Do not
Retro/Bauhaus geometry, hard offset shadows, dark grid backgrounds, neon-on-black, purple-pink AI gradients as
backgrounds, glass on dense text.
