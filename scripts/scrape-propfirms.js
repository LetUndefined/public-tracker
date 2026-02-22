// Prop Firm Scraper v2 — uses propfirmmatch.com tRPC API via in-browser fetch
// Usage: node scripts/scrape-propfirms.js
//
// API calls run inside Puppeteer (correct cookies/headers)
// Trading rules scraped from firm overview page HTML

import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = resolve(__dirname, '../.env')
const env = {}
try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '')
  }
} catch {
  console.error('Could not read .env file'); process.exit(1)
}

if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1)
}
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ─── tRPC call via browser context (avoids CORS/cookie issues) ───────────────

async function browserTrpc(page, procedure, input) {
  return page.evaluate(async ({ procedure, input }) => {
    // Try non-batch first, then batch format
    const nonBatch = `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    const batchInput = { '0': { json: input } }
    const batch = `/api/trpc/${procedure}?batch=1&input=${encodeURIComponent(JSON.stringify(batchInput))}`

    const errors = []
    for (const url of [nonBatch, batch]) {
      const resp = await fetch(url, { headers: { accept: 'application/json' } })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        errors.push(`${resp.status} @ ${url.slice(0, 80)}: ${text.slice(0, 200)}`)
        continue
      }
      const body = await resp.json()
      if (Array.isArray(body)) return body[0].result.data.json
      return body.result.data.json
    }
    throw new Error('tRPC failed: ' + errors.join(' | '))
  }, { procedure, input })
}

// ─── parsers ──────────────────────────────────────────────────────────────────

function parseProgramTypes(programType) {
  const types = (programType ?? []).map(t => t.toLowerCase().replace(/_/g, ' '))
  const has1 = types.some(t => /\b1\s*step/.test(t))
  const has2 = types.some(t => /\b2\s*step/.test(t))
  const has3 = types.some(t => /\b3\s*step/.test(t))
  const hasI = types.some(t => /\binstant/.test(t))
  return {
    phases: has3 ? 3 : has2 ? 2 : has1 ? 1 : hasI ? 0 : null,
    program_types: [has1 && '1-step', has2 && '2-step', has3 && '3-step', hasI && 'instant'].filter(Boolean).join(','),
  }
}

function parsePlatforms(firmPlatforms) {
  const platforms = firmPlatforms ?? []
  const hasName = (re) => platforms.some(p => re.test(p.name ?? ''))
  const hasIcon = (re) => platforms.some(p => re.test(p.icon?.name ?? ''))
  return {
    mt4:     hasName(/platform\s*4|metatrader\s*4|\bmt4\b/i) || hasIcon(/metatrader-4|mt4/i),
    mt5:     hasName(/platform\s*5|metatrader\s*5|\bmt5\b/i) || hasIcon(/metatrader-5|mt5/i),
    ctrader: hasName(/ctrader/i),
  }
}

function parseChallengeFinancials(challenges) {
  if (!challenges || challenges.length === 0) return {}

// steps field is a string like "1 Step", "2 Steps", "3 Steps"
  const stepCount = (c) => {
    const s = c.steps ?? ''
    const m = String(s).match(/(\d+)/)
    return m ? parseInt(m[1]) : 0
  }

  // Prefer 2-step challenge as representative; fall back to first
  const primary = challenges.find(c => stepCount(c) === 2) ?? challenges[0]

  const toNum = (v) => {
    if (v === null || v === undefined || typeof v === 'boolean') return null
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
    if (isNaN(n)) return null
    return n < 1 ? Math.round(n * 100) : n
  }

  // Drawdown type: API returns "balance_based", "trailing", "equity_based", etc.
  let drawdown_type = null
  const rawDdType = primary.drawdownType ?? primary.drawdownModel ?? primary.ddType ?? null
  if (typeof rawDdType === 'boolean') {
    drawdown_type = rawDdType ? 'trailing' : 'static'
  } else if (typeof rawDdType === 'string') {
    if (/trail/i.test(rawDdType)) drawdown_type = 'trailing'
    else if (/balance|static|eod|equity/i.test(rawDdType)) drawdown_type = 'static'
  }

  // consistencyRule is a direct boolean on the challenge object
  const consistency_rule = typeof primary.consistencyRule === 'boolean'
    ? primary.consistencyRule
    : primary.consistencyRule != null ? Boolean(primary.consistencyRule) : null

  return {
    profit_split_pct:   toNum(primary.profitSplit ?? primary.splitPercentage),
    max_daily_loss_pct: toNum(primary.maxDailyLoss ?? primary.phase1MaxDailyLoss),
    max_total_loss_pct: toNum(primary.maxDrawdown  ?? primary.phase1MaxDrawdown),
    profit_target_p1:   toNum(primary.phase1ProfitTarget ?? primary.profitTargetSum),
    profit_target_p2:   toNum(primary.phase2ProfitTarget),
    drawdown_type,
    consistency_rule,
  }
}

// ─── trading rules from overview page HTML ────────────────────────────────────

async function scrapeTradingRules(page, slug) {
  try {
    await page.goto(`https://propfirmmatch.com/prop-firms/${slug}`, {
      waitUntil: 'networkidle2', timeout: 20000,
    })
    await new Promise(r => setTimeout(r, 1200))

    return page.evaluate(() => {
      const body = document.body.innerText

      function boolFromCtx(keyword, size = 350) {
        const idx = body.toLowerCase().indexOf(keyword.toLowerCase())
        if (idx === -1) return null
        const ctx = body.slice(idx, idx + size).toLowerCase()
        if (/\bnot\s+allow|\bprohibit|\bforbid|\brestrict|\bmust\s+not/.test(ctx)) return false
        if (/\ballowed|\bpermitted|\byes\b|\bno\s+restriction/.test(ctx)) return true
        return null
      }

      let consistency_rule = null
      const csIdx = body.toLowerCase().indexOf('consistency rules')
      if (csIdx !== -1) {
        consistency_rule = !/\bnone\b/i.test(body.slice(csIdx, csIdx + 150))
      }

      return {
        news_trading_allowed: boolFromCtx('News Trading', 400),
        copy_trading_allowed: boolFromCtx('Copy Trading', 300),
        ea_allowed:           boolFromCtx('Expert Advisor') ?? boolFromCtx('Automated Trading'),
        weekend_holding:      boolFromCtx('Weekend', 250),
        overnight_holding:    boolFromCtx('Overnight', 250),
        consistency_rule,
        multiple_accounts:    /multiple\s+accounts?|multi[\s-]account/i.test(body),
      }
    })
  } catch (e) {
    console.warn(`  ⚠ Rules page failed: ${e.message}`)
    return {}
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function scrape() {
  console.log('Launching browser...')
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )
  await page.setViewport({ width: 1440, height: 900 })

  // Navigate to site first so browser has correct cookies/session
  console.log('Loading propfirmmatch.com...')
  await page.goto('https://propfirmmatch.com', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))

  // ── Step 1: fetch all firms via in-browser API call ──
  console.log('Fetching firm list via API...')
  let allFirms = []
  try {
    const resp = await browserTrpc(page, 'firm.listAll', { limit: 100 })
    allFirms = resp.data ?? []
    console.log(`Got ${allFirms.length} firms`)
  } catch (e) {
    console.error('firm.listAll failed:', e.message)
    await browser.close()
    process.exit(1)
  }

  const firms = []

  for (let i = 0; i < allFirms.length; i++) {
    const firm = allFirms[i]
    const { name, slug, id, reviewScore, reviewCount, reviewsCount, totalReviews,
      programType, firmPlatforms, type: firmType,
      assetFxEnabled, assetCryptoEnabled, assetIndicesEnabled, assetMetalsEnabled,
      assetOtherCommoditiesEnabled, assetFuturesEnabled, assetStocksEnabled } = firm

    if (!slug || !name) continue

    // firm.type is the authoritative category: 'futures' means futures prop firm
    // assetFxEnabled can be true for futures firms that trade FX futures contracts
    const isFuturesFirm = firmType === 'futures' || /futures/i.test(firmType ?? '')
    console.log(`[${i + 1}/${allFirms.length}] ${name} (type: ${firmType ?? 'forex'})`)

    const { phases, program_types } = parseProgramTypes(programType)
    const { mt4, mt5, ctrader } = parsePlatforms(firmPlatforms)

    // ── Step 2: challenge financials via API ──
    let financials = {}
    try {
      // Navigate to firm page first so challenge API has the right context
      if (page.url() !== `https://propfirmmatch.com/prop-firms/${slug}`) {
        await page.goto(`https://propfirmmatch.com/prop-firms/${slug}`, {
          waitUntil: 'networkidle2', timeout: 20000,
        })
        await new Promise(r => setTimeout(r, 1000))
      }
      const challengeResp = await browserTrpc(page, 'challenge.listFiltered', { filter: { firmIds: [id] } })
      const challenges = challengeResp.data ?? []
      financials = parseChallengeFinancials(challenges)
    } catch (e) {
      console.warn(`  ⚠ challenge API failed: ${e.message}`)
    }

    // ── Step 3: trading rules from the same page (already loaded) ──
    const rules = await page.evaluate(() => {
      const body = document.body.innerText

      function boolFromCtx(keyword, size = 350) {
        const idx = body.toLowerCase().indexOf(keyword.toLowerCase())
        if (idx === -1) return null
        const ctx = body.slice(idx, idx + size).toLowerCase()
        if (/\bnot\s+allow|\bprohibit|\bforbid|\brestrict|\bmust\s+not/.test(ctx)) return false
        if (/\ballowed|\bpermitted|\byes\b|\bno\s+restriction/.test(ctx)) return true
        return null
      }

      let consistency_rule = null
      const csIdx = body.toLowerCase().indexOf('consistency rules')
      if (csIdx !== -1) {
        consistency_rule = !/\bnone\b/i.test(body.slice(csIdx, csIdx + 150))
      }

      return {
        news_trading_allowed: boolFromCtx('News Trading', 400),
        copy_trading_allowed: boolFromCtx('Copy Trading', 300),
        ea_allowed:           boolFromCtx('Expert Advisor') ?? boolFromCtx('Automated Trading'),
        weekend_holding:      boolFromCtx('Weekend', 250),
        overnight_holding:    boolFromCtx('Overnight', 250),
        multiple_accounts:    /multiple\s+accounts?|multi[\s-]account/i.test(body),
      }
    })

    await new Promise(r => setTimeout(r, 400 + Math.random() * 300))

    // financials.consistency_rule (from API) takes priority over HTML detection
    const row = {
      name,
      website: `https://propfirmmatch.com/prop-firms/${slug}`,
      rating:        reviewScore ?? null,
      reviews_count: reviewCount ?? reviewsCount ?? totalReviews ?? null,
      phases,
      program_types,
      // Use firm.type as the authoritative source for forex vs futures categorisation.
      // assetFxEnabled can be true for futures firms that trade FX futures contracts,
      // which would wrongly show them as forex firms.
      forex:       isFuturesFirm ? false : (assetFxEnabled ?? false),
      crypto:      assetCryptoEnabled   ?? false,
      indices:     assetIndicesEnabled  ?? false,
      commodities: !!(assetMetalsEnabled || assetOtherCommoditiesEnabled),
      futures:     isFuturesFirm ? true : (assetFuturesEnabled ?? false),
      stocks:      assetStocksEnabled   ?? false,
      mt4, mt5, ctrader,
      ...financials,
      ...rules,
      status: 'active',
      last_scraped: new Date().toISOString(),
    }

    firms.push(row)
    console.log(
      `  ✓ phases: ${row.phases ?? '?'} (${row.program_types || '?'}),` +
      ` split: ${row.profit_split_pct ?? '?'}%, dd: ${row.drawdown_type ?? '?'},` +
      ` daily: ${row.max_daily_loss_pct ?? '?'}%, target: ${row.profit_target_p1 ?? '?'}%`
    )
  }

  await browser.close()

  if (firms.length === 0) { console.log('\nNo firms to save.'); return }

  console.log(`\nUpserting ${firms.length} firms to Supabase...`)
  const { error } = await supabase
    .from('prop_firms')
    .upsert(firms, { onConflict: 'name' })

  if (error) console.error('Supabase upsert error:', error)
  else console.log(`✓ Done! ${firms.length} firms saved.`)
}

scrape().catch(console.error)
