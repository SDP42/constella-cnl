# Constella — Design System (MASTER, v2)

Generated with the **UI UX Pro Max** skill (`--design-system --variance 9 --motion 9`, then `--domain style`
rows *Bauhaus*, *Kinetic Typography*, *Interactive Cursor Design*, `--domain gsap`). v1 ("paper atlas") was
replaced at the user's request for something less common.

## Direction: "Constructivist Revenue Machine"
Bauhaus geometry + kinetic typography + a 3D kinetic sculpture. A B2B distributor sells *parts*; Constella
assembles them into *machines* (solutions). Every visual is built from five primitives — one per CNL division.

| Division | Primitive | Colour | Why |
|---|---|---|---|
| EB — Enterprise Business | cube | Bauhaus blue `#1040C0` | solid, structural, volume |
| HON — Honeywell licensing | sphere | CNL yellow `#F5B700` | CNL's own logo colour |
| FMSG — social-media gadgets | cone / triangle | Bauhaus red `#D02020` | fast, pointed, trend-driven |
| FMCT — consumer tech | cylinder | ink `#121212` | the workhorse |
| SVC — services & annuity | ring / torus | verdigris `#1E8F4E` | a ring = recurring revenue |

## Tokens
- Background `#F0EDE6` (warm off-white), surface `#FAF8F3`, foreground `#121212`, muted `#5C5A55`
- Border `2px solid #121212` on hero blocks; `1px rgb(18 18 18 / .14)` in data screens
- Hard shadow `4px 4px 0 #121212` (buttons, hero cards); press = translate(2px,2px) + no shadow
- Radius: `0` for blocks/cards, `9999px` for pills/buttons (skill: Bauhaus CSS keywords)
- **No line grids, no dot grids, no glow-on-black, no purple gradients** (user + skill anti-patterns)

## Typography
- Display: **Outfit** 900, uppercase, tracking -0.04em, line-height 0.88 (skill pairing "bauhaus, geometric, constructivist")
- Body/UI: Outfit 400–500, 16px, 1.55
- Figures: JetBrains Mono, tabular

## Motion (dial 9 — complex)
- Landing: GSAP ScrollTrigger pinned scrub (`start: top top, end: +=150%, scrub: 1, pin: true`), SplitText char
  reveals (`rotateX -40 → 0, stagger .015, expo.out`), kinetic marquees, custom blend-mode cursor with magnetic pull.
- App: 150–250 ms ease-out transitions only; no scroll-jacking; data first.
- `prefers-reduced-motion`: no scrub/pin, final states rendered, cursor disabled.

## Accessibility (skill checklist)
- Contrast ≥ 4.5:1 (yellow is a fill, never text on off-white; text on yellow is `#121212`)
- Visible focus: 3px `#1040C0` outline, 2px offset
- Custom cursor only on pointer: fine devices; native cursor kept for inputs
- Lucide SVG icons, no emoji icons; 44px minimum touch targets
