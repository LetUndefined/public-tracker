<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useChallenges } from '@/composables/useChallenges'
import { useMetaCopier } from '@/composables/useMetaCopier'
import { useMasterToggle } from '@/composables/useMasterToggle'
import { usePageTour } from '@/composables/usePageTour'
import type { MetaCopierTrade } from '@/types'

const { challengeRows } = useChallenges()
const { fetchTrades } = useMetaCopier()
const { includeMaster } = useMasterToggle()

interface ClosedTrade extends MetaCopierTrade {
  accountId: string
  alias: string
}

interface AccountStats {
  id: string
  alias: string
  phase: string
  trades: number
  wins: number
  losses: number
  winRate: number
  netPnl: number
  grossProfit: number
  grossLoss: number
  profitFactor: number
  avgWin: number
  avgLoss: number
  bestTrade: number
  worstTrade: number
}

interface DayPnl {
  date: string
  label: string
  pnl: number
}

interface CalendarDay {
  date: string
  dayOfMonth: number
  pnl: number
  isToday: boolean
  isEmpty: boolean
}

interface CalendarMonth {
  label: string
  weeks: CalendarDay[][]
}

const DAYS_BACK = 1095 // fetch up to 3 years of history

const loading = ref(false)
const accountStats = ref<AccountStats[]>([])
const dailyPnl = ref<DayPnl[]>([])
const allClosedTrades = ref<ClosedTrade[]>([])

// ── Calendar navigation ──────────────────────────────────────
const calendarDate = ref(new Date())

function prevMonth() {
  const d = new Date(calendarDate.value)
  d.setMonth(d.getMonth() - 1)
  calendarDate.value = d
}

function nextMonth() {
  const d = new Date(calendarDate.value)
  d.setMonth(d.getMonth() + 1)
  calendarDate.value = d
}

const canGoNext = computed(() => {
  const now = new Date()
  return (
    calendarDate.value.getFullYear() < now.getFullYear() ||
    calendarDate.value.getMonth() < now.getMonth()
  )
})


const overallStats = computed(() => {
  const stats = accountStats.value
  const trades = stats.reduce((s, a) => s + a.trades, 0)
  const wins   = stats.reduce((s, a) => s + a.wins,   0)
  const losses = stats.reduce((s, a) => s + a.losses, 0)
  const netPnl = stats.reduce((s, a) => s + a.netPnl, 0)
  const grossProfit = stats.reduce((s, a) => s + a.grossProfit, 0)
  const grossLoss   = stats.reduce((s, a) => s + a.grossLoss,   0)

  const best  = allClosedTrades.value.reduce((max, t) => Math.max(max, t.profit ?? 0), 0)
  const worst = allClosedTrades.value.reduce((min, t) => Math.min(min, t.profit ?? 0), 0)
  const recent = dailyPnl.value.slice(-30)
  const bestDay  = recent.reduce((max, d) => Math.max(max, d.pnl), 0)
  const worstDay = recent.reduce((min, d) => Math.min(min, d.pnl), 0)

  return {
    trades,
    wins,
    losses,
    winRate: trades > 0 ? Math.round((wins / trades) * 1000) / 10 : 0,
    netPnl: Math.round(netPnl * 100) / 100,
    profitFactor: grossLoss !== 0
      ? Math.round((grossProfit / Math.abs(grossLoss)) * 100) / 100
      : grossProfit > 0 ? Infinity : 0,
    avgWin:  wins   > 0 ? Math.round((grossProfit / wins)   * 100) / 100 : 0,
    avgLoss: losses > 0 ? Math.round((grossLoss   / losses) * 100) / 100 : 0,
    bestTrade:  Math.round(best  * 100) / 100,
    worstTrade: Math.round(worst * 100) / 100,
    bestDay:    Math.round(bestDay  * 100) / 100,
    worstDay:   Math.round(worstDay * 100) / 100,
    expectancy: trades > 0 ? Math.round(netPnl / trades * 100) / 100 : 0,
  }
})

function buildDateRange(startDate: string): { days: DayPnl[]; dayMap: Record<string, number> } {
  const days: DayPnl[] = []
  const dayMap: Record<string, number> = {}
  const cursor = new Date(startDate + 'T12:00:00')
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  while (cursor <= today) {
    const date = cursor.toISOString().slice(0, 10)
    days.push({
      date,
      label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pnl: 0,
    })
    dayMap[date] = 0
    cursor.setDate(cursor.getDate() + 1)
  }
  return { days, dayMap }
}

async function loadAnalytics() {
  loading.value = true
  try {
    const rows = challengeRows.value
    const allClosed: ClosedTrade[] = []
    const results: AccountStats[] = []

    // Step 1: fetch all trades in parallel
    const tradesByRow = await Promise.all(rows.map(async (row) => {
      if (row.is_master && !includeMaster.value) return { row, sorted: [] }
      const trades = await fetchTrades(row.metacopier_account_id, DAYS_BACK)
      const closed = trades.filter(t => t.close_time !== null)
      const sorted = [...closed].sort((a, b) => (a.close_time ?? '').localeCompare(b.close_time ?? ''))
      return { row, sorted }
    }))

    // Step 2: find earliest trade date to build dynamic range
    let earliestDate = new Date().toISOString().slice(0, 10)
    for (const { sorted } of tradesByRow) {
      for (const t of sorted) {
        const d = (t.close_time ?? '').slice(0, 10)
        if (d && d < earliestDate) earliestDate = d
      }
    }
    const { days, dayMap } = buildDateRange(earliestDate)

    // Step 3: accumulate stats
    for (const { row, sorted } of tradesByRow) {
      if (!sorted.length) continue
      let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0, netPnl = 0
      let bestTrade = 0, worstTrade = 0

      for (const t of sorted) {
        const p = t.profit ?? 0
        netPnl += p
        if (p > 0) { wins++; grossProfit += p; if (p > bestTrade) bestTrade = p }
        else if (p < 0) { losses++; grossLoss += p; if (p < worstTrade) worstTrade = p }
        const day = (t.close_time ?? '').slice(0, 10)
        if (dayMap[day] !== undefined) dayMap[day] += p
        allClosed.push({ ...t, accountId: row.metacopier_account_id, alias: row.alias })
      }

      const total = wins + losses
      results.push({
        id: row.id, alias: row.alias, phase: row.phase,
        trades: total, wins, losses,
        winRate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
        netPnl: Math.round(netPnl * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossLoss: Math.round(grossLoss * 100) / 100,
        profitFactor: grossLoss !== 0 ? Math.round((grossProfit / Math.abs(grossLoss)) * 100) / 100 : grossProfit > 0 ? 999 : 0,
        avgWin: wins > 0 ? Math.round((grossProfit / wins) * 100) / 100 : 0,
        avgLoss: losses > 0 ? Math.round((grossLoss / losses) * 100) / 100 : 0,
        bestTrade: Math.round(bestTrade * 100) / 100,
        worstTrade: Math.round(worstTrade * 100) / 100,
      })
    }

    accountStats.value = results
    allClosedTrades.value = allClosed
    dailyPnl.value = days.map(d => ({ ...d, pnl: Math.round((dayMap[d.date] ?? 0) * 100) / 100 }))
  } finally {
    loading.value = false
  }
}

// ── Day detail modal ─────────────────────────────────────────
const selectedDay = ref<CalendarDay | null>(null)

const selectedDayTrades = computed(() => {
  if (!selectedDay.value?.date) return []
  const date = selectedDay.value.date
  return allClosedTrades.value
    .filter(t => (t.close_time ?? '').slice(0, 10) === date)
    .sort((a, b) => (a.close_time ?? '').localeCompare(b.close_time ?? ''))
})

const selectedDayTotalPnl = computed(() =>
  Math.round(selectedDayTrades.value.reduce((s, t) => s + (t.profit ?? 0), 0) * 100) / 100
)

function openDayModal(day: CalendarDay) {
  if (day.isEmpty || day.pnl === 0) return
  selectedDay.value = day
}

function closeDayModal() {
  selectedDay.value = null
}

function formatModalDate(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
}

function tradeDirection(type: string): 'BUY' | 'SELL' {
  return type.toLowerCase().includes('buy') ? 'BUY' : 'SELL'
}

function fmtTime(dt: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtPrice(p: number | null): string {
  if (p === null) return '—'
  return p.toFixed(5).replace(/\.?0+$/, '')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeDayModal()
}

// Reload when master toggle changes
watch(includeMaster, () => {
  if (challengeRows.value.length > 0) loadAnalytics()
})

const { startPageTour } = usePageTour()

onMounted(() => {
  startPageTour('analytics', [
    {
      title: 'Equity Curve',
      body: 'The chart tracks your account equity over time. Use the account selector to switch between individual challenges or view all at once.',
    },
    {
      title: 'Performance Stats',
      body: 'Win rate, profit factor, average win/loss, and daily P&L breakdown — scroll down to see the full breakdown for your selected account.',
    },
  ])

  window.addEventListener('keydown', handleKeydown)

  // If data is already loaded (navigated from another page), run immediately.
  // Otherwise watch until challengeRows are populated (direct page load).
  if (challengeRows.value.length > 0) {
    loadAnalytics()
  } else {
    const unwatch = watch(
      () => challengeRows.value.length,
      (len) => {
        if (len > 0) {
          unwatch()
          loadAnalytics()
        }
      }
    )
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// ── P&L Calendar heatmap ─────────────────────────────────────
function buildCalendarMonth(year: number, month: number, pnlMap: Record<string, number>): CalendarMonth {
  const today = new Date().toISOString().slice(0, 10)
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = (firstDay.getDay() + 6) % 7 // Mon = 0

  const slots: CalendarDay[] = []

  for (let i = 0; i < firstWeekday; i++) {
    slots.push({ date: '', dayOfMonth: 0, pnl: 0, isToday: false, isEmpty: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    slots.push({
      date,
      dayOfMonth: d,
      pnl: Math.round((pnlMap[date] ?? 0) * 100) / 100,
      isToday: date === today,
      isEmpty: false,
    })
  }
  while (slots.length % 7 !== 0) {
    slots.push({ date: '', dayOfMonth: 0, pnl: 0, isToday: false, isEmpty: true })
  }

  const weeks: CalendarDay[][] = []
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7))

  return {
    label: firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    weeks,
  }
}

const pnlMap = computed(() => {
  const map: Record<string, number> = {}
  for (const d of dailyPnl.value) map[d.date] = d.pnl
  return map
})

const calendarMonth = computed(() =>
  buildCalendarMonth(calendarDate.value.getFullYear(), calendarDate.value.getMonth(), pnlMap.value)
)

// Normalize intensity per-month (so the biggest day in the month = full intensity)
const calendarMaxAbs = computed(() => {
  const vals = calendarMonth.value.weeks
    .flat()
    .filter(d => !d.isEmpty && d.pnl !== 0)
    .map(d => Math.abs(d.pnl))
  return vals.length > 0 ? Math.max(...vals) : 1
})

const activeDays  = computed(() => calendarMonth.value.weeks.flat().filter(d => !d.isEmpty && d.pnl !== 0).length)
const profitDays  = computed(() => calendarMonth.value.weeks.flat().filter(d => !d.isEmpty && d.pnl > 0).length)
const lossDays    = computed(() => calendarMonth.value.weeks.flat().filter(d => !d.isEmpty && d.pnl < 0).length)
const monthlyPnl  = computed(() => {
  const total = calendarMonth.value.weeks.flat().reduce((s, d) => s + (d.isEmpty ? 0 : d.pnl), 0)
  return Math.round(total * 100) / 100
})

function getDayStyle(day: CalendarDay): Record<string, string> {
  if (day.isEmpty || day.pnl === 0) return {}
  const intensity    = Math.min(Math.abs(day.pnl) / calendarMaxAbs.value, 1)
  const bgOpacity    = 0.07 + intensity * 0.46
  const borderOpacity = 0.22 + intensity * 0.60
  const rgb          = day.pnl > 0 ? '0, 212, 170' : '255, 71, 87'
  const result: Record<string, string> = {
    background:  `rgba(${rgb}, ${bgOpacity})`,
    borderColor: `rgba(${rgb}, ${borderOpacity})`,
  }
  if (intensity > 0.25) {
    const g = (intensity - 0.25) / 0.75
    result.boxShadow = `0 2px 16px rgba(${rgb}, ${g * 0.22})`
  }
  return result
}

// ── Bar chart (last 30 days) ─────────────────────────────────
const last30 = computed(() => dailyPnl.value.slice(-30))

const CH = 160
const CP = { l: 56, r: 14, t: 12, b: 30 }
const SVG_W = 700

const barChartData = computed(() => {
  const vals = last30.value.map(d => d.pnl)
  const maxAbs = Math.max(...vals.map(Math.abs), 1)
  const count = vals.length || 1
  const innerW = SVG_W - CP.l - CP.r
  const barW = Math.floor(innerW / count) - 2
  return last30.value.map((d, i) => {
    const x = CP.l + i * (innerW / count) + 1
    const midY = CP.t + CH / 2
    const barH = Math.abs(d.pnl) / maxAbs * (CH / 2 - 8)
    return { ...d, x, barW, barH, y: d.pnl >= 0 ? midY - barH : midY, isPos: d.pnl >= 0, midY }
  })
})

const yLabels = computed(() => {
  const maxAbs = Math.max(...last30.value.map(d => Math.abs(d.pnl)), 1)
  const rounded = Math.ceil(maxAbs / 100) * 100
  const midY = CP.t + CH / 2
  return [-rounded, -rounded / 2, 0, rounded / 2, rounded].map(v => ({
    value: v,
    y: midY - (v / rounded) * (CH / 2 - 8),
  }))
})

const xLabels = computed(() =>
  barChartData.value
    .filter((_, i) => i % 5 === 0 || i === barChartData.value.length - 1)
    .map(d => ({ label: d.label, x: d.x + d.barW / 2 }))
)

// ── Formatting ───────────────────────────────────────────────
function fmtPnl(v: number): string {
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v >= 0 ? `+$${abs}` : `-$${abs}`
}
function fmtY(v: number): string {
  if (v === 0) return '0'
  const sign = v > 0 ? '+' : '-'
  const abs = Math.abs(v)
  return sign + (abs >= 1000 ? `$${(abs / 1000).toFixed(0)}k` : `$${abs}`)
}
function fmtPnlShort(v: number): string {
  const abs = Math.abs(v)
  const sign = v >= 0 ? '+' : '−'
  if (abs >= 10000) return `${sign}${Math.round(abs / 1000)}k`
  if (abs >= 1000)  return `${sign}${(abs / 1000).toFixed(1)}k`
  if (abs >= 10)    return `${sign}$${Math.round(abs)}`
  return `${sign}$${abs.toFixed(1)}`
}
function pfColor(pf: number): string {
  if (pf >= 1.5) return 'var(--green)'
  if (pf >= 1)   return 'var(--accent)'
  return 'var(--red)'
}
function pnlColor(v: number): string { return v >= 0 ? 'var(--green)' : 'var(--red)' }
function wrColor(wr: number, has: boolean): string {
  if (!has) return 'var(--text-tertiary)'
  return wr >= 50 ? 'var(--green)' : 'var(--red)'
}
</script>

<template>
  <div class="analytics-view">

    <!-- ── Banner Header ─────────────────────────────────── -->
    <header class="page-header">
      <div class="header-grid" aria-hidden="true" />

      <div class="header-inner">
        <div class="header-left">
          <div class="header-tag">
            <span class="tag-mark">▸</span>
            PERFORMANCE REPORT
          </div>
          <h1 class="page-title">
            Performance<br />
            <span class="title-accent">Analytics</span>
          </h1>
        </div>

        <div class="header-right">
          <div class="hdr-stat-block">
            <div class="hdr-stat-row">
              <div v-if="loading" class="hdr-spinner" />
              <span class="hdr-big-num accent">{{ overallStats.trades > 0 ? overallStats.trades : '—' }}</span>
            </div>
            <div class="hdr-stat-label">TOTAL TRADES</div>
          </div>

          <div class="hdr-divider" />

          <div class="hdr-stat-block">
            <div class="hdr-stat-row">
              <span class="hdr-big-num" :style="{ color: wrColor(overallStats.winRate, overallStats.trades > 0) }">
                {{ overallStats.trades > 0 ? overallStats.winRate + '%' : '—' }}
              </span>
            </div>
            <div class="hdr-stat-label">WIN RATE</div>
          </div>

          <div class="hdr-divider" />

          <div class="hdr-stat-block hdr-accent">
            <div class="hdr-stat-row">
              <span
                class="hdr-big-num"
                :style="{ color: overallStats.trades > 0 ? pnlColor(overallStats.netPnl) : 'var(--text-tertiary)' }"
              >
                {{ overallStats.trades > 0 ? fmtPnl(overallStats.netPnl) : '—' }}
              </span>
            </div>
            <div class="hdr-stat-label">NET P&amp;L</div>
          </div>
        </div>
      </div>

      <div class="header-meta">
        <span class="period-badge">ALL TIME</span>
        <span class="period-sep">·</span>
        <span class="period-sub">closed positions · all challenges</span>
      </div>
    </header>

    <!-- ── Page body ─────────────────────────────────────── -->
    <div class="page-body">

      <!-- ── Core metrics strip ───────────────────────── -->
      <div class="metric-strip">
        <div class="scan-line" />

        <div class="ms-cell">
          <div class="ms-label">TRADES</div>
          <div class="ms-value accent">{{ overallStats.trades > 0 ? overallStats.trades : '—' }}</div>
          <div class="ms-sub">{{ overallStats.wins }}W · {{ overallStats.losses }}L</div>
        </div>
        <div class="ms-div" />

        <div class="ms-cell">
          <div class="ms-label">WIN RATE</div>
          <div class="ms-value" :style="{ color: wrColor(overallStats.winRate, overallStats.trades > 0) }">
            {{ overallStats.trades > 0 ? overallStats.winRate + '%' : '—' }}
          </div>
          <div class="ms-bar-wrap" v-if="overallStats.trades > 0">
            <div class="ms-bar-track">
              <div class="ms-bar-fill" :style="{ width: overallStats.winRate + '%', background: overallStats.winRate >= 50 ? 'var(--green)' : 'var(--red)' }" />
            </div>
          </div>
          <div class="ms-sub" v-else>closed trades</div>
        </div>
        <div class="ms-div" />

        <div class="ms-cell ms-wide">
          <div class="ms-label">NET P&amp;L</div>
          <div class="ms-value" :style="{ color: pnlColor(overallStats.netPnl) }">
            {{ overallStats.trades > 0 ? fmtPnl(overallStats.netPnl) : '—' }}
          </div>
          <div class="ms-sub">realized</div>
        </div>
        <div class="ms-div" />

        <div class="ms-cell">
          <div class="ms-label">PROFIT FACTOR</div>
          <div class="ms-value" :style="{ color: pfColor(overallStats.profitFactor) }">
            {{ overallStats.trades > 0 ? (overallStats.profitFactor === Infinity ? '∞' : overallStats.profitFactor.toFixed(2)) : '—' }}
          </div>
          <div class="ms-sub">gross P / gross L</div>
        </div>
        <div class="ms-div" />

        <div class="ms-cell">
          <div class="ms-label">R:R RATIO</div>
          <div class="ms-value accent">
            {{ overallStats.avgWin > 0 && overallStats.avgLoss < 0
              ? (overallStats.avgWin / Math.abs(overallStats.avgLoss)).toFixed(2) : '—' }}
          </div>
          <div class="ms-sub">win / loss size</div>
        </div>
      </div>

      <!-- ── Extremes row ──────────────────────────────── -->
      <div class="extremes-row">
        <div class="extreme-card green-card">
          <div class="ec-label">BEST TRADE</div>
          <div class="ec-value green">{{ overallStats.bestTrade > 0 ? fmtPnl(overallStats.bestTrade) : '—' }}</div>
          <div class="ec-sub">single position</div>
        </div>
        <div class="extreme-card red-card">
          <div class="ec-label">WORST TRADE</div>
          <div class="ec-value red">{{ overallStats.worstTrade < 0 ? fmtPnl(overallStats.worstTrade) : '—' }}</div>
          <div class="ec-sub">single position</div>
        </div>
        <div class="extreme-card green-card">
          <div class="ec-label">BEST DAY</div>
          <div class="ec-value green">{{ overallStats.bestDay > 0 ? fmtPnl(overallStats.bestDay) : '—' }}</div>
          <div class="ec-sub">last 30 days · combined</div>
        </div>
        <div class="extreme-card red-card">
          <div class="ec-label">WORST DAY</div>
          <div class="ec-value red">{{ overallStats.worstDay < 0 ? fmtPnl(overallStats.worstDay) : '—' }}</div>
          <div class="ec-sub">last 30 days · combined</div>
        </div>
      </div>

      <!-- ── Daily P&L bar chart ───────────────────────── -->
      <div class="chart-panel">
        <div class="panel-header">
          <div class="panel-header-left">
            <span class="panel-eyebrow">// DAILY P&amp;L</span>
            <span class="panel-sub">Last 30 days · all challenges combined</span>
          </div>
        </div>
        <div v-if="loading" class="chart-loading">
          <div class="spinner" />
        </div>
        <svg v-else class="bar-chart" :viewBox="`0 0 ${SVG_W} ${CP.t + CH + CP.b}`" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="bar-pos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--green)" stop-opacity="0.9"/>
              <stop offset="100%" stop-color="var(--green)" stop-opacity="0.35"/>
            </linearGradient>
            <linearGradient id="bar-neg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--red)" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="var(--red)" stop-opacity="0.9"/>
            </linearGradient>
          </defs>
          <g v-for="lbl in yLabels" :key="lbl.value">
            <line
              :x1="CP.l" :y1="lbl.y" :x2="SVG_W - CP.r" :y2="lbl.y"
              :stroke="lbl.value === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'"
              :stroke-width="lbl.value === 0 ? 1.5 : 1"
            />
            <text :x="CP.l - 8" :y="lbl.y + 4" text-anchor="end" class="axis-label">{{ fmtY(lbl.value) }}</text>
          </g>
          <g v-for="bar in barChartData" :key="bar.date">
            <rect
              :x="bar.x" :y="bar.y"
              :width="bar.barW" :height="Math.max(bar.barH, 1.5)"
              :fill="bar.isPos ? 'url(#bar-pos)' : 'url(#bar-neg)'"
              rx="2"
            />
          </g>
          <g v-for="xl in xLabels" :key="xl.label">
            <text :x="xl.x" :y="CP.t + CH + 20" text-anchor="middle" class="axis-label">{{ xl.label }}</text>
          </g>
        </svg>
      </div>

      <!-- ── P&L Calendar ──────────────────────────────── -->
      <div class="calendar-panel">

        <!-- Panel header: eyebrow + stats -->
        <div class="panel-header">
          <div class="panel-header-left">
            <span class="panel-eyebrow">// P&amp;L CALENDAR</span>
            <span class="panel-sub">Daily performance · non-master accounts</span>
          </div>

          <div class="cal-legend">
            <div class="cal-stat">
              <span
                class="cal-stat-num"
                :style="{ color: activeDays > 0 ? pnlColor(monthlyPnl) : 'var(--text-tertiary)' }"
              >
                {{ activeDays > 0 ? fmtPnl(monthlyPnl) : '—' }}
              </span>
              <span class="cal-stat-lbl">month P&amp;L</span>
            </div>
            <div class="cal-stat-sep" />
            <div class="cal-stat">
              <span class="cal-stat-num green">{{ profitDays }}</span>
              <span class="cal-stat-lbl">profit days</span>
            </div>
            <div class="cal-stat-sep" />
            <div class="cal-stat">
              <span class="cal-stat-num red">{{ lossDays }}</span>
              <span class="cal-stat-lbl">loss days</span>
            </div>
            <div class="cal-stat-sep" />
            <div class="cal-stat">
              <span class="cal-stat-num dim">{{ activeDays }}</span>
              <span class="cal-stat-lbl">active days</span>
            </div>
            <div class="legend-swatches">
              <div class="swatch-group">
                <span class="swatch" style="background: rgba(0,212,170,0.15)" />
                <span class="swatch" style="background: rgba(0,212,170,0.35)" />
                <span class="swatch" style="background: rgba(0,212,170,0.6)" />
                <span class="swatch" style="background: rgba(0,212,170,0.84)" />
                <span class="swatch-label">profit</span>
              </div>
              <div class="swatch-group">
                <span class="swatch" style="background: rgba(255,71,87,0.15)" />
                <span class="swatch" style="background: rgba(255,71,87,0.35)" />
                <span class="swatch" style="background: rgba(255,71,87,0.6)" />
                <span class="swatch" style="background: rgba(255,71,87,0.84)" />
                <span class="swatch-label">loss</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Month navigation bar -->
        <div class="cal-nav-bar">
          <button class="cal-nav-btn" @click="prevMonth" title="Previous month">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7L9 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <div class="cal-nav-label">
            <span class="cal-nav-month-name">{{ calendarMonth.label.split(' ')[0] }}</span>
            <span class="cal-nav-year">{{ calendarMonth.label.split(' ')[1] }}</span>
          </div>

          <button class="cal-nav-btn" @click="nextMonth" :disabled="!canGoNext" title="Next month">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <div v-if="loading" class="cal-loading">
          <div class="spinner" />
        </div>

        <div v-else class="single-calendar">
          <!-- Day-of-week headers -->
          <div class="cal-dow-row">
            <span
              v-for="(d, i) in ['M','T','W','T','F','S','S']"
              :key="i"
              class="cal-dow"
              :class="{ 'cal-dow-weekend': i >= 5 }"
            >{{ d }}</span>
          </div>

          <!-- Weeks -->
          <div class="cal-weeks">
            <div v-for="(week, wi) in calendarMonth.weeks" :key="wi" class="cal-week">
              <div
                v-for="(day, di) in week"
                :key="day.date || `${wi}-${di}`"
                class="cal-day"
                :class="{
                  'cal-empty':       day.isEmpty,
                  'cal-today':       day.isToday,
                  'cal-has-data':    !day.isEmpty && day.pnl !== 0,
                  'cal-zero':        !day.isEmpty && day.pnl === 0,
                  'cal-pos':         !day.isEmpty && day.pnl > 0,
                  'cal-neg':         !day.isEmpty && day.pnl < 0,
                  'cal-clickable':   !day.isEmpty && day.pnl !== 0,
                }"
                :style="getDayStyle(day)"
                :title="!day.isEmpty ? (day.pnl !== 0 ? `${day.date}  ${fmtPnl(day.pnl)}` : `${day.date}  No trades`) : ''"
                @click="openDayModal(day)"
              >
                <template v-if="!day.isEmpty">
                  <span class="cal-day-num">{{ day.dayOfMonth }}</span>
                  <span v-if="day.pnl !== 0" class="cal-day-pnl">{{ fmtPnlShort(day.pnl) }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>


      </div>

    </div><!-- /.page-body -->
  </div>

  <!-- ── Day detail modal ──────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="selectedDay" class="modal-backdrop" @click.self="closeDayModal">
        <div class="day-modal" role="dialog" aria-modal="true">

          <!-- Modal header -->
          <div class="modal-header">
            <div class="modal-header-left">
              <div class="modal-date-tag">
                <span class="modal-tag-mark">▸</span>
                {{ formatModalDate(selectedDay.date) }}
              </div>
              <div class="modal-summary">
                <span
                  class="modal-pnl"
                  :style="{ color: pnlColor(selectedDayTotalPnl) }"
                >{{ fmtPnl(selectedDayTotalPnl) }}</span>
                <span class="modal-trade-sep">·</span>
                <span class="modal-trade-count">{{ selectedDayTrades.length }} trade{{ selectedDayTrades.length !== 1 ? 's' : '' }}</span>
              </div>
            </div>
            <button class="modal-close-btn" @click="closeDayModal" title="Close (Esc)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Column headers -->
          <div class="modal-col-header">
            <span>SYMBOL</span>
            <span>TYPE</span>
            <span>LOTS</span>
            <span class="col-prices">OPEN → CLOSE</span>
            <span class="col-pnl">P&amp;L</span>
          </div>

          <!-- Trade list -->
          <div class="modal-trades">
            <div v-if="selectedDayTrades.length === 0" class="modal-empty">
              No trades found for this day
            </div>
            <div
              v-for="t in selectedDayTrades"
              :key="t.id"
              class="trade-card"
              :class="tradeDirection(t.type) === 'BUY' ? 'trade-buy' : 'trade-sell'"
            >
              <div class="tc-symbol">{{ t.symbol }}</div>
              <div
                class="tc-type"
                :class="tradeDirection(t.type) === 'BUY' ? 'type-buy' : 'type-sell'"
              >{{ tradeDirection(t.type) }}</div>
              <div class="tc-volume">{{ t.volume }}</div>
              <div class="tc-prices col-prices">
                <span class="tc-price">{{ fmtPrice(t.open_price) }}</span>
                <span class="tc-arrow">→</span>
                <span class="tc-price">{{ fmtPrice(t.close_price) }}</span>
              </div>
              <div class="tc-pnl col-pnl" :style="{ color: pnlColor(t.profit ?? 0) }">
                {{ fmtPnl(t.profit ?? 0) }}
              </div>
              <div class="tc-meta">
                <span class="tc-time">{{ fmtTime(t.close_time) }}</span>
                <span class="tc-sep">·</span>
                <span class="tc-acct">{{ t.alias }}</span>
                <template v-if="(t.swap ?? 0) !== 0 || (t.commission ?? 0) !== 0">
                  <span class="tc-sep">·</span>
                  <span class="tc-fees">fees {{ fmtPnl((t.swap ?? 0) + (t.commission ?? 0)) }}</span>
                </template>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── View ──────────────────────────────────────────────────── */
.analytics-view {
  padding: 0;
  max-width: 1440px;
  margin: 0 auto;
  animation: fadeInUp 0.35s var(--ease-out);
}

/* ── Banner Header ─────────────────────────────────────────── */
.page-header {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 32px 28px 28px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-subtle);
  overflow: hidden;
}

.header-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}

.header-grid::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, var(--surface) 0%, transparent 20%, transparent 70%, var(--surface) 100%);
}

.header-inner {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  z-index: 1;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
}

.tag-mark { font-size: 11px; opacity: 0.8; }

.page-title {
  font-family: var(--font-ui);
  font-size: 42px;
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.04em;
  color: var(--text-primary);
  margin: 0;
}

.title-accent { color: var(--accent); }

.header-right {
  display: flex;
  align-items: flex-end;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
}

.hdr-stat-block {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4px;
  padding: 14px 18px;
}

.hdr-accent {
  background: var(--accent-muted);
  border-left: 1px solid rgba(240, 180, 41, 0.15);
}

.hdr-stat-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.hdr-stat-label {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.hdr-big-num {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--text-primary);
}

.hdr-divider {
  width: 1px;
  background: var(--border-subtle);
  align-self: stretch;
}

.hdr-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.header-meta {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.period-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 2px;
  color: var(--text-tertiary);
  background: var(--bg-elevated);
}

.period-sep {
  color: var(--border);
  font-size: 10px;
}

.period-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
}

/* ── Page body ─────────────────────────────────────────────── */
.page-body {
  padding: 20px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Spinner ─────────────────────────────────────────────── */
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Metric strip ────────────────────────────────────────── */
.metric-strip {
  position: relative;
  display: flex;
  align-items: stretch;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.scan-line {
  position: absolute;
  top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent) 40%, var(--cyan) 70%, transparent);
  opacity: 0.4;
  animation: scan 5s ease-in-out infinite;
  background-size: 200% 100%;
}

@keyframes scan {
  0%   { background-position: -100% 0; }
  50%  { background-position: 100%  0; }
  100% { background-position: -100% 0; }
}

.ms-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 14px 16px;
  min-width: 0;
}

.ms-wide { flex: 1.4; }

.ms-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.ms-value {
  font-family: var(--font-mono);
  font-size: 19px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.025em;
  color: var(--text-primary);
  white-space: nowrap;
}

.ms-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.ms-bar-wrap { margin-top: 2px; }

.ms-bar-track {
  width: 100%;
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.ms-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s var(--ease-out);
}

.ms-div {
  width: 1px;
  background: var(--border-subtle);
  flex-shrink: 0;
  margin: 10px 0;
}

.accent { color: var(--accent); }
.green  { color: var(--green); }
.red    { color: var(--red); }

/* ── Extremes row ────────────────────────────────────────── */
.extremes-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.extreme-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 14px 16px 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.green-card { border-left: 3px solid rgba(0, 230, 118, 0.35); }
.red-card   { border-left: 3px solid rgba(255, 71, 87, 0.35); }

.ec-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
}

.ec-value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.025em;
}

.ec-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
}

/* ── Chart panel ─────────────────────────────────────────── */
.chart-panel {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 18px 10px;
  border-bottom: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}

.panel-header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.panel-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--accent);
  white-space: nowrap;
}

.panel-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.bar-chart {
  display: block;
  width: 100%;
  height: 210px;
  padding: 0 4px;
}

.axis-label {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: rgba(255,255,255,0.3);
}

.chart-loading {
  height: 210px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Calendar panel ──────────────────────────────────────── */
.calendar-panel {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* Legend */
.cal-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: auto;
  flex-shrink: 0;
}

.cal-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.cal-stat-num {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.cal-stat-num.green { color: var(--green); }
.cal-stat-num.red   { color: var(--red); }
.cal-stat-num.dim   { color: var(--text-secondary); }

.cal-stat-lbl {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  text-transform: uppercase;
  white-space: nowrap;
}

.cal-stat-sep {
  width: 1px;
  height: 28px;
  background: var(--border-subtle);
  flex-shrink: 0;
}

.legend-swatches {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 4px;
}

.swatch-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.swatch {
  display: block;
  width: 12px;
  height: 8px;
  border-radius: 1px;
}

.swatch-label {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--text-tertiary);
  margin-left: 4px;
  white-space: nowrap;
}

/* ── Month navigation bar ───────────────────────────────── */
.cal-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.cal-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: border-color 0.18s, color 0.18s, background 0.18s, box-shadow 0.18s;
  flex-shrink: 0;
}

.cal-nav-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-muted);
  box-shadow: 0 0 10px rgba(240, 180, 41, 0.15);
}

.cal-nav-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.cal-nav-label {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.cal-nav-month-name {
  font-family: var(--font-ui);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  text-transform: uppercase;
}

.cal-nav-year {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
}

/* ── Calendar grid ──────────────────────────────────────── */
.cal-loading {
  height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.single-calendar {
  padding: 16px 18px 22px;
}

.cal-dow-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
  margin-bottom: 5px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.cal-dow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  text-align: center;
  padding: 4px 0;
}

.cal-dow-weekend {
  color: rgba(255, 255, 255, 0.18);
}

.cal-weeks {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
}

.cal-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

/* ── Cell ───────────────────────────────────────────────── */
.cal-day {
  min-height: 82px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.015);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 6px 12px;
  cursor: default;
  transition: transform 0.15s var(--ease-out), box-shadow 0.15s;
  position: relative;
  overflow: hidden;
}

/* colored bottom strip for trading days */
.cal-pos::after,
.cal-neg::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 12%;
  right: 12%;
  height: 3px;
  border-radius: 3px 3px 0 0;
  opacity: 0.75;
}
.cal-pos::after { background: var(--green); }
.cal-neg::after { background: var(--red); }

.cal-has-data:hover {
  transform: scale(1.06);
  z-index: 20;
}

.cal-pos:hover  { box-shadow: 0 4px 24px rgba(0, 212, 170, 0.25), 0 1px 4px rgba(0,0,0,0.5); }
.cal-neg:hover  { box-shadow: 0 4px 24px rgba(255, 71, 87, 0.25), 0 1px 4px rgba(0,0,0,0.5); }

.cal-zero:hover {
  background: rgba(255, 255, 255, 0.035);
}

.cal-empty {
  background: transparent !important;
  border-color: transparent !important;
  pointer-events: none;
}

/* Today: bright amber ring */
.cal-today {
  border-color: rgba(240, 180, 41, 0.6) !important;
  box-shadow: inset 0 0 0 1px rgba(240, 180, 41, 0.25), 0 0 12px rgba(240, 180, 41, 0.1) !important;
}
.cal-has-data.cal-today:hover {
  box-shadow: inset 0 0 0 1px rgba(240, 180, 41, 0.4), 0 4px 24px rgba(240, 180, 41, 0.25), 0 1px 4px rgba(0,0,0,0.5) !important;
}

.cal-day-num {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  color: rgba(255, 255, 255, 0.22);
  align-self: flex-start;
  padding-left: 2px;
}

.cal-has-data .cal-day-num {
  color: rgba(255, 255, 255, 0.55);
}

.cal-today .cal-day-num {
  color: var(--accent);
  font-weight: 800;
}

.cal-day-pnl {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  letter-spacing: -0.03em;
  text-shadow: 0 1px 8px currentColor;
}

.cal-pos .cal-day-pnl { color: var(--green); }
.cal-neg .cal-day-pnl { color: var(--red); }

/* Clickable trading days */
.cal-clickable { cursor: pointer; }

/* ── Modal ───────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.day-modal {
  width: 100%;
  max-width: 640px;
  max-height: 82vh;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.04);
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s var(--ease-out);
}
.modal-enter-active .day-modal,
.modal-leave-active .day-modal {
  transition: transform 0.22s var(--ease-out), opacity 0.2s var(--ease-out);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .day-modal {
  transform: translateY(16px);
  opacity: 0;
}
.modal-leave-to .day-modal {
  transform: translateY(8px);
  opacity: 0;
}

/* Modal header */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.modal-header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-date-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--accent);
}

.modal-tag-mark { font-size: 10px; opacity: 0.7; }

.modal-summary {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.modal-pnl {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
}

.modal-trade-sep {
  color: var(--border);
  font-size: 14px;
}

.modal-trade-count {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-tertiary);
  letter-spacing: 0.04em;
}

.modal-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
  margin-top: 2px;
}
.modal-close-btn:hover {
  border-color: var(--red);
  color: var(--red);
}

/* Column headers */
.modal-col-header {
  display: grid;
  grid-template-columns: 1fr 52px 52px 1fr 100px;
  gap: 8px;
  padding: 8px 22px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.modal-col-header span {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
  text-transform: uppercase;
}
.modal-col-header .col-pnl { text-align: right; }

/* Trade list */
.modal-trades {
  overflow-y: auto;
  flex: 1;
}

.modal-empty {
  padding: 40px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
}

.trade-card {
  display: grid;
  grid-template-columns: 1fr 52px 52px 1fr 100px;
  grid-template-rows: auto auto;
  gap: 4px 8px;
  align-items: center;
  padding: 12px 22px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.12s;
}
.trade-card:last-child { border-bottom: none; }
.trade-card:hover { background: rgba(255, 255, 255, 0.025); }

.trade-buy  { border-left: 2px solid rgba(0, 212, 170, 0.35); }
.trade-sell { border-left: 2px solid rgba(255, 71, 87, 0.35); }

.tc-symbol {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.tc-type {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  padding: 3px 6px;
  border-radius: 3px;
  text-align: center;
  align-self: center;
}
.type-buy  { background: rgba(0, 212, 170, 0.15); color: var(--green); }
.type-sell { background: rgba(255, 71, 87,  0.15); color: var(--red); }

.tc-volume {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  align-self: center;
}

.tc-prices {
  display: flex;
  align-items: center;
  gap: 5px;
  align-self: center;
}

.tc-price {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}

.tc-arrow {
  font-size: 10px;
  color: var(--text-tertiary);
}

.tc-pnl {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-align: right;
  align-self: center;
}

/* meta row spans full width */
.tc-meta {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.tc-time {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-tertiary);
}

.tc-sep {
  font-size: 9px;
  color: var(--border);
}

.tc-acct {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-tertiary);
  letter-spacing: 0.04em;
}

.tc-fees {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-tertiary);
}

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 1200px) {
  .metric-strip {
    flex-wrap: wrap;
  }
  .ms-cell { flex: 1 1 22%; border-bottom: 1px solid var(--border-subtle); }
  .ms-cell:nth-last-child(-n+4) { border-bottom: none; }
  .ms-div { display: none; }

  .cal-legend { display: none; }
}

@media (max-width: 900px) {
  .extremes-row { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .page-header { padding: 24px 16px 20px; }
  .page-title { font-size: 32px; }

  .header-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-right { width: 100%; }
  .hdr-stat-block { flex: 1; }

  .page-body { padding: 16px 16px 20px; }

  .cal-nav-bar { padding: 12px 16px; }
  .cal-nav-month-name { font-size: 18px; }

  .single-calendar { padding: 12px 10px 16px; }
  .cal-week { gap: 4px; }
  .cal-dow-row { gap: 4px; }

  .cal-day { min-height: 74px; padding: 8px 4px 12px; gap: 5px; }
  .cal-day-pnl { font-size: 12px; }
}

@media (max-width: 640px) {
  .ms-cell { flex: 1 1 45%; }
  .ms-value { font-size: 16px; }
  .extremes-row { gap: 8px; }
  .ec-value { font-size: 17px; }

  .cal-nav-bar { padding: 10px 14px; }
  .cal-nav-month-name { font-size: 16px; }
  .cal-nav-year { font-size: 11px; }
  .cal-nav-btn { width: 32px; height: 32px; }

  .single-calendar { padding: 10px 8px 14px; }
  .cal-week { gap: 3px; }
  .cal-dow-row { gap: 3px; }

  .cal-day { min-height: 72px; padding: 7px 3px 11px; border-radius: 5px; }
  .cal-day-num { font-size: 9px; }
  .cal-day-pnl { font-size: 11px; }
  .cal-dow { font-size: 9px; }

  /* Modal mobile */
  .modal-backdrop { padding: 16px; align-items: center; }
  .day-modal {
    max-width: 100%;
    max-height: 88vh;
    border-radius: var(--radius-md);
  }
  .modal-col-header,
  .trade-card {
    grid-template-columns: 1fr 44px 44px 1fr 80px;
  }
  .modal-header { padding: 16px 16px 14px; }
  .modal-trades { padding: 0; }
  .trade-card { padding: 10px 16px; }
  .modal-col-header { padding: 6px 16px; }
  .modal-pnl { font-size: 22px; }
  .tc-symbol { font-size: 12px; }
  .tc-pnl { font-size: 12px; }
  .tc-price { font-size: 10px; }
}
</style>
