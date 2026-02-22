// Generates PWA icons using Puppeteer
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
<svg width="${size * 0.72}" height="${size * 0.72}" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer circle -->
  <circle cx="36" cy="36" r="30" stroke="#818cf8" stroke-width="2.5"/>

  <!-- Cardinal tick marks -->
  <line x1="36" y1="5" x2="36" y2="14" stroke="#818cf8" stroke-width="3" stroke-linecap="round"/>
  <line x1="36" y1="58" x2="36" y2="67" stroke="#818cf8" stroke-width="3" stroke-linecap="round"/>
  <line x1="5" y1="36" x2="14" y2="36" stroke="#818cf8" stroke-width="3" stroke-linecap="round"/>
  <line x1="58" y1="36" x2="67" y2="36" stroke="#818cf8" stroke-width="3" stroke-linecap="round"/>

  <!-- Inner ring -->
  <circle cx="36" cy="36" r="16" stroke="#818cf8" stroke-width="1.2" stroke-opacity="0.45"/>

  <!-- Center diamond -->
  <path d="M36 26 L46 36 L36 46 L26 36 Z" fill="#818cf8" fill-opacity="0.18" stroke="#818cf8" stroke-width="1.6" stroke-linejoin="round"/>

  <!-- Center dot -->
  <path d="M36 32.5 L39.5 36 L36 39.5 L32.5 36 Z" fill="#818cf8"/>
</svg>
</body>
</html>`

async function generate() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()

  for (const size of [192, 512]) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
    await page.setContent(html(size), { waitUntil: 'load' })
    const screenshot = await page.screenshot({ type: 'png' })
    const outPath = join(publicDir, `icon-${size}.png`)
    writeFileSync(outPath, screenshot)
    console.log(`✓ Generated ${outPath}`)
  }

  await browser.close()
  console.log('Done.')
}

generate().catch((e) => { console.error(e); process.exit(1) })
