// Crops team photos into round, face-centred avatars: img/team/<INITIALS>.png (git-ignored, like the contacts).
// Usage: node avatars.js <dir-with-photos>   — crop boxes are [left, top, size] in source pixels.
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const SRC = process.argv[2]
const OUT = path.join(__dirname, 'img', 'team')
fs.mkdirSync(OUT, { recursive: true })
const CROPS = [
  ['1.webp', 'SK', [205, 60, 370]],   // Shreyas
  ['2.webp', 'RL', [262, 110, 290]],  // Rishit
  ['3.png', 'JB', [12, 4, 150]],      // Jeevesh
  ['4.webp', 'SP', [330, 40, 330]],   // Swayam
]
const mask = Buffer.from('<svg width="600" height="600"><circle cx="300" cy="300" r="300" fill="#fff"/></svg>')

;(async () => {
  for (const [file, ini, [left, top, size]] of CROPS) {
    await sharp(path.join(SRC, file))
      .extract({ left, top, width: size, height: size })
      .resize(600, 600)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(OUT, `${ini}.png`))
    console.log('avatar', ini)
  }
})()
