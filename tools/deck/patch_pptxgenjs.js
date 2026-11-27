// pptxgenjs writes a <a:pPr> for every text run, so the LAST run's paragraph properties win and a bullet set on the
// first run of a multi-run line is lost. Write paragraph properties once per paragraph (the valid OOXML form).
const fs = require('fs')
const p = require('path').join(__dirname, 'node_modules/pptxgenjs/dist/pptxgen.cjs.js')
let s = fs.readFileSync(p, 'utf8')
const a = "            strSlideXml += paragraphPropXml.replace('<a:pPr></a:pPr>', ''); // IMPORTANT"
const b = "            if (idx === 0) strSlideXml += paragraphPropXml.replace('<a:pPr></a:pPr>', ''); // patched: one pPr per paragraph. IMPORTANT"
if (s.includes(b)) console.log('pptxgenjs already patched')
else if (s.includes(a)) { fs.writeFileSync(p, s.replace(a, b)); console.log('pptxgenjs patched') }
else throw new Error('pptxgenjs patch anchor not found')
