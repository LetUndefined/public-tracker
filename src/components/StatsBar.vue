<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'
import type { ChallengeRow } from '@/types'
import { useMasterToggle } from '@/composables/useMasterToggle'

const props = defineProps<{
  rows: ChallengeRow[]
}>()

const { includeMaster } = useMasterToggle()
const nonMaster = computed(() =>
  includeMaster.value ? props.rows : props.rows.filter(r => !r.is_master)
)

const streak = computed(() => {
  for (const r of props.rows) {
    if (r.streak) return r.streak
  }
  return null
})

const connected    = computed(() => nonMaster.value.filter(r => r.state === 'Connected').length)
const disconnected = computed(() => nonMaster.value.filter(r => r.state === 'Disconnected').length)

const totalBalance = computed(() => nonMaster.value.reduce((s, r) => s + r.balance, 0))
const totalEquity  = computed(() => nonMaster.value.reduce((s, r) => s + r.equity,  0))
const equityDelta  = computed(() => totalEquity.value - totalBalance.value)
const openPnl      = computed(() => nonMaster.value.reduce((s, r) => s + r.open_pnl, 0))
const totalCost    = computed(() => nonMaster.value.reduce((s, r) => s + (r.cost ?? 0), 0))

const avgProgress = computed(() => {
  const eligible = nonMaster.value.filter(r => r.target_pct > 0)
  if (!eligible.length) return null
  return Math.round(eligible.reduce((s, r) => s + r.progress, 0) / eligible.length * 10) / 10
})

const phaseFunnel = computed(() => {
  const nonMasterRows = nonMaster.value
  const counts: Record<string, number> = {}
  for (const r of nonMasterRows) {
    counts[r.phase] = (counts[r.phase] ?? 0) + 1
  }
  const phaseNums = Object.keys(counts)
    .map(p => p.match(/^Phase (\d+)$/i))
    .filter(Boolean)
    .map(m => parseInt(m![1]))
  const maxPhase = Math.max(2, ...phaseNums)
  for (let i = 1; i <= maxPhase; i++) {
    const key = `Phase ${i}`
    if (!(key in counts)) counts[key] = 0
  }
  return Object.entries(counts).sort(([a], [b]) => {
    const na = a.match(/^Phase (\d+)$/i)
    const nb = b.match(/^Phase (\d+)$/i)
    if (na && nb) return parseInt(na[1]) - parseInt(nb[1])
    if (na) return -1
    if (nb) return 1
    return a.localeCompare(b)
  })
})

function useAnimated(source: ComputedRef<number>, duration = 650) {
  const display = ref(source.value)
  let raf: number | null = null
  watch(source, (next) => {
    const from = display.value
    const delta = next - from
    if (Math.abs(delta) < 0.01) return
    if (raf) cancelAnimationFrame(raf)
    const t0 = performance.now()
    function step(t: number) {
      const p = Math.min((t - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      display.value = from + delta * e
      if (p < 1) raf = requestAnimationFrame(step)
      else display.value = next
    }
    raf = requestAnimationFrame(step)
  })
  return display
}

const animBalance = useAnimated(totalBalance)
const animEquity  = useAnimated(totalEquity)
const animDelta   = useAnimated(equityDelta)
const animOpenPnl = useAnimated(openPnl)
const animCost    = useAnimated(totalCost)

function fmt(v: number, compact = false): string {
  const abs = Math.abs(v)
  if (compact && abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (compact && abs >= 10_000)    return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function sign(v: number): string { return v >= 0 ? '+' : '' }
</script>

<template>
  <div class="module" data-tour="stats-bar">
    <div class="scan-line" />

    <!-- ── THREE HERO PANELS ────────────────────────── -->
    <div class="hero-grid">

      <!-- BALANCE -->
      <div class="hero-panel">
        <div class="corner-glow glow-cyan" />
        <div class="panel-header">
          <span class="panel-tick tick-cyan" />
          <span class="panel-lbl">TOTAL BALANCE</span>
        </div>
        <div class="panel-num cyan">{{ fmt(animBalance, true) }}</div>
        <div class="panel-sub">
          <span class="sub-dim">{{ nonMaster.length }} account{{ nonMaster.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <div class="hero-sep" />

      <!-- EQUITY -->
      <div class="hero-panel">
        <div class="corner-glow glow-green" />
        <div class="panel-header">
          <span class="panel-tick tick-green" />
          <span class="panel-lbl">NET EQUITY</span>
        </div>
        <div class="panel-num green">{{ fmt(animEquity, true) }}</div>
        <div class="panel-sub">
          <span :class="equityDelta >= 0 ? 'sub-green' : 'sub-red'">
            {{ sign(animDelta) }}{{ fmt(animDelta, true) }}
          </span>
          <span class="sub-dim"> vs balance</span>
        </div>
      </div>

      <div class="hero-sep" />

      <!-- OPEN P&L -->
      <div class="hero-panel">
        <div class="corner-glow" :class="openPnl >= 0 ? 'glow-green' : 'glow-red'" />
        <div class="panel-header">
          <span class="live-pip" />
          <span class="panel-lbl">OPEN P&amp;L</span>
          <span class="live-chip">LIVE</span>
        </div>
        <div class="panel-num" :class="openPnl >= 0 ? 'green' : 'red'">
          {{ sign(animOpenPnl) }}{{ fmt(animOpenPnl, true) }}
        </div>
        <div class="panel-sub">
          <span class="sub-dim">unrealized — auto refresh 60s</span>
        </div>
      </div>

    </div>

    <!-- ── SECONDARY DATA STRIP ─────────────────────── -->
    <div class="data-strip">

      <div class="strip-cell">
        <span class="strip-lbl">COST</span>
        <span class="strip-val orange">{{ animCost > 0 ? fmt(animCost, true) : '—' }}</span>
        <span class="strip-sub sub-dim">invested</span>
      </div>

      <div class="strip-sep" />

      <div class="strip-cell">
        <span class="strip-lbl">ACCOUNTS</span>
        <span class="strip-val accent">{{ nonMaster.length }}</span>
        <span class="strip-sub">
          <span class="status-dot dot-on" />
          <span class="sub-green">{{ connected }}</span>
          <span class="sub-dim"> on</span>
          <template v-if="disconnected > 0">
            <span class="sub-dim"> · </span>
            <span class="sub-red">{{ disconnected }}</span>
            <span class="sub-dim"> off</span>
          </template>
        </span>
      </div>

      <div class="strip-sep" />

      <div class="strip-cell strip-grow">
        <span class="strip-lbl">AVG PROGRESS</span>
        <span
          class="strip-val"
          :class="avgProgress === null ? 'sub-dim' : avgProgress >= 0 ? 'green' : 'red'"
        >
          {{ avgProgress === null ? '—' : sign(avgProgress) + avgProgress + '%' }}
        </span>
        <span class="strip-sub sub-dim">
          {{ nonMaster.filter(r => r.target_pct > 0).length }} tracked
        </span>
      </div>

      <div class="strip-sep" />

      <div class="strip-cell">
        <span class="strip-lbl">PHASES</span>
        <div class="phase-row">
          <span v-for="([phase, count]) in phaseFunnel" :key="phase" class="phase-item">
            <span class="phase-key" :class="phase === 'Master' ? 'cyan' : ''">
              {{ phase.replace('Phase ', 'P') }}
            </span>
            <span class="phase-cnt" :class="phase === 'Master' ? 'cyan' : ''">{{ count }}</span>
          </span>
        </div>
        <span class="strip-sub sub-dim">distribution</span>
      </div>

      <div class="strip-sep" />

      <div class="strip-cell">
        <span class="strip-lbl">STREAK</span>
        <span
          class="strip-val"
          :class="streak === null ? 'sub-dim' : streak.direction === 'W' ? 'green' : 'red'"
        >
          {{ streak === null ? '—' : streak.direction + streak.count }}
        </span>
        <span class="strip-sub">
          <span v-if="streak" :class="streak.direction === 'W' ? 'sub-green' : 'sub-red'">
            {{ streak.direction === 'W' ? 'consecutive wins' : 'consecutive losses' }}
          </span>
          <span v-else class="sub-dim">no trade data</span>
        </span>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ── Outer module ────────────────────────────────────── */
.module {
  position: relative;
  margin: 20px 0 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  animation: fadeInUp 0.4s var(--ease-out) both;
}

/* ── Scan line ───────────────────────────────────────── */
.scan-line {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--accent) 20%, var(--cyan) 50%, var(--accent) 80%, transparent 100%);
  background-size: 200% 100%;
  opacity: 0.55;
  animation: scan 5s ease-in-out infinite;
  z-index: 10;
  pointer-events: none;
}

@keyframes scan {
  0%   { background-position: -100% 0; opacity: 0.25; }
  50%  { background-position: 100% 0;  opacity: 0.65; }
  100% { background-position: -100% 0; opacity: 0.25; }
}

/* ── Hero grid: 3 columns ────────────────────────────── */
.hero-grid {
  display: grid;
  grid-template-columns: 1fr 1px 1fr 1px 1fr;
  background: var(--surface);
}

.hero-sep {
  background: var(--border-subtle);
  margin: 18px 0;
}

/* ── Hero panel ──────────────────────────────────────── */
.hero-panel {
  position: relative;
  padding: 24px 28px 22px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  cursor: default;
  transition: background 0.15s;
}

.hero-panel:hover {
  background: var(--surface-hover);
}

/* Radial corner glow */
.corner-glow {
  position: absolute;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  pointer-events: none;
  bottom: -100px;
  left: -70px;
  opacity: 0.7;
}

.glow-cyan  { background: radial-gradient(circle, rgba(24, 220, 255, 0.1) 0%, transparent 65%); }
.glow-green { background: radial-gradient(circle, rgba(0, 212, 170, 0.1) 0%, transparent 65%); }
.glow-red   { background: radial-gradient(circle, rgba(255, 71, 87, 0.1) 0%, transparent 65%); }

/* Panel header row */
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-tick {
  display: inline-block;
  width: 3px;
  height: 12px;
  border-radius: 1px;
  flex-shrink: 0;
}

.tick-cyan  { background: var(--cyan); box-shadow: 0 0 6px var(--cyan); }
.tick-green { background: var(--green); box-shadow: 0 0 6px var(--green); }

.panel-lbl {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  flex: 1;
}

/* Live indicator */
.live-pip {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  flex-shrink: 0;
  animation: pulse-live 2s ease-in-out infinite;
}

.live-chip {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.14em;
  padding: 2px 7px;
  border-radius: 2px;
  background: rgba(240, 180, 41, 0.1);
  border: 1px solid rgba(240, 180, 41, 0.2);
  color: var(--accent);
}

/* Big number */
.panel-num {
  font-family: var(--font-mono);
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  white-space: nowrap;
}

/* Footer sub-text */
.panel-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
}

/* ── Secondary data strip ────────────────────────────── */
.data-strip {
  display: flex;
  align-items: stretch;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
}

.strip-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 12px 22px;
  min-width: 0;
}

.strip-grow {
  flex: 1;
}

.strip-lbl {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.strip-val {
  font-family: var(--font-mono);
  font-size: 19px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.025em;
  white-space: nowrap;
}

.strip-sub {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  white-space: nowrap;
}

.strip-sep {
  width: 1px;
  background: var(--border-subtle);
  margin: 10px 0;
  flex-shrink: 0;
}

/* ── Phase row ───────────────────────────────────────── */
.phase-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.phase-item {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.phase-key {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.phase-cnt {
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

/* ── Status dot ──────────────────────────────────────── */
.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-on {
  background: var(--green);
  box-shadow: 0 0 4px var(--green);
  animation: pulse-live 2.5s ease-in-out infinite;
}

/* ── Colors ──────────────────────────────────────────── */
.cyan   { color: var(--cyan); }
.green  { color: var(--green); }
.red    { color: var(--red); }
.orange { color: var(--orange); }
.accent { color: var(--accent); }

.sub-green { color: var(--green); }
.sub-red   { color: var(--red); }
.sub-dim   { color: var(--text-tertiary); }

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 1100px) {
  .hero-grid {
    grid-template-columns: 1fr;
  }

  .hero-sep {
    height: 1px;
    width: auto;
    margin: 0;
  }

  .data-strip {
    flex-wrap: wrap;
  }

  .strip-sep {
    display: none;
  }

  .strip-cell {
    flex: 1 1 33%;
    border-bottom: 1px solid var(--border-subtle);
  }

  .strip-cell:nth-last-child(-n+2) {
    border-bottom: none;
  }
}

@media (max-width: 640px) {
  .hero-panel {
    padding: 18px 20px 16px;
  }

  .panel-num {
    font-size: 28px;
  }

  .strip-cell {
    flex: 1 1 45%;
    padding: 10px 14px;
  }

  .strip-val {
    font-size: 16px;
  }
}
</style>
