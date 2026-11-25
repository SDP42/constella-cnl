# Constella — Design System (MASTER)

Derived with the **UI UX Pro Max** skill (`--domain style`, `typography`, `color`, `landing`) and anchored in
Creative Newtech's own brand language (their decks use cream paper, an antique world map and gold brush strokes).

## Direction: "The Celestial Atlas"
An editorial, printed-atlas feel instead of the generic dark SaaS dashboard.
- **Style** (skill: *Parallax Storytelling* + *Editorial Grid/Magazine* + *3D & Hyperrealism*):
  scroll-driven chapters, asymmetric editorial layouts, pull quotes, margin annotations, one hero 3D object.
- **Metaphor:** every partner account is a brass **orrery**. Divisions are orbital rings, products are planets,
  whitespace is an empty socket waiting for a planet, a solution is a constellation drawn in gold thread.
- **Never:** grid-line backgrounds, neon glow on black, purple gradients, emoji icons, generic card grids.

## Colour tokens
| Token | Hex | Use |
|---|---|---|
| paper | `#F3ECDF` | page background |
| paper-2 | `#EAE0CC` | raised panels, table stripes |
| vellum | `#FBF7EF` | cards / dossiers |
| ink | `#17140F` | primary text, rules |
| ink-soft | `#5A5045` | secondary text (contrast ≥ 7:1 on paper) |
| gold | `#C98A00` | brand accent (darkened CNL gold for AA text contrast) |
| gold-bright | `#F5B700` | fills, highlights, brush strokes (never small text) |
| rust | `#B4432A` | risk, SLA breach, escalation |
| verdigris | `#2E7D5B` | positive, annuity, won |
| Division inks | EB `#2B5D8C` · HON `#C98A00` · FMSG `#A8326E` · FMCT `#5B4A9E` · SVC `#2E7D5B` | charts, orbits |

## Typography
- **Display:** Playfair Display (variable, italics for emphasis words) — skill pairing "Minimalist Monochrome Editorial".
- **UI / body:** Inter Tight 15–16px, line-height 1.55.
- **Figures & annotations:** JetBrains Mono, tabular numbers, small caps labels with 0.18em tracking.

## Motion (skill dial motion 8/10, "Complex")
- Lenis smooth scroll + GSAP ScrollTrigger chapters; pinned sections scrub the 3D orrery.
- Ink-draw reveals (SVG stroke-dashoffset), split-text line reveals, magnetic CTAs.
- Route transitions: a paper-fold / ink-wipe (clip-path), 450–650 ms, `power3.inOut`.
- Every effect has a `prefers-reduced-motion` static fallback; scroll-scrub disabled under reduced motion.

## Components
- **Dossier panel:** vellum background, 1px ink/12% border, folio number in the corner, mono caption.
- **Ledger table:** no zebra grid; hairline rules, mono figures right-aligned.
- **Stamp badges:** rotated ±2°, inked border — status (ACCEPTED, ESCALATED L2, WON).
- **Signal ticker:** typewriter line at the top of the page, like a wire feed.

## Pre-delivery checklist (from the skill)
- [ ] Text contrast ≥ 4.5:1 (ink on paper ≈ 15:1; gold `#C98A00` only for ≥ 18px or icons)
- [ ] Visible focus rings (2px gold, offset 2px)
- [ ] SVG icons (Lucide), no emoji as icons
- [ ] cursor-pointer + 150–300 ms hover transitions
- [ ] Reduced motion respected; responsive at 375 / 768 / 1024 / 1440
