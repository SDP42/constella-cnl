// Recreates the Beige Black Vintage template art: cream ground, tan corner blobs, hand-drawn squiggles, ornament divider.
const sharp = require('sharp')
const path = require('path')
const OUT = (f) => path.join(__dirname, 'img', f)
const CREAM = '#F7EFE6', TAN = '#EFD3B0', INK = '#2B2B2B'

const blobTR = (s) => `<path transform="translate(${1920 - 360 * s},0) scale(${s})" fill="${TAN}" d="M120,0 C150,40 150,70 210,90 C290,115 300,150 240,190 C180,225 170,300 260,330 C300,345 340,345 360,345 L360,0 Z"/>`
const blobBL = (s) => `<path transform="translate(0,${1080 - 400 * s}) scale(${s})" fill="${TAN}" d="M0,0 C30,10 20,60 20,120 C20,170 120,150 180,175 C240,200 200,250 160,290 C130,320 150,370 160,400 L0,400 Z"/>`
const squiggleL = `<path fill="none" stroke="${INK}" stroke-width="2.4" d="M0,330 C60,280 110,270 140,285 C160,300 150,330 135,322 C120,312 140,285 180,282 C260,276 380,300 430,295 C480,290 520,270 560,250"/>`
const squiggleR = `<path fill="none" stroke="${INK}" stroke-width="2.4" d="M1350,620 C1360,665 1420,670 1470,650 C1540,620 1580,560 1640,540 C1680,528 1690,560 1670,568 C1650,575 1650,545 1690,540 C1760,532 1850,536 1920,540"/>`

const svg = (inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="${CREAM}"/>${inner}</svg>`)
const ornament = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="40" viewBox="0 0 1200 40">
<g fill="none" stroke="${INK}" stroke-width="2.2">
<line x1="110" y1="20" x2="560" y2="20"/><line x1="640" y1="20" x2="1090" y2="20"/>
<circle cx="580" cy="20" r="6"/><circle cx="620" cy="20" r="6"/>
<path d="M60,20 L85,9 L110,20 L85,31 Z"/><path d="M45,20 L70,9 L95,20 L70,31 Z"/>
<path d="M1140,20 L1115,9 L1090,20 L1115,31 Z"/><path d="M1155,20 L1130,9 L1105,20 L1130,31 Z"/>
<circle cx="30" cy="20" r="5"/><circle cx="1170" cy="20" r="5"/></g>
<circle cx="600" cy="20" r="10" fill="${INK}"/><circle cx="12" cy="20" r="3.5" fill="${INK}"/><circle cx="1188" cy="20" r="3.5" fill="${INK}"/></svg>`)

;(async () => {
  await sharp(svg(blobTR(1.0) + blobBL(1.0) + squiggleL + squiggleR)).jpeg({ quality: 92 }).toFile(OUT('v_cover.jpg'))
  await sharp(svg(blobTR(0.42) + blobBL(0.32))).jpeg({ quality: 92 }).toFile(OUT('v_content.jpg'))
  await sharp(ornament).png().toFile(OUT('v_ornament.png'))
  console.log('vintage art written')
})()
