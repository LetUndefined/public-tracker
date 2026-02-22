// Generates PWA icons and favicon using Puppeteer
import puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '../public')

const html = (size) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${size}px; height: ${size}px;
    background: #06060b;
    display: flex; align-items: center; justify-content: center;
  }
</style>
</head>
<body>
<svg width="${size * 0.78}" height="${size * 0.78}" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer diamond -->
  <path d="M100 8L192 100L100 192L8 100Z" stroke="#F0B429" stroke-width="6" fill="none"/>
  <!-- Mid diamond -->
  <path d="M100 38L162 100L100 162L38 100Z" fill="#F0B429" fill-opacity="0.08" stroke="#F0B429" stroke-width="2" stroke-opacity="0.3"/>
  <!-- Horizontal scan line -->
  <line x1="18" y1="100" x2="182" y2="100" stroke="#F0B429" stroke-width="1.5" stroke-opacity="0.25"/>
  <!-- Center solid diamond -->
  <path d="M100 82L118 100L100 118L82 100Z" fill="#F0B429"/>
  <!-- Corner ticks -->
  <line x1="100" y1="8"   x2="100" y2="24"  stroke="#F0B429" stroke-width="3" stroke-linecap="round"/>
  <line x1="192" y1="100" x2="176" y2="100" stroke="#F0B429" stroke-width="3" stroke-linecap="round"/>
  <line x1="100" y1="192" x2="100" y2="176" stroke="#F0B429" stroke-width="3" stroke-linecap="round"/>
  <line x1="8"   y1="100" x2="24"  y2="100" stroke="#F0B429" stroke-width="3" stroke-linecap="round"/>
</svg>
</body>
</html>`

async function generate() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()

  // Generate PWA icons
  for (const size of [192, 512]) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
    await page.setContent(html(size), { waitUntil: 'load' })
    const screenshot = await page.screenshot({ type: 'png' })
    const outPath = join(publicDir, `icon-${size}.png`)
    writeFileSync(outPath, screenshot)
    console.log(`✓ Generated ${outPath}`)
  }

  // Generate favicon (32x32)
  await page.setViewport({ width: 32, height: 32, deviceScaleFactor: 1 })
  await page.setContent(html(32), { waitUntil: 'load' })
  const faviconPng = await page.screenshot({ type: 'png' })
  writeFileSync(join(publicDir, 'favicon.png'), faviconPng)
  console.log(`✓ Generated favicon.png`)

  // Write minimal ICO (single 32x32 PNG embedded)
  const ico = buildIco(faviconPng)
  writeFileSync(join(publicDir, 'favicon.ico'), ico)
  console.log(`✓ Generated favicon.ico`)

  await browser.close()
  console.log('Done.')
}

// Wraps a PNG buffer into a valid .ico file
function buildIco(pngBuffer) {
  const size = 32
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)  // reserved
  header.writeUInt16LE(1, 2)  // type: icon
  header.writeUInt16LE(1, 4)  // count: 1 image

  const dirEntry = Buffer.alloc(16)
  dirEntry.writeUInt8(size, 0)     // width
  dirEntry.writeUInt8(size, 1)     // height
  dirEntry.writeUInt8(0, 2)        // color count
  dirEntry.writeUInt8(0, 3)        // reserved
  dirEntry.writeUInt16LE(1, 4)     // planes
  dirEntry.writeUInt16LE(32, 6)    // bit count
  dirEntry.writeUInt32LE(pngBuffer.length, 8)  // image size
  dirEntry.writeUInt32LE(6 + 16, 12)           // image offset

  return Buffer.concat([header, dirEntry, pngBuffer])
}

generate().catch((e) => { console.error(e); process.exit(1) })
