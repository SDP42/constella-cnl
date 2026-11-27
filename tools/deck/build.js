// Constella PS1 deck — Beige/Black Vintage template. Run: node patch_pptxgenjs.js && node vintage_bg.js && node build.js out.pptx
const pptxgen = require('pptxgenjs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const sharp = require('sharp')
const fa = require('react-icons/fa')
const si = require('react-icons/si')
const QR = require('qrcode')
const path = require('path')

const OUT = process.argv[2]
const IMG = (f) => path.join(__dirname, 'img', f)
const K = { blue: '4A5D70', green: '5E7F62', orange: 'A8742F', red: 'A8462E', purple: '7A4E6B', navy: '333333', gold: '8B5E34', ink: '2B2B2B', grey: '6B5B4B', line: 'D9C7AE' }
const TINT = { blue: 'F3F4F3', green: 'F2F5EE', orange: 'FCF4E6', red: 'FBEEE8', purple: 'F8EFF3', navy: 'FBF7F1', gold: 'FAF1E5' }
const scorecard = require('./scorecard.json')
const pilot = require('./pilot.json')
const DRIVE = 'https://drive.google.com/drive/folders/1TuzWLrr9LLNL6KPNZAltIrK8jScpjtsk?usp=sharing'
const LIVE = 'https://constella-cnl.vercel.app', API = 'https://constella-cnl.onrender.com/docs', GH = 'https://github.com/SDP42/constella-cnl'

async function icon(Comp, color, size = 256) {
  const svg = renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size }))
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()).toString('base64')
}
const qr = async (url) => (await QR.toDataURL(url, { margin: 0, width: 360, color: { dark: '#2B2B2B', light: '#FFFFFF' } })).replace('data:', '')

;(async () => {
  const pres = new pptxgen()
  pres.layout = 'LAYOUT_WIDE'
  pres.title = 'Constella — CNL PS1'
  pres.author = 'Team Outliers'
  pres.theme = { headFontFace: 'Rockwell', bodyFontFace: 'Trebuchet MS' }

  pres.defineSlideMaster({
    title: 'VINT', background: { path: IMG('v_content.jpg') },
    objects: [
      { line: { x: 0.3, y: 7.1, w: 12.73, h: 0, line: { color: '333333', width: 0.75 } } },
      { text: { text: 'Constella  ·  Team Outliers  ·  Creative Newtech × E-Cell IIT Bombay  ·  Problem Statement 1: Beyond Distribution', options: { x: 0.3, y: 7.13, w: 11.5, h: 0.3, fontSize: 9.5, fontFace: 'Trebuchet MS', color: '5A4A3A', margin: 0, valign: 'middle' } } },
      { placeholder: { options: { name: 'title', type: 'title', x: 2.05, y: 0.06, w: 9.23, h: 0.58, fontSize: 26, bold: true, fontFace: 'Rockwell', color: '2B2B2B', align: 'center', valign: 'middle', margin: 0 }, text: '' } },
    ],
    slideNumber: { x: 12.5, y: 7.13, w: 0.53, h: 0.3, fontSize: 10, fontFace: 'Trebuchet MS', color: '5A4A3A', align: 'right' },
  })
  pres.defineSlideMaster({ title: 'COVER', background: { path: IMG('v_cover.jpg') }, objects: [] })

  const T = (s, text, o = {}) => s.addText(text, { isTextBox: true, fontFace: 'Trebuchet MS', color: K.ink, margin: 0, valign: 'top', fontSize: 11, ...o })
  const rich = (str, base = {}) => str.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((seg) => (seg.startsWith('**') ? { text: seg.slice(2, -2), options: { ...base, bold: true } } : { text: seg, options: { ...base } }))
  const head = (s, title, sub) => {
    s.addText(title, { placeholder: 'title' })
    s.addImage({ path: IMG('v_ornament.png'), x: 4.67, y: 0.64, w: 4.0, h: 0.13, altText: 'ornament', objectName: 'ornament' })
    s.addShape(pres.shapes.OVAL, { x: 0.25, y: 0.14, w: 1.75, h: 0.46, fill: { color: 'FFFBF5' }, line: { color: K.navy, width: 1.25 }, objectName: 'team pill' })
    T(s, 'Team Outliers', { x: 0.25, y: 0.14, w: 1.75, h: 0.46, fontSize: 13, bold: true, fontFace: 'Rockwell', align: 'center', valign: 'middle', color: K.navy })
    T(s, [{ text: 'CREATIVE NEWTECH', options: { bold: true, color: K.gold, breakLine: true } }, { text: '× E-CELL IIT BOMBAY', options: { bold: true, color: K.navy } }], { x: 10.85, y: 0.12, w: 2.2, h: 0.5, fontSize: 11.5, align: 'right', valign: 'middle' })
    if (sub) T(s, sub, { x: 1.2, y: 0.79, w: 10.93, h: 0.3, fontSize: 13.5, italic: true, fontFace: 'Georgia', color: K.gold, align: 'center', valign: 'middle' })
  }
  // Layout rule for every list: items spread evenly over the full panel height (no bottom whitespace), diamond marker +
  // fixed hanging indent. Two columns in wide panels: even counts pair up row by row; an odd count ends with one full row.
  const fill = (s, items, x, y, w, h, o = {}) => {
    const n = items.length, fs = o.fontSize || 10, col = o.col || K.gold
    const cols = o.cols || (w > 7.5 && n >= 6 ? 2 : 1)
    const rows = cols === 2 ? Math.ceil(n / 2) : n, rh = h / rows, gap = 0.16, line = (fs * 1.22) / 72
    items.forEach((it, i) => {
      const full = cols === 1 || (n % 2 === 1 && i === n - 1)
      const r = cols === 1 ? i : Math.floor(i / 2), c = full ? 0 : i % 2
      const cw = full ? w : (w - gap) / 2, cx = x + c * (cw + gap), cy = y + r * rh + 0.02
      // marker sits on the FIRST line; wrapped lines hang under the text, not under the marker
      s.addShape(pres.shapes.DIAMOND, { x: cx + 0.01, y: cy + line / 2 - 0.04, w: 0.085, h: 0.085, fill: { color: col }, line: { color: col, width: 0 }, objectName: 'mk' })
      T(s, rich(it), { x: cx + 0.18, y: cy, w: cw - 0.18, h: rh - 0.02, fontSize: fs, valign: 'top', lineSpacingMultiple: 0.98 })
    })
  }
  // panel with a coloured header strip and vintage diamond ornaments either side of the title
  const hp = (s, x, y, w, h, title, col, name) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.06, fill: { color: TINT[col] }, line: { color: K[col], width: 1.5 }, objectName: name + ' body' })
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.38, rectRadius: 0.06, fill: { color: K[col] }, line: { color: K[col], width: 1.5 }, objectName: name + ' header' })
    const orn = w >= 2.6
    if (orn) [x + 0.14, x + w - 0.24].forEach((dx, k) => s.addShape(pres.shapes.DIAMOND, { x: dx, y: y + 0.14, w: 0.1, h: 0.1, fill: { color: 'F2DDBF' }, line: { color: 'F2DDBF', width: 0 }, objectName: name + ' orn' + k }))
    const avail = w - (orn ? 0.6 : 0.12), hfs = Math.min(12.5, Math.max(9, (avail * 72) / (0.62 * title.length)))
    T(s, title, { x: x + (orn ? 0.3 : 0.06), y, w: avail, h: 0.38, fontSize: hfs, bold: true, fontFace: 'Rockwell', color: 'FFFFFF', align: 'center', valign: 'middle' })
  }
  const dot = async (s, Comp, x, y, d, bg, name) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0 }, objectName: name + ' dot' })
    s.addImage({ data: await icon(Comp, 'FFFFFF'), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52, altText: name, objectName: name + ' icon' })
  }
  const pill = (s, text, x, y, w, col) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.25, rectRadius: 0.12, fill: { color: K[col] }, line: { color: K[col], width: 0 }, objectName: 'pill ' + text })
    T(s, text, { x, y, w, h: 0.25, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
  }
  const shot = (s, file, x, y, w, h, name) => {
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: 'FFFFFF' }, line: { color: K.line, width: 0.75 }, objectName: name + ' frame' })
    s.addImage({ path: IMG(file), x: x + 0.03, y: y + 0.03, w: w - 0.06, h: h - 0.06, sizing: { type: 'cover', w: w - 0.06, h: h - 0.06 }, altText: name, objectName: name })
  }
  const qrBox = async (s, url, label, sub, x, y, w, col, size = 0.9) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: size + 0.5, rectRadius: 0.06, fill: { color: 'FFFFFF' }, line: { color: K[col], width: 1.5 }, objectName: 'qr ' + label })
    s.addImage({ data: await qr(url), x: x + 0.1, y: y + 0.08, w: size, h: size, altText: 'QR ' + label, objectName: 'qr img ' + label, hyperlink: { url } })
    T(s, label, { x: x + size + 0.18, y: y + 0.1, w: w - size - 0.26, h: 0.3, fontSize: 11, bold: true, color: K[col] })
    T(s, sub, { x: x + size + 0.18, y: y + 0.42, w: w - size - 0.26, h: size, fontSize: 9, color: '5A4A3A', hyperlink: { url } })
  }
  const arrow = (s, x1, y1, x2, y2, color, name) => s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001, flipH: x2 < x1, flipV: y2 < y1, line: { color, width: 1.25, endArrowType: 'triangle' }, objectName: name })
  const chartBase = (title) => ({ showTitle: !!title, title, titleFontSize: 9.5, titleColor: K.ink, titleFontFace: 'Trebuchet MS', catAxisLabelColor: '5A4A3A', valAxisLabelColor: '5A4A3A', catAxisLabelFontSize: 8.5, valAxisLabelFontSize: 8, catAxisLabelFontFace: 'Calibri', valAxisLabelFontFace: 'Calibri', valGridLine: { color: 'E6DCCD', size: 0.5 }, catGridLine: { style: 'none' }, legendFontSize: 8.5, legendFontFace: 'Calibri' })
  const chevrons = (s, items, x, y, w, h, colors, subs, subH = 0.7) => {
    const cw = w / items.length
    items.forEach((t, i) => {
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, { x: x + i * cw, y, w: cw + 0.12, h, fill: { color: K[colors[i]] }, line: { color: 'FFFFFF', width: 1 }, objectName: 'phase ' + t })
      T(s, t, { x: x + i * cw + (i ? 0.25 : 0.1), y, w: cw - 0.35, h, fontSize: 12, bold: true, color: 'FFFFFF', valign: 'middle' })
      if (subs) T(s, subs[i], { x: x + i * cw + 0.05, y: y + h + 0.06, w: cw - 0.1, h: subH, fontSize: 10, color: K.ink })
    })
  }
  const kp = pilot.kpis, pct = (k) => Math.round(kp[k].uplift_pct)
  const photo = (ini) => { const f = path.join(__dirname, 'img', 'team', ini + '.png'); return require('fs').existsSync(f) ? f : null }
  const WINS = { 'Swayam Panchal': 5, 'Jeevesh Bodhani': 10, 'Rishit Lahoti': 10, 'Shreyas Kale': 9 }

  // ================================================================ 1 · TITLE (cover)
  pres.addSection({ title: 'Title' })
  let s = pres.addSlide({ masterName: 'COVER', sectionTitle: 'Title' })
  T(s, 'CREATIVE NEWTECH × E-CELL IIT BOMBAY HACKATHON  ·  PROBLEM STATEMENT 1', { x: 1.5, y: 0.3, w: 10.33, h: 0.32, fontSize: 13, bold: true, color: K.gold, align: 'center', charSpacing: 1 })
  T(s, 'CONSTELLA', { x: 1.5, y: 0.62, w: 10.33, h: 1.15, fontSize: 76, bold: true, fontFace: 'Rockwell', color: K.navy, align: 'center', valign: 'middle' })
  s.addImage({ path: IMG('v_ornament.png'), x: 4.07, y: 1.8, w: 5.2, h: 0.17, altText: 'ornament', objectName: 'ornament' })
  T(s, 'Account-twin revenue intelligence: Beyond Distribution, growing wallet share and solution selling', { x: 1.2, y: 2.03, w: 10.93, h: 0.36, fontSize: 16, italic: true, fontFace: 'Georgia', color: K.ink, align: 'center', valign: 'middle' })
  T(s, 'By : Team Outliers', { x: 3.5, y: 2.4, w: 6.33, h: 0.5, fontSize: 25, bold: true, fontFace: 'Rockwell', color: K.navy, align: 'center', valign: 'middle' })
  hp(s, 0.55, 3.02, 4.1, 3.72, 'Project at a glance', 'gold', 'glance')
  fill(s, [
    '**Problem Statement:** PS1 · Creative Newtech Limited (CNL)',
    '**Title:** Beyond Distribution: growing wallet share and solution selling across the customer network',
    '**Theme:** B2B technology distribution · AI-driven revenue intelligence',
    '**Category:** Software (AI / ML + full-stack web platform)',
    '**Solution:** Constella, one account twin per partner that detects, routes and proves',
    '**Team:** Team Outliers, four members with 34 hackathon wins between them',
    '**Members:** Swayam Panchal · Jeevesh Bodhani · Rishit Lahoti · Shreyas Kale',
  ], 0.66, 3.45, 3.92, 3.25, { fontSize: 11.5 })
  hp(s, 4.78, 3.02, 3.85, 3.72, 'Live today', 'navy', 'live')
  shot(s, 'landing_hero.jpg', 4.88, 3.48, 3.65, 1.9, 'Constella landing page')
  fill(s, ['All **26 screens and 6 role seats** are live; 46 APIs tested across 5 roles.', 'Judges get in with **one click**: pick a seat, no password.', 'Maps run on **free, open data**: NASA, Sentinel-2 and OpenStreetMap.', 'A **38-page solution document**, README and deploy guide come with it.'], 4.86, 5.44, 3.72, 1.28, { fontSize: 8.8 })
  hp(s, 8.76, 3.02, 4.02, 3.72, 'Scan to try, read and watch', 'red', 'scan')
  await qrBox(s, LIVE, 'Prototype', 'live on Vercel', 8.86, 3.48, 1.9, 'green', 0.62)
  await qrBox(s, API, 'API docs', 'all 46 endpoints', 10.82, 3.48, 1.9, 'blue', 0.62)
  await qrBox(s, DRIVE, 'Document', 'Word + PDF', 8.86, 4.68, 1.9, 'orange', 0.62)
  await qrBox(s, DRIVE, 'Video', 'pitch + demo', 10.82, 4.68, 1.9, 'purple', 0.62)
  T(s, [{ text: 'Code: ', options: { bold: true } }, { text: 'github.com/SDP42/constella-cnl', options: { hyperlink: { url: GH } } }], { x: 8.86, y: 5.92, w: 3.86, h: 0.3, fontSize: 10, align: 'center', valign: 'middle' })
  T(s, 'One partner. Every division. One view.', { x: 8.86, y: 6.25, w: 3.86, h: 0.4, fontSize: 13, bold: true, italic: true, fontFace: 'Georgia', color: K.gold, align: 'center', valign: 'middle' })
  T(s, 'Constella finds what each of CNL’s 10,000+ partners is missing, routes it to one owner, and proves the uplift against a control group.', { x: 0.55, y: 6.82, w: 12.23, h: 0.38, fontSize: 13, italic: true, fontFace: 'Georgia', color: K.ink, align: 'center', valign: 'middle' })

  // ================================================================ 2 · PROBLEM IDENTIFICATION
  pres.addSection({ title: 'Problem' })
  s = pres.addSlide({ masterName: 'VINT', sectionTitle: 'Problem' })
  head(s, 'PROBLEM IDENTIFICATION', 'Who loses, how much, and why the leak keeps growing')
  ;[
    ['₹1,774 Cr', 'FY25 revenue, from 10,000+ partners and 25+ brands', 'navy'],
    ['1.44 of 5', 'divisions an average partner buys from', 'red'],
    ['~86%', 'of a partner’s tech wallet goes to other distributors', 'red'],
    ['~1.1%', 'of revenue is recurring services and annuity', 'orange'],
    ['5.31%', 'EBITDA margin: a wrong discount wipes out the deal', 'gold'],
    ['45 days', 'net working capital: slow payers lock up cash', 'blue'],
  ].forEach(([v, l, c], i) => {
    const x = 0.3 + i * 2.13
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.14, w: 2.06, h: 1.12, rectRadius: 0.06, fill: { color: TINT[c] }, line: { color: K[c], width: 1.25 }, objectName: 'stat' + i })
    T(s, v, { x, y: 1.17, w: 2.06, h: 0.5, fontSize: 23, bold: true, fontFace: 'Rockwell', color: K[c], align: 'center', valign: 'middle' })
    T(s, l, { x: x + 0.08, y: 1.67, w: 1.9, h: 0.56, fontSize: 9.5, align: 'center' })
  })
  hp(s, 0.3, 2.36, 6.3, 2.74, 'Who faces it, and how it hurts them', 'navy', 'who')
  const who = [
    [fa.FaBuilding, 'CNL leadership', '₹6,000 Cr FY29 goal and a 40% licensed-brand mix need more revenue per partner, not just more partners.'],
    [fa.FaUserTie, 'Division sales teams', 'Each of 5 divisions sees only its own ledger; 40–180 accounts per rep with no ranking of who is ready.'],
    [fa.FaHandshake, 'Partners and SIs', 'Call 4 CNL people for 4 categories; slow, partial quotes lose school and campus projects.'],
    [fa.FaTags, 'Brand principals', 'Infinova, Ravel, Super Micro want solutions and service attach; they get box-by-box orders.'],
    [fa.FaSchool, 'End customers', 'Schools, hospitals and campuses receive piecemeal kit with no service contract behind it.'],
  ]
  for (let i = 0; i < 5; i++) {
    const y = 2.8 + i * 0.46
    await dot(s, who[i][0], 0.4, y + 0.03, 0.36, K.navy, who[i][1])
    T(s, [{ text: who[i][1] + ':  ', options: { bold: true, color: K.navy } }, { text: who[i][2] }], { x: 0.84, y, w: 5.7, h: 0.44, fontSize: 10, valign: 'middle' })
  }
  hp(s, 6.73, 2.36, 6.3, 2.74, 'What it costs: losses and thresholds', 'red', 'cost')
  s.addChart(pres.charts.DOUGHNUT, [{ name: 'wallet', labels: ['CNL', 'Other distributors'], values: [14, 86] }], { x: 6.8, y: 2.8, w: 1.95, h: 1.95, holeSize: 58, chartColors: [K.navy, K.red], showLegend: false, showValue: false, showPercent: false, showTitle: false, dataBorder: { pt: 1.5, color: 'FFFFFF' }, objectName: 'wallet doughnut' })
  T(s, [{ text: '86%', options: { bold: true, fontSize: 18, color: K.red, breakLine: true } }, { text: 'of wallet leaks', options: { fontSize: 8 } }], { x: 7.27, y: 3.47, w: 1.0, h: 0.6, align: 'center', valign: 'middle' })
  T(s, 'Partner tech wallet', { x: 6.8, y: 4.74, w: 1.95, h: 0.28, fontSize: 9, bold: true, align: 'center', color: K.grey })
  fill(s, [
    'Every **1 point of wallet share** is worth about **₹17.7 Cr** of revenue and ₹1.42 Cr of gross profit a year.',
    'Selling what is popular captures only **51.4%** of next-quarter gross profit; ranking by value reaches 78.7%.',
    'A lead with no owner loses about **₹4.4 L a day** of value-at-stake across the network.',
    'Recurring services sit near **1.1% of revenue**, while Redington and others move to annuity.',
    'The same partner appears **3–5 times** across ERPs, so nobody sees the full account.',
  ], 8.82, 2.8, 4.15, 2.26, { fontSize: 9.6, col: K.red })
  hp(s, 0.3, 5.2, 12.73, 1.8, 'Root causes: why the leak keeps growing', 'gold', 'roots')
  ;[
    ['DATA SILOS', '5 division ERPs, no shared partner ID; GSTIN and names differ per ledger. Effect: no one sees the whole partner.'],
    ['NO DETECTION', 'Nobody models what a partner already owns and what is missing. Effect: reps guess, and sell one box at a time.'],
    ['NO OWNERSHIP', 'Cross-division leads have no owner or split credit. Effect: divisions do not cooperate and leads go stale.'],
    ['NO PROOF', 'No control group, so wins cannot be credited. Effect: spend on growth cannot be defended or scaled.'],
  ].forEach(([a, b], i) => {
    const x = 0.42 + i * 2.62
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.66, w: 2.46, h: 1.24, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.gold, width: 1 }, objectName: 'root' + i })
    T(s, a, { x: x + 0.08, y: 5.7, w: 2.3, h: 0.3, fontSize: 11.5, bold: true, color: K.gold })
    T(s, b, { x: x + 0.08, y: 6.0, w: 2.3, h: 0.88, fontSize: 11 })
    arrow(s, x + 2.46, 6.28, x + 2.62, 6.28, K.ink, 'ra' + i)
  })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.9, y: 5.66, w: 2.03, h: 1.24, rectRadius: 0.05, fill: { color: K.red }, line: { color: K.red, width: 0 }, objectName: 'result' })
  T(s, [{ text: 'RESULT', options: { bold: true, fontSize: 11.5, breakLine: true } }, { text: 'Low wallet share, box selling, thin margin and no annuity', options: { fontSize: 11 } }], { x: 10.98, y: 5.7, w: 1.88, h: 1.16, color: 'FFFFFF', valign: 'middle' })

  // ================================================================ 3 · EXISTING SOLUTIONS & GAPS
  pres.addSection({ title: 'Existing solutions' })
  s = pres.addSlide({ masterName: 'VINT', sectionTitle: 'Existing solutions' })
  head(s, 'EXISTING SOLUTIONS AND THEIR GAPS', 'What the market offers today, what it misses, and why CNL’s problem is still open')
  hp(s, 0.3, 1.14, 8.4, 3.5, 'Who offers what, and where it falls short for CNL', 'navy', 'comptable')
  const th = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: K.gold } } })
  const crow = [
    ['Ingram Micro (Xvantage)', '400+ ML models suggest add-ons, warranties and bundles on reseller orders', 'Partner-facing; ignores CNL’s internal division silos and its own margin and cash', 'Ranks by purchase likelihood, not distributor profit'],
    ['Redington (Online, Cloud Quarks)', 'B2B portal, renewals, AI marketplace; moving to recurring services', 'No solution-gap detection from a partner’s installed base', 'Waits for the partner to log in; no outbound targeting'],
    ['TD SYNNEX (Digital Bridge)', 'Partner engine that surfaces adjacent categories', 'No owner, split credit or SLA inside the distributor', 'Category hints only; no measured lift'],
    ['Salesforce / Zoho CRM', 'Records deals; Einstein next-best-action framework', 'Detects nothing without custom models; not GSTIN / DPDP native', 'Depends on what reps type; months to build models'],
    ['Today at CNL: ERP reports + Excel', 'Monthly sales reports per division, manual follow-up', 'No cross-division view, no ranking, no proof', 'Manual, one division at a time; partners duplicated 3–5×'],
    ['“Customers also bought” lists', 'Popularity-based recommendations', 'Product-level; blind to margin, cash and credit', 'Same hit-rate (0.18) but 51.4% vs 78.7% GP capture'],
  ]
  s.addTable([[th('Existing solution'), th('What it offers'), th('What is missing for CNL'), th('Efficiency / accuracy issue')], ...crow.map((r, i) => r.map((c, j) => ({ text: c, options: { bold: j === 0, color: j === 0 ? K.navy : j === 2 ? K.red : j === 3 ? K.gold : K.ink, fill: { color: i % 2 ? 'FFFFFF' : 'FBF6EE' } } })))],
    { x: 0.38, y: 1.56, w: 8.24, colW: [1.6, 2.2, 2.27, 2.17], rowH: [0.26, 0.47, 0.45, 0.41, 0.45, 0.45, 0.41], fontSize: 8.6, fontFace: 'Trebuchet MS', border: { type: 'solid', color: 'D9C7AE', pt: 0.5 }, valign: 'middle', margin: 0.05, objectName: 'existing table' })
  hp(s, 8.8, 1.14, 4.23, 3.5, 'Capability check (public material)', 'orange', 'capcheck')
  ;['Constella', 'Ingram', 'Redington', 'SFDC'].forEach((h, j) => T(s, h, { x: 10.55 + j * 0.62, y: 1.58, w: 0.62, h: 0.22, fontSize: 8.5, bold: true, align: 'center', color: j === 0 ? K.orange : K.grey }))
  ;[['Solution-gap detection', 2, 1, 0, 0], ['Margin × cash × credit', 2, 0, 0, 1], ['Routing + split credit', 2, 0, 0, 1], ['SLA ladder + automation', 2, 1, 1, 2], ['Pilot with stop rule', 2, 0, 0, 0], ['OSM / satellite demand', 2, 0, 0, 0], ['GSTIN + DPDP built in', 2, 1, 2, 1], ['Explainable + learning', 2, 2, 1, 2]].forEach(([n, ...v], i) => {
    const y = 1.84 + i * 0.32
    T(s, n, { x: 8.92, y, w: 1.65, h: 0.28, fontSize: 9.5, valign: 'middle' })
    v.forEach((val, j) => {
      const cx = 10.55 + j * 0.62 + 0.21, col = j === 0 ? K.orange : '6B5B4B'
      s.addShape(pres.shapes.OVAL, { x: cx, y: y + 0.05, w: 0.19, h: 0.19, fill: { color: val === 2 ? col : 'FFFFFF' }, line: { color: col, width: 1 }, objectName: `c${i}${j}` })
      if (val === 1) s.addShape(pres.shapes.OVAL, { x: cx + 0.055, y: y + 0.105, w: 0.08, h: 0.08, fill: { color: col }, line: { color: col, width: 0 }, objectName: `h${i}${j}` })
    })
  })
  T(s, '● built in   ◉ partial   ○ not offered', { x: 8.92, y: 4.4, w: 4.0, h: 0.2, fontSize: 8.5, color: K.grey, align: 'center' })
  hp(s, 0.3, 4.74, 6.3, 2.26, 'Why the problem is still unsolved', 'red', 'unsolved')
  fill(s, [
    'Most tools are **built for the partner**: they help a reseller fill a cart, but none fixes the five silos inside CNL.',
    'They **rank by revenue**. On a 5.31% EBITDA business, a popular deal with thin margin and slow payment can lose money.',
    'They suggest **one product at a time**, while a classroom needs panels, cabling, audio, cameras and an AMC together.',
    'A lead that spans divisions has **no owner and no shared credit**, so it decays at about ₹4.4 L a day.',
    'Without a **control group**, nobody can say which action created the revenue, so spend cannot be defended.',
  ], 0.42, 5.18, 6.12, 1.8, { fontSize: 9.8, col: K.red })
  hp(s, 6.73, 4.74, 6.3, 2.26, 'The gaps, measured', 'gold', 'measured')
  ;[['3–5×', 'same partner duplicated across ERPs'], ['51.4%', 'GP captured by popularity ranking'], ['days', 'for a lead to find an owner by hand'], ['0', 'control groups: no lift can be proven']].forEach(([v, l], i) => {
    const x = 6.85 + i * 1.53
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.18, w: 1.45, h: 1.0, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.gold, width: 1 }, objectName: 'gm' + i })
    T(s, v, { x, y: 5.2, w: 1.45, h: 0.44, fontSize: 19, bold: true, fontFace: 'Rockwell', color: K.red, align: 'center', valign: 'middle' })
    T(s, l, { x: x + 0.06, y: 5.64, w: 1.33, h: 0.52, fontSize: 8.8, align: 'center' })
  })
  T(s, rich('**What is needed:** one record per partner, solution-level detection ranked by profit and cash, one accountable owner with credit for helpers, and a randomised pilot that can say stop.'), { x: 6.85, y: 6.24, w: 6.08, h: 0.72, fontSize: 10, valign: 'middle' })

  // ================================================================ 4 · OUR SOLUTION
  pres.addSection({ title: 'Solution' })
  s = pres.addSlide({ masterName: 'VINT', sectionTitle: 'Solution' })
  head(s, 'OUR SOLUTION: CONSTELLA', 'What we built, how the approach works, and why every gap closes')
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.3, y: 1.14, w: 12.73, h: 0.66, rectRadius: 0.06, fill: { color: 'FFFFFF' }, line: { color: K.gold, width: 1.25 }, objectName: 'simple' })
  T(s, rich('**In simple words:** Constella builds one “account twin” for every partner from CNL’s five division ledgers, spots what each partner is missing, from the next product to a whole solution and its service contract, ranks it by what CNL actually earns, gives it to **one owner with split credit**, and **proves the uplift against a control group**.'), { x: 0.42, y: 1.14, w: 12.5, h: 0.66, fontSize: 11.5, valign: 'middle' })
  hp(s, 0.3, 1.9, 4.15, 3.36, 'Our approach in 5 steps', 'navy', 'steps')
  ;[
    ['MODEL', 'GSTIN → PAN → fuzzy matching unifies 5 ledgers into one golden record (99.2% precision).'],
    ['DETECT', 'Calibrated gradient boosting on 24 explainable features + 11 solution blueprints find gaps.'],
    ['VALUE', 'P × margin × cash velocity × credit fit, plus 3-year annuity, ranks every opportunity.'],
    ['ROUTE', 'Lead + assists with 70/30 split credit; SLA ladder L1–L4; 8 automation playbooks.'],
    ['PROVE', '20% randomised control group, attribution, champion/challenger retraining, stop rule.'],
  ].forEach(([a, b], i) => {
    const y = 2.34 + i * 0.58
    s.addShape(pres.shapes.OVAL, { x: 0.4, y: y + 0.06, w: 0.38, h: 0.38, fill: { color: K.navy }, line: { color: K.navy, width: 0 }, objectName: 'sn' + i })
    T(s, String(i + 1), { x: 0.4, y: y + 0.06, w: 0.38, h: 0.38, fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    T(s, [{ text: a + '  ', options: { bold: true, color: K.navy } }, { text: b }], { x: 0.86, y, w: 3.52, h: 0.56, fontSize: 10.2, valign: 'middle' })
  })
  hp(s, 4.55, 1.9, 4.3, 3.36, 'How every gap closes', 'green', 'closes')
  T(s, 'GAP TODAY', { x: 4.66, y: 2.32, w: 1.85, h: 0.22, fontSize: 9, bold: true, color: K.red, align: 'center' })
  T(s, 'CONSTELLA FIX', { x: 6.84, y: 2.32, w: 1.92, h: 0.22, fontSize: 9, bold: true, color: K.green, align: 'center' })
  const tw = [
    [fa.FaLayerGroup, 'Five siloed ledgers', fa.FaUserCircle, 'One account twin'],
    [fa.FaBoxOpen, 'Box-by-box selling', fa.FaCubes, 'Solution blueprints'],
    [fa.FaChartBar, 'Revenue-only ranking', fa.FaRupeeSign, 'Margin + cash + credit'],
    [fa.FaQuestionCircle, 'Leads nobody owns', fa.FaUserCheck, 'Owner + split credit'],
    [fa.FaClipboardList, 'Manual follow-up', fa.FaRobot, '66% automated'],
    [fa.FaDice, 'Gut-feel results', fa.FaBalanceScale, 'Control-group proof'],
  ]
  for (let i = 0; i < tw.length; i++) {
    const y = 2.58 + i * 0.44
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.66, y, w: 1.85, h: 0.38, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.line, width: 0.75 }, objectName: 'gap ' + i })
    s.addImage({ data: await icon(tw[i][0], K.red), x: 4.72, y: y + 0.08, w: 0.22, h: 0.22, altText: tw[i][1], objectName: 'gapi ' + i })
    T(s, tw[i][1], { x: 4.99, y, w: 1.5, h: 0.38, fontSize: 9.5, valign: 'middle' })
    arrow(s, 6.53, y + 0.19, 6.82, y + 0.19, K.ink, 'gfa' + i)
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.84, y, w: 1.92, h: 0.38, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.green, width: 1 }, objectName: 'fix ' + i })
    s.addImage({ data: await icon(tw[i][2], K.green), x: 6.9, y: y + 0.08, w: 0.22, h: 0.22, altText: tw[i][3], objectName: 'fixi ' + i })
    T(s, tw[i][3], { x: 7.17, y, w: 1.57, h: 0.38, fontSize: 9.5, bold: true, valign: 'middle' })
  }
  hp(s, 8.95, 1.9, 4.08, 3.36, 'Why our approach works', 'orange', 'works')
  fill(s, [
    'On a time-split back-test the model scores **AUC 0.83**; its probabilities are calibrated (ECE 0.015).',
    'Value ranking captures **78.7%** of next-quarter gross profit, against 51.4% for popularity.',
    'Entity resolution turns **1,698 raw records into 600 partners** at 99.2% precision.',
    'Treated partners earn **53% more** than a randomised control group.',
    'About **66% of workflow events** run without a person, so growth needs no new hires.',
    'A new model ships **only if it is not worse**; one retrain lifted AUC 0.811 → 0.824.',
    'Every score comes with **reason codes** a rep can read and challenge.',
    'It runs on **one CPU at about 258 MB**, live on free tiers today.',
  ], 9.04, 2.34, 3.94, 2.9, { fontSize: 9.4, col: K.orange })
  hp(s, 0.3, 5.36, 7.55, 1.64, 'What it looks like: real screens from the live app', 'navy', 'screens')
  ;[['accounttwin.jpg', 'Account twin'], ['sitetwin.jpg', 'Site twin'], ['inbox.jpg', 'Mission inbox'], ['command.jpg', 'Command center']].forEach(([f, c], i) => {
    shot(s, f, 0.4 + i * 1.86, 5.78, 1.78, 0.95, c)
    T(s, c, { x: 0.4 + i * 1.86, y: 6.74, w: 1.78, h: 0.22, fontSize: 9, bold: true, align: 'center' })
  })
  hp(s, 7.95, 5.36, 5.08, 1.64, 'Delivery path', 'green', 'path')
  chevrons(s, ['BUILT & LIVE', 'PILOT · 6 mo', 'SCALE'], 8.05, 5.8, 4.88, 0.36, ['navy', 'orange', 'green'], ['26 screens, 6 roles, 46 APIs; live on Vercel + Render', '2 branches, 20% control group, gates M2–M4, stop rule at M6', '31+ branches, ERP connectors, brand-principal portal'], 0.75)

  // ================================================================ 5 · SYSTEM ARCHITECTURE & TECH
  pres.addSection({ title: 'Architecture' })
  s = pres.addSlide({ masterName: 'VINT', sectionTitle: 'Architecture' })
  head(s, 'SYSTEM ARCHITECTURE AND TECH STACK', 'How data actually moves: ingest → twin → models → decisions → people, and back as learning')
  const node = async (x, y, w, h, title, sub, col, lg) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K[col], width: 1.25 }, objectName: 'node ' + title })
    if (lg) s.addImage({ data: await icon(lg[0], lg[1]), x: x + w - 0.25, y: y + 0.05, w: 0.2, h: 0.2, altText: title, objectName: 'logo ' + title })
    T(s, title, { x: x + 0.06, y: y + 0.03, w: w - 0.32, h: 0.2, fontSize: 8.4, bold: true, color: K[col] })
    if (sub) T(s, sub, { x: x + 0.06, y: y + 0.24, w: w - 0.1, h: h - 0.26, fontSize: 7.6 })
  }
  const lane = (l, x, w) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.13, w, h: 0.22, rectRadius: 0.11, fill: { color: K.navy }, line: { color: K.navy, width: 0 }, objectName: 'lane ' + l })
    T(s, l, { x, y: 1.13, w, h: 0.22, fontSize: 7, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
  }
  lane('1 · SOURCES', 0.3, 1.6); lane('2 · INGEST & TRUST', 2.12, 1.75); lane('3 · ACCOUNT-TWIN STORE', 4.09, 1.42); lane('4 · INTELLIGENCE (models)', 5.71, 2.5); lane('5 · DECIDE & ACT', 8.43, 1.7); lane('6 · GATEWAY', 10.2, 0.6); lane('7 · PEOPLE & CHANNELS', 10.88, 2.15)
  const src = [['Division ERPs', 'SAP B1 · Tally · Excel: invoices, customer master', fa.FaFileInvoice, K.blue], ['CRM notes · WhatsApp', 'call notes, chat lines → intent', si.SiWhatsapp, '25D366'], ['Price · stock · schemes', 'price lists, slabs, credit terms', fa.FaTags, K.blue], ['New orders API', 'JSON / CSV from ERP, daily', fa.FaPlug, K.blue], ['Open data', 'OSM schools & hospitals · Sentinel-2 · NASA GIBS', si.SiOpenstreetmap, '7EBC6F']]
  for (let i = 0; i < 5; i++) { await node(0.3, 1.43 + i * 0.7, 1.6, 0.62, src[i][0], src[i][1], 'blue', [src[i][2], src[i][3]]); s.addShape(pres.shapes.LINE, { x: 1.9, y: 1.74 + i * 0.7, w: 0.11, h: 0, line: { color: K.blue, width: 1.25 }, objectName: 'sl' + i }) }
  s.addShape(pres.shapes.LINE, { x: 2.01, y: 1.74, w: 0, h: 2.8, line: { color: K.blue, width: 1.25 }, objectName: 'src bus' })
  const ing = [['API & validation', 'Pydantic schemas · GSTIN mod-36 check digit · CSV/JSON', si.SiPydantic, 'E92063'], ['Entity resolution', 'GSTIN → PAN → fuzzy → bge tie-break · 1,698 → 600 · P 0.99', fa.FaFingerprint, K.purple], ['Data quality', 'DQ score per record · PSI drift · dedupe', fa.FaCheckDouble, K.purple], ['Steward queue', 'Neha approves unsure merges; fixes flow back ↺', fa.FaUserShield, K.purple]]
  for (let i = 0; i < 4; i++) { await node(2.12, 1.43 + i * 0.86, 1.75, 0.78, ing[i][0], ing[i][1], 'purple', [ing[i][2], ing[i][3]]); arrow(s, 2.01, 1.82 + i * 0.86, 2.12, 1.82 + i * 0.86, K.blue, 'ib' + i); if (i < 3) arrow(s, 3.0, 2.21 + i * 0.86, 3.0, 2.29 + i * 0.86, K.purple, 'iv' + i) }
  arrow(s, 3.87, 2.6, 4.09, 2.6, K.ink, 'b2c')
  s.addShape(pres.shapes.CAN, { x: 4.09, y: 1.43, w: 1.42, h: 1.95, fill: { color: 'FFFFFF' }, line: { color: K.navy, width: 1.25 }, objectName: 'store' })
  s.addImage({ data: await icon(si.SiPostgresql, '4169E1'), x: 4.65, y: 1.78, w: 0.3, h: 0.3, altText: 'Postgres', objectName: 'pg' })
  T(s, [{ text: 'Account twin', options: { bold: true, fontSize: 9.5, breakLine: true } }, { text: 'SQLModel · SQLite → PostgreSQL · 20 tables · one golden record per partner', options: { fontSize: 8.2 } }], { x: 4.13, y: 2.12, w: 1.34, h: 1.2, align: 'center' })
  arrow(s, 4.8, 3.38, 4.8, 3.5, K.navy, 'c2f')
  await node(4.09, 3.5, 1.42, 0.7, 'Feature snapshot', '24 explainable features · time-split', 'navy', [si.SiPandas, '150458'])
  await node(4.09, 4.28, 1.42, 0.6, 'Audit log', 'append-only · every write', 'navy', [fa.FaClipboardCheck, K.navy])
  arrow(s, 5.51, 2.2, 5.71, 2.2, K.ink, 'c2d1'); arrow(s, 5.51, 3.85, 5.71, 3.85, K.ink, 'c2d2')
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.71, y: 1.43, w: 2.5, h: 3.45, rectRadius: 0.05, fill: { color: 'FCF4E6' }, line: { color: K.orange, width: 1.25, dashType: 'dash' }, objectName: 'intel' })
  const ie = [['Propensity', 'GBM · calibrated · AUC 0.83', si.SiScikitlearn, 'F7931E'], ['Co-purchase', 'lift · cosine · confidence', fa.FaProjectDiagram, K.orange], ['Solution gaps', '11 blueprints → BOM', fa.FaCubes, K.orange], ['Value-at-stake', 'P × margin × cash × credit', fa.FaRupeeSign, K.orange], ['Churn model', 'logistic · revenue at risk', fa.FaUserMinus, K.orange], ['Forecast', 'ridge + Fourier · FY29', fa.FaChartLine, K.orange], ['Pay-date GBM', 'MAE 7 days · DSO', fa.FaCalendarCheck, K.orange], ['bge-small', 'ONNX · intent · RAG · dedupe', si.SiOnnx, '005CED']]
  for (let i = 0; i < 8; i++) await node(5.78 + (i % 2) * 1.2, 1.5 + Math.floor(i / 2) * 0.84, 1.16, 0.76, ie[i][0], ie[i][1], 'orange', [ie[i][2], ie[i][3]])
  s.addShape(pres.shapes.LINE, { x: 8.32, y: 1.73, w: 0, h: 2.73, line: { color: K.orange, width: 1.25 }, objectName: 'intel bus' })
  s.addShape(pres.shapes.LINE, { x: 8.21, y: 3.1, w: 0.11, h: 0, line: { color: K.orange, width: 1.25 }, objectName: 'intel out' })
  const ac = [['Opportunity builder', '4 kinds · reason codes', fa.FaLightbulb], ['Router', 'lead + assists · 70/30 · capacity', fa.FaRoute], ['SLA ladder', 'nudge 48 h → reassign → head → nurture', fa.FaLevelUpAlt], ['Scheduler + playbooks', '8 playbooks · asyncio jobs', fa.FaCogs], ['Deal desk', 'margin floors · approvals', fa.FaGavel]]
  for (let i = 0; i < 5; i++) { await node(8.43, 1.43 + i * 0.7, 1.7, 0.62, ac[i][0], ac[i][1], 'red', [ac[i][2], K.red]); arrow(s, 8.32, 1.74 + i * 0.7, 8.43, 1.74 + i * 0.7, K.orange, 'ab' + i) }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.23, y: 1.43, w: 0.55, h: 3.45, rectRadius: 0.05, fill: { color: K.navy }, line: { color: K.navy, width: 0 }, objectName: 'gateway' })
  s.addImage({ data: await icon(si.SiFastapi, '05998B'), x: 10.36, y: 1.5, w: 0.3, h: 0.3, altText: 'FastAPI', objectName: 'fastapi' })
  T(s, 'FastAPI · RBAC · PII masking · rate limit · audit', { x: 9.1, y: 3.12, w: 2.8, h: 0.42, fontSize: 8, bold: true, color: 'FCE7C8', align: 'center', valign: 'middle', rotate: 270 })
  for (let i = 0; i < 5; i++) arrow(s, 10.13, 1.74 + i * 0.7, 10.23, 1.74 + i * 0.7, K.red, 'eg' + i)
  const ex = [['Role workspaces', 'React 19 · 26 screens · 6 seats', si.SiReact, '149ECA'], ['3D twins', 'three.js · account & site', si.SiThreedotjs, '000000'], ['Satellite maps', 'MapLibre · Sentinel-2 · OSM', si.SiMaplibre, '396CB2'], ['Copilot', 'LangGraph · Claude / offline · voice', si.SiAnthropic, 'D97757'], ['Channels', 'WhatsApp brief · email · proposal link', fa.FaPaperPlane, K.green]]
  for (let i = 0; i < 5; i++) { await node(10.88, 1.43 + i * 0.7, 2.15, 0.62, ex[i][0], ex[i][1], 'green', [ex[i][2], ex[i][3]]); arrow(s, 10.78, 1.74 + i * 0.7, 10.88, 1.74 + i * 0.7, K.navy, 'gx' + i) }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.3, y: 5.0, w: 12.73, h: 0.48, rectRadius: 0.06, fill: { color: 'F5EBDD' }, line: { color: K.gold, width: 1.25 }, objectName: 'learning loop' })
  T(s, [{ text: 'LEARNING LOOP ↺  ', options: { bold: true, color: K.gold } }, { text: 'new ERP orders and WhatsApp intent + rep ratings (Beta(2,2) priors) → live re-score of every partner → nightly champion/challenger retrain, promoted only if GP capture@5 is not worse (AUC 0.811 → 0.824 in test)' }], { x: 0.42, y: 5.0, w: 12.5, h: 0.48, fontSize: 9.8, valign: 'middle' })
  arrow(s, 11.95, 4.93, 11.95, 5.0, K.gold, 'up from people'); arrow(s, 6.96, 5.0, 6.96, 4.88, K.gold, 'into models'); arrow(s, 3.0, 5.0, 3.0, 4.89, K.gold, 'into resolution')
  hp(s, 0.3, 5.56, 12.73, 1.44, 'Tech stack used, layer by layer', 'navy', 'stack')
  const stack = [
    ['FRONTEND', [[si.SiReact, '149ECA'], [si.SiTypescript, '3178C6'], [si.SiVite, '646CFF'], [si.SiTailwindcss, '06B6D4']], 'React 19 · TypeScript · Vite · Tailwind v4 · shadcn/ui · Recharts · GSAP'],
    ['3D & MAPS', [[si.SiThreedotjs, '000000'], [si.SiMaplibre, '396CB2'], [si.SiOpenstreetmap, '7EBC6F']], 'three.js / R3F · MapLibre GL · Sentinel-2 · NASA GIBS · Overpass'],
    ['BACKEND', [[si.SiPython, '3776AB'], [si.SiFastapi, '05998B'], [si.SiPydantic, 'E92063']], 'Python 3.12 · FastAPI · SQLModel · asyncio scheduler · WebSocket'],
    ['DATA & ML', [[si.SiPandas, '150458'], [si.SiScikitlearn, 'F7931E'], [si.SiOnnx, '005CED']], 'pandas · NumPy · scikit-learn GBM + isotonic · fastembed bge-small'],
    ['AI COPILOT', [[si.SiLangchain, '1C3C3C'], [si.SiAnthropic, 'D97757']], 'LangGraph · Claude (optional) · hybrid RAG · offline planner'],
    ['CLOUD & OPS', [[si.SiGithub, '181717'], [si.SiVercel ?? si.SiGithub, '000000'], [si.SiRender ?? si.SiGithub, '46E3B7']], 'Vercel · Render free (build-time bake, 258 MB) · GitHub Actions keep-alive'],
  ]
  for (let i = 0; i < 6; i++) {
    const x = 0.4 + i * 2.11
    T(s, stack[i][0], { x, y: 5.99, w: 2.0, h: 0.22, fontSize: 9.5, bold: true, color: K.gold })
    for (let j = 0; j < stack[i][1].length; j++) s.addImage({ data: await icon(stack[i][1][j][0], stack[i][1][j][1]), x: x + 1.1 + j * 0.25, y: 5.98, w: 0.21, h: 0.21, altText: 'logo', objectName: `st${i}${j}` })
    T(s, stack[i][2], { x, y: 6.24, w: 2.02, h: 0.74, fontSize: 10 })
  }

  // ================================================================ 6 · FEATURES & USP BY PERSONA
  pres.addSection({ title: 'Features' })
  s = pres.addSlide({ masterName: 'VINT', sectionTitle: 'Features' })
  head(s, 'FEATURES AND USP, PERSONA BY PERSONA', 'Six seats, one data model: what each person gets, and what nobody else offers')
  const per = [
    ['PRIYA · KAM (rep)', 'blue', 'inbox.jpg', ['**Mission inbox:** 10 actions ranked by cost of delay', '**Account twin** across all 5 divisions', '**Whisper capture:** WhatsApp line → routed lead', '**Deal desk + credit** check before quoting', '**Pitch** in 5 Indian languages', '**Moment:** accepts TechNova in one tap']],
    ['ARJUN · Channel (rep)', 'green', 'beat.jpg', ['**Beat plan:** value-first stops, 2-opt route', '**Territory twin:** OSM schools & hospitals', '**30% assist credit** on cross-division wins', '**Scheme slab alerts:** ₹ to next rebate', '**Team hub:** leaderboard, commission sim', '**Moment:** paid for helping on a deal']],
    ['RAKESH · Sales head', 'red', 'command.jpg', ['**Command center:** national pipeline', '**SLA ladder L1–L4:** nothing goes stale', '**Pilot lab:** treatment vs control, CI', '**BI & forecast** to the FY29 goal', '**Security & audit** of every action', '**Moment:** scale or stop at month 6']],
    ['MEERA · Architect', 'orange', 'sitetwin.jpg', ['**Solution composer:** 11 blueprints', '**3D site twin:** owned solid, gaps glow', '**BOM + value-at-stake** + 3-yr annuity', '**Upfront or monthly** (Device-as-a-Service)', '**Signed proposal link** to the partner', '**Moment:** a full classroom in one click']],
    ['NEHA · Data steward', 'purple', 'trust.jpg', ['**Data unifier:** GSTIN → PAN → fuzzy', '**Steward queue** for unsure merges', '**Data trust:** DQ score, PSI drift', '**Model lab + learning loop**', '**DPDP:** consent, erasure, masking', '**Moment:** 1,698 records → 600 partners']],
    ['VIKRAM · Partner', 'navy', 'sitetwin.jpg', ['**My proposals:** one link, whole solution', '**One CNL contact** instead of four', '**Accept on phone,** PO follows', '**Monthly option** eases his cash', '**No new portal** or password', '**Moment:** whole solution, one contact']],
  ]
  for (let i = 0; i < 6; i++) {
    const [t, col, f, pts] = per[i]
    const x = 0.3 + i * 2.13
    hp(s, x, 1.14, 2.06, 3.46, t, col, 'per' + i)
    shot(s, f, x + 0.08, 1.58, 1.9, 0.78, t)
    fill(s, pts, x + 0.05, 2.4, 1.98, 2.18, { fontSize: 9.8, col: K[col] })
  }
  hp(s, 0.3, 4.7, 8.4, 2.3, 'USP: 7 things only Constella combines', 'navy', 'seven')
  ;[
    ['Solution-gap detection', 'vs SKU add-ons', 'missing pieces of 11 blueprints, in a 3D twin'],
    ['Cash-aware ranking', 'vs revenue-only', 'P × margin × cash velocity × credit + annuity'],
    ['Split-credit routing', 'vs silos', 'lead + assists, 70/30 credit, overlap merge'],
    ['SLA escalation ladder', 'vs lost leads', 'nudge 48 h → reassign → head → nurture'],
    ['Proof built in', 'vs claims', '20% control group; gates at months 2-3-4-6'],
    ['Open-data demand', 'vs guesswork', 'schools & hospitals near each partner (OSM)'],
    ['India-ready by design', 'vs retrofits', 'GSTIN check digit, DPDP consent & erasure'],
  ].forEach(([a, vs, d], i) => {
    const col = i === 6 ? 0 : i % 2, row = Math.floor(i / 2)
    const x = i === 6 ? 2.5 : 0.42 + col * 4.15, y = 5.13 + row * 0.46
    s.addShape(pres.shapes.OVAL, { x, y: y + 0.04, w: 0.32, h: 0.32, fill: { color: K.navy }, line: { color: K.navy, width: 0 }, objectName: 'n' + i })
    T(s, String(i + 1), { x, y: y + 0.04, w: 0.32, h: 0.32, fontSize: 10.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    T(s, [{ text: a + '  ', options: { bold: true, color: K.navy } }, { text: vs, options: { bold: true, color: K.red, fontSize: 9.5 } }], { x: x + 0.4, y, w: 3.65, h: 0.23, fontSize: 10.5 })
    T(s, d, { x: x + 0.4, y: y + 0.22, w: 3.65, h: 0.22, fontSize: 9.5, color: K.grey })
  })
  hp(s, 8.8, 4.7, 4.23, 2.3, 'Proof it will work', 'purple', 'proof')
  ;[['8 / 8', 'capabilities; nearest rival 2'], ['1.5×', 'GP vs popularity'], ['+53%', 'revenue vs control'], ['99.2%', 'match precision']].forEach(([n, l], i) => {
    const x = 8.9 + i * 1.03
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.14, w: 0.98, h: 0.84, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.purple, width: 1 }, objectName: 'pt' + i })
    T(s, n, { x, y: 5.16, w: 0.98, h: 0.38, fontSize: 15.5, bold: true, fontFace: 'Rockwell', color: K.purple, align: 'center', valign: 'middle' })
    T(s, l, { x: x + 0.04, y: 5.54, w: 0.9, h: 0.42, fontSize: 8, align: 'center' })
  })
  fill(s, ['**Live today:** every feature above is clickable on the deployed app.', '**One data model:** six roles, so adoption needs no new system for partners.'], 8.92, 6.04, 4.04, 0.94, { fontSize: 10, col: K.purple })

  // ================================================================ 7 · PROTOTYPE WALKTHROUGH
  pres.addSection({ title: 'Walkthrough' })
  s = pres.addSlide({ masterName: 'VINT', sectionTitle: 'Walkthrough' })
  head(s, 'PROTOTYPE WALKTHROUGH', 'One opportunity, end to end, through the people who use it: TechNova’s Smart Classroom')
  const steps = [
    ['1 · 09:00 · PRIYA GETS THE SIGNAL', 'blue', 'inbox.jpg', 'Mission inbox', [
      'At 9:00 Priya’s **WhatsApp brief** and inbox list ten actions, ordered by what delay would cost.',
      'TechNova Systems is flagged because a **recent conversation** points to an active project.',
      'Any pasted WhatsApp line is read for **intent, quantity and timing**, then routed.',
      'Her idle pipeline costs about **₹39,813 a day**, so the most valuable work comes first.']],
    ['2 · PRIYA OPENS THE ACCOUNT TWIN', 'purple', 'accounttwin.jpg', 'Account twin', [
      'The twin joins TechNova’s buying from **all five divisions**: ₹3.8 L, only 1% of a ~₹3.3 Cr tech budget.',
      'About **₹3.3 Cr leaks** to other distributors; credit headroom is ₹15 L at 52 pay days.',
      'The model lists what it may buy next, with **peer adoption**: cabling 19%, connectivity 17%.',
      'Its **Smart Classroom is 67% owned**, so the missing pieces are named, not guessed.']],
    ['3 · MEERA COMPLETES THE SOLUTION', 'orange', 'sitetwin.jpg', 'Site twin', [
      'Meera opens the **3D site twin**: owned devices are solid, missing ones glow.',
      'One of **11 blueprints** turns the gap into a bill of materials with value-at-stake and a 3-year AMC.',
      'The **deal desk** checks margin floors before any discount goes out.',
      'Vikram, the partner, receives **one signed proposal link** for the whole room.']],
    ['4 · RAKESH SEES IT ROUTED', 'red', 'command.jpg', 'Command center', [
      'The router names **Priya as lead and Arjun (FMSG) as assist**, with 70/30 split credit.',
      'If nobody moves, the **SLA ladder** nudges at 48 h, reassigns, alerts the head, then nurtures.',
      'Rakesh sees **₹41.7 Cr of open pipeline** and 1,014 cross-division deals in flight.',
      'From **1,436 assigned to 216 won** (57%); rep capacity is balanced automatically.']],
    ['5 · PRIYA & ARJUN IN THE FIELD', 'green', 'beat.jpg', 'Beat plan', [
      'The **beat plan** orders visits by value on a satellite map and optimises the route.',
      'The **territory twin** shows schools and hospitals near each partner, from OpenStreetMap.',
      'Asked “what next for TechNova?”, the **voice copilot** answers in plain words.',
      'The **collections worklist** uses a pay-date model to say whom to call first.']],
    ['6 · RAKESH & NEHA PROVE IT', 'navy', 'pilot.jpg', 'Pilot lab', [
      'Against a randomised control group, revenue per partner reaches **₹719K vs ₹471K** by month 6 (+53%).',
      'Neha’s **data trust** screen keeps GSTIN-matched records clean and watches for drift.',
      'New orders and rep ratings **re-score partners live**; a worse model is never promoted.',
      'At month 6 a rule **written before the pilot** decides: scale, extend or stop.']],
  ]
  for (let i = 0; i < 6; i++) {
    const [t, col, f, cap, pts] = steps[i]
    const x = 0.3 + (i % 3) * 4.28, y = 1.14 + Math.floor(i / 3) * 2.95
    hp(s, x, y, 4.18, 2.88, t, col, 'step' + i)
    shot(s, f, x + 0.1, y + 0.47, 1.72, 2.32, cap)
    fill(s, pts, x + 1.9, y + 0.46, 2.22, 2.38, { fontSize: 9.4, col: K[col] })
    if (i % 3 < 2) arrow(s, x + 4.18, y + 0.19, x + 4.28, y + 0.19, K.ink, 'stepar' + i)
  }

  // ================================================================ 8 · IMPACT AND BENEFITS
  pres.addSection({ title: 'Impact' })
  s = pres.addSlide({ masterName: 'VINT', sectionTitle: 'Impact' })
  head(s, 'IMPACT AND BENEFITS', 'Worked out on the running prototype and a control-group simulation, not on promises')
  const pm = scorecard.pilot_monthly
  const cards = [
    ['PILOT · revenue per partner', 'red', 'With Constella ₹719K vs ₹471K without by month 6 (+53%), measured against a randomised control group.'],
    ['VALUE RANKING · GP captured', 'orange', 'Ranking by value puts 78.7% of next-120-day gross profit in each partner’s top 5, vs 51.4% for popularity.'],
    ['UPLIFT vs CONTROL · 6 months', 'blue', `Cross-sell +${pct('cross_sell_rate')}%, solution attach +${pct('solution_attach_rate')}%, annuity ARR +${pct('arr_per_account')}%, GP +${pct('gp_per_account')}%, revenue +${pct('revenue_per_account')}% per treated partner.`],
    ['PS METRIC · revenue per partner', 'green', 'Monthly revenue per active partner and divisions per partner: the two numbers the brief asks to grow.'],
  ]
  for (let i = 0; i < 4; i++) {
    const x = 0.3 + i * 3.21
    hp(s, x, 1.14, 3.12, 2.68, cards[i][0], cards[i][1], 'card' + i)
    T(s, cards[i][2], { x: x + 0.1, y: 3.12, w: 2.92, h: 0.66, fontSize: 9.5 })
  }
  s.addChart(pres.charts.LINE, [
    { name: 'With Constella', labels: pm.map((m) => 'M' + m.month), values: pm.map((m) => Math.round(m.treatment / 1000)) },
    { name: 'Without', labels: pm.map((m) => 'M' + m.month), values: pm.map((m) => Math.round(m.control / 1000)) },
  ], { x: 0.35, y: 1.54, w: 3.02, h: 1.56, ...chartBase(''), chartColors: [K.red, 'A89A88'], lineSize: 2.25, lineDataSymbolSize: 4, showLegend: true, legendPos: 't', objectName: 'c1' })
  s.addChart(pres.charts.BAR, [{ name: 'GP capture', labels: ['Popularity', 'Probability', 'Constella value'], values: [51.4, 45.1, 78.7] }], { x: 3.56, y: 1.54, w: 3.02, h: 1.56, barDir: 'col', ...chartBase(''), chartColors: ['A89A88', 'D9C7AE', K.orange], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 9, dataLabelFontFace: 'Calibri', dataLabelColor: K.ink, dataLabelFormatCode: '0"%"', valAxisMaxVal: 100, objectName: 'c2' })
  s.addChart(pres.charts.BAR, [{ name: 'Uplift', labels: ['Cross-sell', 'Solution', 'Annuity', 'GP', 'Revenue'], values: ['cross_sell_rate', 'solution_attach_rate', 'arr_per_account', 'gp_per_account', 'revenue_per_account'].map((k) => kp[k].uplift_pct) }], { x: 6.77, y: 1.54, w: 3.02, h: 1.56, barDir: 'col', ...chartBase(''), chartColors: [K.blue, K.purple, K.green, K.orange, K.red], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 9, dataLabelFontFace: 'Calibri', dataLabelColor: K.ink, dataLabelFormatCode: '0"%"', valAxisMaxVal: 60, objectName: 'c3' })
  const rpc = scorecard.revenue_per_customer.slice(-12)
  s.addChart(pres.charts.BAR, [{ name: 'Revenue per partner (₹K)', labels: rpc.map((r) => r.month.slice(5)), values: rpc.map((r) => Math.round(r.rev_per_customer / 1000)) }], { x: 9.98, y: 1.54, w: 3.02, h: 1.56, barDir: 'col', ...chartBase(''), chartColors: [K.green], showLegend: false, catAxisLabelFontSize: 7.5, objectName: 'c4' })
  const dims4 = [
    [fa.FaRupeeSign, 'ECONOMIC', 'blue', '₹41.7 Cr of pipeline and ₹21.0 Cr of annuity found across 600 partners; break-even below a 0.5% wallet gain.'],
    [fa.FaHandsHelping, 'SOCIAL', 'green', 'Schools and hospitals get complete solutions (classrooms, safety); SI partners grow with one proposal.'],
    [fa.FaLeaf, 'ENVIRONMENTAL', 'orange', 'Routed beat plans save ~40–54 km a rep a day; annuity extends device life through AMCs.'],
    [fa.FaMicrochip, 'TECHNOLOGICAL', 'purple', 'Explainable, audit-logged, CPU-only AI on open data; reusable for CNL’s Middle-East and SAARC entities.'],
  ]
  for (let i = 0; i < 4; i++) {
    const x = 0.3 + i * 3.21
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.9, w: 3.12, h: 0.98, rectRadius: 0.05, fill: { color: TINT[dims4[i][2]] }, line: { color: K[dims4[i][2]], width: 1 }, objectName: 'dim' + i })
    s.addImage({ data: await icon(dims4[i][0], K[dims4[i][2]]), x: x + 0.1, y: 3.98, w: 0.28, h: 0.28, altText: dims4[i][1], objectName: 'dimi' + i })
    T(s, dims4[i][1], { x: x + 0.46, y: 3.97, w: 2.5, h: 0.3, fontSize: 12, bold: true, color: K[dims4[i][2]], valign: 'middle' })
    T(s, dims4[i][3], { x: x + 0.1, y: 4.3, w: 2.95, h: 0.56, fontSize: 9.5 })
  }
  const sh = [[fa.FaUserTie, 'Sales reps', '10 ranked actions a day'], [fa.FaChartLine, 'Sales head', 'one pipeline, SLA view'], [fa.FaHandshake, 'Partners', 'one proposal, monthly option'], [fa.FaCoins, 'Finance', 'cash-aware deals, DSO'], [fa.FaTags, 'Brand principals', 'whitespace by brand'], [fa.FaBuilding, 'Leadership', 'growth without headcount']]
  for (let i = 0; i < 6; i++) {
    const x = 0.3 + i * 2.13
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.96, w: 2.06, h: 0.5, rectRadius: 0.05, fill: { color: TINT.green }, line: { color: K.green, width: 1 }, objectName: 'sh' + i })
    s.addImage({ data: await icon(sh[i][0], K.green), x: x + 0.08, y: 5.07, w: 0.28, h: 0.28, altText: sh[i][1], objectName: 'shi' + i })
    T(s, [{ text: sh[i][1], options: { bold: true, breakLine: true } }, { text: sh[i][2], options: { color: '5A4A3A', fontSize: 8 } }], { x: x + 0.42, y: 4.96, w: 1.62, h: 0.5, fontSize: 9.5, valign: 'middle' })
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.3, y: 5.54, w: 4.3, h: 1.47, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.navy, width: 1.25 }, objectName: 'funnel panel' })
  T(s, 'HOW ONE OPPORTUNITY IS MADE', { x: 0.42, y: 5.58, w: 4.1, h: 0.25, fontSize: 10.5, bold: true, color: K.navy })
  ;[['21,600', 'pairs scored', 'blue'], ['4,040', 'signals', 'orange'], ['1,794', 'opportunities', 'green'], ['10', 'for Priya today', 'red']].forEach(([v, l, c], i) => {
    const x = 0.42 + i * 1.03
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.88, w: 0.95, h: 0.78, rectRadius: 0.06, fill: { color: K[c] }, line: { color: K[c], width: 0 }, objectName: 'f' + i })
    T(s, [{ text: v, options: { bold: true, fontSize: 15, breakLine: true } }, { text: l, options: { fontSize: 8.5 } }], { x, y: 5.88, w: 0.95, h: 0.78, color: 'FFFFFF', align: 'center', valign: 'middle' })
    if (i < 3) arrow(s, x + 0.95, 6.27, x + 1.03, 6.27, K.ink, 'fa' + i)
  })
  T(s, '600 partners × 36 categories → value-ranked → routed', { x: 0.42, y: 6.7, w: 4.1, h: 0.25, fontSize: 9, italic: true, color: K.grey, align: 'center' })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.7, y: 5.54, w: 4.3, h: 1.47, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.navy, width: 1.25 }, objectName: 'ba panel' })
  T(s, 'BEFORE vs AFTER (per partner, 6 months)', { x: 4.82, y: 5.58, w: 4.1, h: 0.25, fontSize: 10.5, bold: true, color: K.navy })
  const rate = (v) => `${(v * (v <= 1 ? 100 : 1)).toFixed(1)}%`, lakh = (v) => `₹${(v / 1e5).toFixed(2)} L`
  const bh = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: K.navy } } })
  const ba = [
    ['Cross-sell rate', rate(kp.cross_sell_rate.control.mean), rate(kp.cross_sell_rate.treatment.mean), `+${pct('cross_sell_rate')}%`],
    ['Solution attach', rate(kp.solution_attach_rate.control.mean), rate(kp.solution_attach_rate.treatment.mean), `+${pct('solution_attach_rate')}%`],
    ['Annuity ARR', lakh(kp.arr_per_account.control.mean), lakh(kp.arr_per_account.treatment.mean), `+${pct('arr_per_account')}%`],
    ['Signal → owner', 'days', '~3 min', '≈100×'],
  ]
  s.addTable([[bh('Metric'), bh('Before'), bh('After'), bh('Δ')], ...ba.map((r) => r.map((c, j) => ({ text: c, options: { bold: j === 3, color: j === 3 ? K.green : K.ink } })))],
    { x: 4.82, y: 5.86, w: 4.06, colW: [1.45, 0.85, 0.95, 0.81], rowH: 0.22, fontSize: 9.5, fontFace: 'Trebuchet MS', border: { type: 'solid', color: 'E6DCCD', pt: 0.5 }, valign: 'middle', margin: 0.03, objectName: 'ba table' })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.1, y: 5.54, w: 3.93, h: 1.47, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.purple, width: 1.25 }, objectName: 'why panel' })
  T(s, 'WHY NOT JUST RANK BY POPULARITY?', { x: 9.22, y: 5.58, w: 3.75, h: 0.25, fontSize: 10.5, bold: true, color: K.purple })
  fill(s, ['Both rankings hit the same rate: **precision@5 0.177 vs 0.182**, an honest tie.', 'Value ranking captures **1.5× the gross profit**: 78.7% against 51.4%.', 'Decisions weigh **margin, cash cycle and credit**, not volume alone.', 'Each score ships with **reason codes** a rep can read.'], 9.22, 5.86, 3.78, 1.13, { fontSize: 8.3, col: K.purple })

  // ================================================================ 9 · FEASIBILITY & VIABILITY (35:35:30)
  pres.addSection({ title: 'Feasibility' })
  s = pres.addSlide({ masterName: 'VINT', sectionTitle: 'Feasibility' })
  head(s, 'FEASIBILITY AND VIABILITY', 'Running live today · pilot-ready · every risk has a named shield')
  hp(s, 0.3, 1.14, 4.45, 4.95, 'Analysis of the feasibility of the idea', 'blue', 'feas')
  const fe = [
    [fa.FaMicrochip, 'TECHNICAL', 'live on the web', '**Live today** on Vercel + Render free tier: ~258 MB RAM, 1 CPU, no GPU; starts in ~3 s and fully retrains in 8–20 s. **46 endpoints × 5 roles and 18 end-to-end flows** tested.'],
    [fa.FaDatabase, 'DATA', 'pilot-ready', 'Needs only **invoice lines + customer master** from SAP B1, Tally or Excel. GSTIN → PAN → fuzzy matching unifies **1,698 records into 600 partners at 99.2% precision**, with DQ and drift checks.'],
    [fa.FaUsers, 'OPERATIONAL', 'fits today', 'Reps work from a **9:00 WhatsApp brief and one-tap accept**; partners need no new portal. **70/30 split credit** pays assists, the L1–L4 ladder chases stale leads, **66% of follow-up runs itself**.'],
    [fa.FaShieldAlt, 'COMPLIANCE', 'audit-ready', '**DPDP Act 2023** consent, purpose and erasure; role-based PII masking; **append-only audit log** on every action; GSTIN check-digit validation; deal-desk approval before any discount.'],
    [fa.FaCalendarAlt, 'SCHEDULE', '6-month pilot', '**2 branches, 20% control group.** M0 connect ERPs · M2 adoption gate · M3 signal gate · M4 revenue gate · **M6 scale or stop** by a rule written down before day one.'],
  ]
  for (let i = 0; i < 5; i++) {
    const y = 1.58 + i * 0.9
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y, w: 4.25, h: 0.86, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.line, width: 0.75 }, objectName: 'fe ' + i })
    await dot(s, fe[i][0], 0.47, y + 0.07, 0.4, K.blue, fe[i][1])
    T(s, fe[i][1], { x: 0.95, y: y + 0.05, w: 1.7, h: 0.26, fontSize: 11.5, bold: true, color: K.blue, valign: 'middle' })
    pill(s, fe[i][2], 3.17, y + 0.06, 1.4, 'blue')
    T(s, rich(fe[i][3]), { x: 0.95, y: y + 0.31, w: 3.66, h: 0.54, fontSize: 8.5 })
  }
  hp(s, 4.85, 1.14, 4.45, 4.95, 'Analysis of the viability of the idea', 'orange', 'via')
  const vi = [
    [fa.FaRupeeSign, 'ECONOMIC', '< 0.5%', '**Break-even below a 0.5% wallet-share gain.** At a 1% gain: **₹17.7 Cr revenue and ₹1.42 Cr GP a year** against a ~₹0.4 Cr pilot; every lead is ranked by margin, cash and credit.'],
    [fa.FaChessKnight, 'STRATEGIC FIT', '₹6,000 Cr', 'Serves CNL’s **₹6,000 Cr FY29 goal** and 40% licensed-brand mix; sells whole SI solutions (Infinova, Ravel, Super Micro) and **grows annuity from ~1.1% of revenue**.'],
    [fa.FaGlobeAsia, 'MARKET', 'USD 15–21 B', '**India IT hardware market, 2025.** The top distributors hold ~70% of it and are moving to AI-led selling and recurring services, so **the window is now**.'],
    [fa.FaCoins, 'COST & SCALE', '66%', '**Workflow automated: growth without matching headcount.** CPU-only cloud at ~₹1–2 L a month for 31 branches; the same code moves from SQLite to PostgreSQL.'],
    [fa.FaUndo, 'PAYBACK', '3–4 mo', 'At a 1% gain **the pilot pays back in about a quarter.** If the stop rule fires, CNL still **keeps the unified partner data layer** and a clean ERP feed.'],
  ]
  for (let i = 0; i < 5; i++) {
    const y = 1.58 + i * 0.9
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.95, y, w: 4.25, h: 0.86, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: 'E6CFA8', width: 0.75 }, objectName: 'vi ' + i })
    await dot(s, vi[i][0], 5.02, y + 0.07, 0.4, K.orange, vi[i][1])
    T(s, vi[i][1], { x: 5.5, y: y + 0.05, w: 1.8, h: 0.26, fontSize: 11.5, bold: true, color: K.orange, valign: 'middle' })
    T(s, vi[i][2], { x: 7.3, y: y + 0.02, w: 1.82, h: 0.3, fontSize: 14.5, bold: true, fontFace: 'Rockwell', color: K.orange, align: 'right', valign: 'middle' })
    T(s, rich(vi[i][3]), { x: 5.5, y: y + 0.31, w: 3.66, h: 0.54, fontSize: 8.5 })
  }
  hp(s, 9.4, 1.14, 3.63, 4.95, 'Risks and shields', 'red', 'risks')
  s.addChart(pres.charts.DOUGHNUT, [{ name: 'risks', labels: ['Data quality', 'Adoption', 'Model drift', 'Privacy', 'Discounting', 'Synthetic gap', 'API limits'], values: [1, 1, 1, 1, 1, 1, 1] }], { x: 9.55, y: 1.54, w: 1.75, h: 1.75, holeSize: 50, chartColors: ['A8462E', 'C0674A', '8E3A25', 'B9785A', '9C4A2F', 'CF8B6A', 'A8462E'], showLegend: false, showValue: false, showPercent: false, showLabel: false, showTitle: false, dataBorder: { pt: 1.5, color: 'FFFFFF' }, objectName: 'risk wheel' })
  s.addShape(pres.shapes.OVAL, { x: 10.07, y: 2.06, w: 0.71, h: 0.71, fill: { color: K.green }, line: { color: 'FFFFFF', width: 2 }, objectName: 'shield core' })
  T(s, 'SAFE TO\nPILOT', { x: 10.07, y: 2.06, w: 0.71, h: 0.71, fontSize: 7.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
  T(s, [{ text: '7 risks, 7 shields', options: { bold: true, color: K.red, fontSize: 12, breakLine: true } }, { text: 'Every risk a judge can name already has a built-in answer, tested in the live prototype, and a person who owns it in the pilot.', options: { fontSize: 9.5 } }], { x: 11.35, y: 1.59, w: 1.6, h: 1.65, valign: 'middle' })
  ;[['Data quality', 'GSTIN/PAN match, DQ score, steward queue'], ['Rep adoption', 'WhatsApp-first, one tap, split credit pays assists'], ['Model drift', 'PSI monitor, retrain, champion/challenger'], ['Privacy (DPDP)', 'consent, erasure, purpose limits, PII masking'], ['Over-discounting', 'deal-desk approval matrix with margin floors'], ['Synthetic → real gap', 'control group + written scale-or-stop rule'], ['Free-tier limits', 'lite mode, build-time bake, keep-alive']].forEach(([r, shd], i) => {
    const y = 3.34 + i * 0.385
    s.addShape(pres.shapes.OVAL, { x: 9.5, y: y + 0.07, w: 0.24, h: 0.24, fill: { color: K.red }, line: { color: K.red, width: 0 }, objectName: 'rn' + i })
    T(s, String(i + 1), { x: 9.5, y: y + 0.07, w: 0.24, h: 0.24, fontSize: 8, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    T(s, [{ text: r, options: { bold: true, color: K.red, breakLine: true } }, { text: 'Shield: ' + shd }], { x: 9.8, y, w: 3.18, h: 0.38, fontSize: 8.8, valign: 'middle' })
  })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.3, y: 6.15, w: 6.2, h: 0.88, rectRadius: 0.05, fill: { color: K.navy }, line: { color: K.navy, width: 0 }, objectName: 'verify' })
  T(s, 'VERIFY IT\nYOURSELF', { x: 0.36, y: 6.15, w: 1.1, h: 0.88, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
  const vq = [[LIVE, 'Live app'], [API, 'API docs'], [GH, 'Code'], [GH + '/blob/main/docs/DEPLOY.md', 'Deploy']]
  for (let i = 0; i < 4; i++) {
    const x = 1.55 + i * 1.23
    s.addShape(pres.shapes.RECTANGLE, { x, y: 6.2, w: 0.62, h: 0.62, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF', width: 0 }, objectName: 'vqbg' + i })
    s.addImage({ data: await qr(vq[i][0]), x: x + 0.03, y: 6.23, w: 0.56, h: 0.56, altText: 'QR ' + vq[i][1], objectName: 'vq' + i, hyperlink: { url: vq[i][0] } })
    T(s, vq[i][1], { x: x + 0.66, y: 6.2, w: 0.55, h: 0.62, fontSize: 9, bold: true, color: 'F2C98C', valign: 'middle', hyperlink: { url: vq[i][0] } })
  }
  T(s, 'ADOPTION PATH · low-risk, one step at a time', { x: 6.65, y: 6.14, w: 6.38, h: 0.24, fontSize: 10.5, bold: true })
  chevrons(s, ['1 · LIVE NOW', '2 · PILOT', '3 · SCALE'], 6.65, 6.4, 6.38, 0.32, ['blue', 'orange', 'green'], ['Live: 46 APIs × 5 roles, 18 flows', '2 branches, 20% control, M6 rule', '31+ branches, ERP links, brands'], 0.3)

  // ================================================================ 10 · THANK YOU
  pres.addSection({ title: 'Close' })
  s = pres.addSlide({ masterName: 'VINT', sectionTitle: 'Close' })
  head(s, 'THANK YOU', 'Team Outliers · questions welcome, and a live demo on request')
  hp(s, 0.3, 1.14, 4.4, 3.51, 'What we answered: the five points of PS1', 'blue', 'recap')
  ;[['01', 'Model', 'one golden record per partner from five division ledgers'], ['02', 'Detect', 'solution gaps ranked by margin, cash cycle and credit'], ['03', 'Capture & route', 'one owner, split credit, SLA ladder, 66% automated'], ['04', 'Prototype', '26 screens, 6 roles, twins, maps, voice copilot, live'], ['05', 'Prove', 'randomised pilot with a written scale-or-stop rule']].forEach(([n, a2, b2], i) => {
    const y = 1.6 + i * 0.6
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.42, y, w: 4.16, h: 0.54, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.line, width: 0.75 }, objectName: 'rc' + i })
    s.addShape(pres.shapes.OVAL, { x: 0.5, y: y + 0.08, w: 0.38, h: 0.38, fill: { color: K.blue }, line: { color: K.blue, width: 0 }, objectName: 'rcn' + i })
    T(s, n, { x: 0.5, y: y + 0.08, w: 0.38, h: 0.38, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    T(s, [{ text: a2, options: { bold: true, color: K.blue, fontSize: 11.5, breakLine: true } }, { text: b2, options: { fontSize: 10 } }], { x: 1.0, y: y + 0.02, w: 3.53, h: 0.5, valign: 'middle' })
  })
  hp(s, 4.8, 1.14, 3.9, 3.51, 'Built by Team Outliers', 'purple', 'team')
  const team = ['Swayam Panchal', 'Jeevesh Bodhani', 'Rishit Lahoti', 'Shreyas Kale']
  for (let i = 0; i < 4; i++) {
    const x = 4.92 + (i % 2) * 1.85, y = 1.6 + Math.floor(i / 2) * 1.2
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.78, h: 1.1, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.purple, width: 0.75 }, objectName: 'tm' + i })
    const tini = team[i].split(' ').map((p) => p[0]).join('')
    if (photo(tini)) {
      s.addShape(pres.shapes.OVAL, { x: x + 0.6, y: y + 0.04, w: 0.58, h: 0.58, fill: { color: K.purple }, line: { color: K.purple, width: 0 }, objectName: 'tring' + i })
      s.addImage({ path: photo(tini), x: x + 0.63, y: y + 0.07, w: 0.52, h: 0.52, altText: 'Photo of ' + team[i], objectName: 'tphoto' + i })
    } else await dot(s, fa.FaUserCircle, x + 0.64, y + 0.08, 0.5, K.purple, team[i])
    T(s, team[i], { x: x + 0.04, y: y + 0.62, w: 1.7, h: 0.26, fontSize: 11.5, bold: true, align: 'center', valign: 'middle' })
    T(s, `${WINS[team[i]]}× hackathon winner`, { x: x + 0.04, y: y + 0.86, w: 1.7, h: 0.2, fontSize: 8.5, italic: true, color: K.purple, align: 'center', valign: 'middle' })
  }
  T(s, [{ text: 'Creative Newtech × E-Cell IIT Bombay Hackathon', options: { bold: true, color: K.purple, breakLine: true } }, { text: 'Problem Statement 1 · Beyond Distribution: growing wallet share and solution selling' }], { x: 4.92, y: 4.0, w: 3.66, h: 0.6, fontSize: 9.8, align: 'center', valign: 'middle' })
  hp(s, 8.8, 1.14, 4.23, 3.51, 'Scan to try, read and watch', 'green', 'links')
  const tq = [[LIVE, 'Live prototype', 'green'], [DRIVE, 'Solution document', 'orange'], [DRIVE, 'Prototype video', 'purple'], [GH, 'Source code', 'blue']]
  for (let i = 0; i < 4; i++) {
    const x = 8.92 + (i % 2) * 2.03, y = 1.6 + Math.floor(i / 2) * 1.53
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.96, h: 1.45, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K[tq[i][2]], width: 1.25 }, objectName: 'tqb' + i })
    s.addImage({ data: await qr(tq[i][0]), x: x + 0.5, y: y + 0.08, w: 0.96, h: 0.96, altText: 'QR ' + tq[i][1], objectName: 'tq' + i, hyperlink: { url: tq[i][0] } })
    T(s, tq[i][1], { x, y: y + 1.08, w: 1.96, h: 0.3, fontSize: 10.5, bold: true, color: K[tq[i][2]], align: 'center', valign: 'middle', hyperlink: { url: tq[i][0] } })
  }
  hp(s, 0.3, 4.75, 12.73, 1.75, 'The prototype, live today: six of 26 screens', 'navy', 'gallery')
  ;[['scorecard.jpg', 'PS1 scorecard'], ['territory.jpg', 'Territory twin'], ['sitetwin.jpg', 'Site twin'], ['beat.jpg', 'Beat plan'], ['collections.jpg', 'Collections & cash'], ['learning.jpg', 'Learning loop']].forEach(([f, c], i) => {
    const x = 0.42 + i * 2.1
    shot(s, f, x, 5.19, 2.0, 1.03, c)
    T(s, c, { x, y: 6.23, w: 2.0, h: 0.24, fontSize: 10, bold: true, align: 'center', valign: 'middle' })
  })
  T(s, [{ text: 'One partner. Every division. One view.', options: { bold: true, color: K.gold } }, { text: '   constella-cnl.vercel.app  ·  API: constella-cnl.onrender.com/docs  ·  github.com/SDP42/constella-cnl' }], { x: 0.3, y: 6.56, w: 12.73, h: 0.46, fontSize: 13, italic: true, align: 'center', valign: 'middle' })

  // ================================================================ 11 · MEET TEAM OUTLIERS
  pres.addSection({ title: 'Team' })
  s = pres.addSlide({ masterName: 'VINT', sectionTitle: 'Team' })
  head(s, 'MEET TEAM OUTLIERS', 'Four builders and 34 hackathon wins between us. Reach any of us directly.')
  // Contact details live in team.local.json (git-ignored) so emails and phone numbers never reach the repo.
  const teamFile = path.join(__dirname, 'team.local.json')
  const members = require('fs').existsSync(teamFile) ? require(teamFile) : ['Swayam Panchal', 'Jeevesh Bodhani', 'Rishit Lahoti', 'Shreyas Kale'].map((name, i) => ({
    name, ini: name.split(' ').map((w) => w[0]).join(''), col: ['blue', 'green', 'orange', 'purple'][i], site: 'example.com', gh: 'github', li: 'linkedin.com/in/-', mail: 'add-in-team.local.json', tel: '0000000000' }))
  const fmtTel = (t) => `+91 ${t.slice(0, 5)} ${t.slice(5)}`
  for (let i = 0; i < 4; i++) {
    const m = members[i], c = K[m.col], x = 0.3 + i * 3.21, y = 1.14, w = 3.12
    hp(s, x, y, w, 5.86, m.name.toUpperCase(), m.col, 'member' + i)
    s.addShape(pres.shapes.OVAL, { x: x + w / 2 - 0.55, y: y + 0.45, w: 1.1, h: 1.1, fill: { color: c }, line: { color: 'F2DDBF', width: 2 }, objectName: 'avatar' + i })
    if (photo(m.ini)) s.addImage({ path: photo(m.ini), x: x + w / 2 - 0.5, y: y + 0.5, w: 1.0, h: 1.0, altText: 'Photo of ' + m.name, objectName: 'photo' + i })
    else T(s, m.ini, { x: x + w / 2 - 0.5, y: y + 0.5, w: 1.0, h: 1.0, fontSize: 30, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    T(s, [{ text: m.name, options: { bold: true, fontSize: 15, color: c, breakLine: true } }, { text: 'Team Outliers · Constella', options: { fontSize: 10, italic: true, fontFace: 'Georgia', color: K.grey } }], { x: x + 0.1, y: y + 1.55, w: w - 0.2, h: 0.56, align: 'center', valign: 'middle' })
    const wins = WINS[m.name]
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.45, y: y + 2.13, w: w - 0.9, h: 0.33, rectRadius: 0.16, fill: { color: c }, line: { color: c, width: 0 }, objectName: 'wins' + i })
    s.addImage({ data: await icon(fa.FaTrophy, 'F2DDBF'), x: x + 0.6, y: y + 2.18, w: 0.22, h: 0.22, altText: 'hackathon wins', objectName: 'trophy' + i })
    T(s, [{ text: `${wins}×`, options: { bold: true, fontFace: 'Rockwell', fontSize: 13 } }, { text: '  hackathon winner', options: { fontSize: 10.5 } }], { x: x + 0.86, y: y + 2.13, w: w - 1.4, h: 0.33, color: 'FFFFFF', valign: 'middle' })
    const rows = [
      [fa.FaGlobe, 'Portfolio', m.site, 'https://' + m.site],
      [si.SiGithub, 'GitHub', 'github.com/' + m.gh, 'https://github.com/' + m.gh],
      [fa.FaLinkedin, 'LinkedIn', m.li.replace('linkedin.com/in/', 'in/'), 'https://www.' + m.li],
      [fa.FaEnvelope, 'Email', m.mail, 'mailto:' + m.mail],
      [fa.FaPhoneAlt, 'Mobile', fmtTel(m.tel), 'tel:+91' + m.tel],
    ]
    for (let j = 0; j < 5; j++) {
      const ry = y + 2.54 + j * 0.44
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.1, y: ry, w: w - 0.2, h: 0.4, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: K.line, width: 0.75 }, objectName: `row${i}${j}` })
      s.addImage({ data: await icon(rows[j][0], c), x: x + 0.18, y: ry + 0.08, w: 0.24, h: 0.24, altText: rows[j][1], objectName: `ri${i}${j}` })
      T(s, [{ text: rows[j][1].toUpperCase(), options: { bold: true, fontSize: 7.5, color: c, breakLine: true } }, { text: rows[j][2], options: { fontSize: rows[j][2].length > 34 ? 8.2 : 9.5, hyperlink: { url: rows[j][3] } } }], { x: x + 0.5, y: ry + 0.01, w: w - 0.65, h: 0.38, valign: 'middle' })
    }
    const qy = y + 4.8
    const qrs = [['Portfolio', 'https://' + m.site], ['LinkedIn', 'https://www.' + m.li]]
    for (let k = 0; k < 2; k++) {
      const [lab, url] = qrs[k], qx = x + 0.22 + k * 1.42
      s.addShape(pres.shapes.RECTANGLE, { x: qx, y: qy, w: 1.26, h: 0.8, fill: { color: 'FFFFFF' }, line: { color: c, width: 1 }, objectName: `qbg${i}${k}` })
      s.addImage({ data: await qr(url), x: qx + 0.28, y: qy + 0.05, w: 0.7, h: 0.7, altText: `QR ${lab} ${m.name}`, objectName: `mq${i}${k}`, hyperlink: { url } })
      T(s, 'Scan · ' + lab, { x: qx, y: qy + 0.82, w: 1.26, h: 0.22, fontSize: 9, bold: true, color: c, align: 'center', valign: 'middle' })
    }
  }

  await pres.writeFile({ fileName: OUT })
  console.log('wrote', OUT)
})()
