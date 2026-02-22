<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

interface PropFirm {
  id: string
  name: string
  website: string | null
  rating: number | null
  reviews_count: number | null
  phases: number | null
  instant_funding: boolean
  profit_target_p1: number | null
  profit_target_p2: number | null
  min_trading_days: number | null
  max_trading_days: number | null
  drawdown_type: string | null
  max_daily_loss_pct: number | null
  max_total_loss_pct: number | null
  profit_split_pct: number | null
  payout_frequency: string | null
  ea_allowed: boolean | null
  copy_trading_allowed: boolean | null
  news_trading_allowed: boolean | null
  weekend_holding: boolean | null
  overnight_holding: boolean | null
  consistency_rule: boolean | null
  multiple_accounts: boolean | null
  forex: boolean | null
  crypto: boolean | null
  indices: boolean | null
  commodities: boolean | null
  futures: boolean | null
  mt4: boolean | null
  mt5: boolean | null
  ctrader: boolean | null
  fee_10k: number | null
  fee_25k: number | null
  fee_50k: number | null
  fee_100k: number | null
  notes: string | null
}

// Accent color per selection slot
const FIRM_COLORS = ['#22d3ee', '#f59e0b', '#a855f7'] // cyan, amber, violet

const firms = ref<PropFirm[]>([])
const loading = ref(false)
const search = ref('')
const selected = ref<PropFirm[]>([])

async function load() {
  loading.value = true
  const { data, error } = await supabase
    .from('prop_firms')
    .select('*')
    .eq('status', 'active')
    .order('rating', { ascending: false })
  if (!error) firms.value = data ?? []
  loading.value = false
}

onMounted(load)

const searchResults = computed(() => {
  if (!search.value.trim()) return firms.value
  const q = search.value.toLowerCase()
  return firms.value.filter(f => f.name.toLowerCase().includes(q))
})

function isSelected(firm: PropFirm) {
  return selected.value.some(s => s.id === firm.id)
}

function firmIndex(firm: PropFirm) {
  return selected.value.findIndex(s => s.id === firm.id)
}

function toggle(firm: PropFirm) {
  if (isSelected(firm)) {
    selected.value = selected.value.filter(s => s.id !== firm.id)
  } else if (selected.value.length < 3) {
    selected.value = [...selected.value, firm]
  }
}

function remove(firm: PropFirm) {
  selected.value = selected.value.filter(s => s.id !== firm.id)
}

// ── Value rendering ──────────────────────────────────────────
type CellType = 'bool-good' | 'bool-neutral' | 'bool-bad' | 'number' | 'fee' | 'text' | 'drawdown' | 'consistency'

interface RowDef {
  label: string
  section?: string
  type: CellType
  value: (f: PropFirm) => string | number | boolean | null
  suffix?: string
  bestFn?: (vals: (number | null)[]) => number | null // returns best raw value
}

function bestMin(vals: (number | null)[]): number | null {
  const nums = vals.filter(v => v !== null) as number[]
  return nums.length ? Math.min(...nums) : null
}
function bestMax(vals: (number | null)[]): number | null {
  const nums = vals.filter(v => v !== null) as number[]
  return nums.length ? Math.max(...nums) : null
}

const sections: { label: string; rows: RowDef[] }[] = [
  {
    label: 'OVERVIEW',
    rows: [
      { label: 'Rating', type: 'number', value: f => f.rating, bestFn: bestMax },
      { label: 'Reviews', type: 'number', value: f => f.reviews_count, bestFn: bestMax },
      { label: 'Phases / Funding', type: 'text', value: f => f.instant_funding ? 'Instant' : f.phases != null ? `${f.phases} Phase${f.phases > 1 ? 's' : ''}` : '—' },
    ],
  },
  {
    label: 'TARGETS',
    rows: [
      { label: 'Profit Target P1', type: 'number', suffix: '%', value: f => f.profit_target_p1, bestFn: bestMin },
      { label: 'Profit Target P2', type: 'number', suffix: '%', value: f => f.profit_target_p2, bestFn: bestMin },
      { label: 'Min Trading Days', type: 'number', suffix: 'd', value: f => f.min_trading_days, bestFn: bestMin },
      { label: 'Max Trading Days', type: 'number', suffix: 'd', value: f => f.max_trading_days, bestFn: bestMax },
    ],
  },
  {
    label: 'RISK',
    rows: [
      { label: 'Drawdown Type', type: 'drawdown', value: f => f.drawdown_type },
      { label: 'Max Daily Loss', type: 'number', suffix: '%', value: f => f.max_daily_loss_pct, bestFn: bestMax },
      { label: 'Max Total Loss', type: 'number', suffix: '%', value: f => f.max_total_loss_pct, bestFn: bestMax },
      { label: 'Consistency Rule', type: 'consistency', value: f => f.consistency_rule },
    ],
  },
  {
    label: 'FINANCIALS',
    rows: [
      { label: 'Profit Split', type: 'number', suffix: '%', value: f => f.profit_split_pct, bestFn: bestMax },
      { label: 'Payout Frequency', type: 'text', value: f => f.payout_frequency ?? '—' },
      { label: 'Fee $10k', type: 'fee', value: f => f.fee_10k, bestFn: bestMin },
      { label: 'Fee $25k', type: 'fee', value: f => f.fee_25k, bestFn: bestMin },
      { label: 'Fee $50k', type: 'fee', value: f => f.fee_50k, bestFn: bestMin },
      { label: 'Fee $100k', type: 'fee', value: f => f.fee_100k, bestFn: bestMin },
    ],
  },
  {
    label: 'RULES',
    rows: [
      { label: 'EA / Robots', type: 'bool-good', value: f => f.ea_allowed },
      { label: 'Copy Trading', type: 'bool-good', value: f => f.copy_trading_allowed },
      { label: 'News Trading', type: 'bool-good', value: f => f.news_trading_allowed },
      { label: 'Weekend Holding', type: 'bool-good', value: f => f.weekend_holding },
      { label: 'Overnight Holding', type: 'bool-good', value: f => f.overnight_holding },
      { label: 'Multiple Accounts', type: 'bool-good', value: f => f.multiple_accounts },
    ],
  },
  {
    label: 'MARKETS',
    rows: [
      { label: 'Forex', type: 'bool-neutral', value: f => f.forex },
      { label: 'Crypto', type: 'bool-neutral', value: f => f.crypto },
      { label: 'Indices', type: 'bool-neutral', value: f => f.indices },
      { label: 'Commodities', type: 'bool-neutral', value: f => f.commodities },
      { label: 'Futures', type: 'bool-neutral', value: f => f.futures },
    ],
  },
  {
    label: 'PLATFORMS',
    rows: [
      { label: 'MT4', type: 'bool-neutral', value: f => f.mt4 },
      { label: 'MT5', type: 'bool-neutral', value: f => f.mt5 },
      { label: 'cTrader', type: 'bool-neutral', value: f => f.ctrader },
    ],
  },
]

function renderValue(row: RowDef, firm: PropFirm): string {
  const v = row.value(firm)
  if (v === null || v === undefined) return '—'
  if (row.type === 'fee') return v !== null ? `$${v}` : '—'
  if (row.type === 'number') return v !== null ? `${v}${row.suffix ?? ''}` : '—'
  return String(v)
}

function cellClass(row: RowDef, firm: PropFirm, isBest: boolean): string {
  const v = row.value(firm)
  const classes: string[] = []
  if (isBest) classes.push('cell-best')
  if (v === null || v === undefined) return classes.join(' ')

  if (row.type === 'bool-good') {
    classes.push(v === true ? 'cell-green' : v === false ? 'cell-red' : '')
  } else if (row.type === 'bool-neutral') {
    classes.push(v === true ? 'cell-green' : 'cell-muted')
  } else if (row.type === 'drawdown') {
    const s = String(v).toLowerCase()
    if (s.includes('static')) classes.push('cell-green')
    else if (s.includes('trail')) classes.push('cell-amber')
  } else if (row.type === 'consistency') {
    classes.push(v === true ? 'cell-amber' : v === false ? 'cell-green' : '')
  }
  return classes.filter(Boolean).join(' ')
}

function cellText(row: RowDef, firm: PropFirm): string {
  const v = row.value(firm)
  if (row.type === 'bool-good' || row.type === 'bool-neutral') {
    if (v === true) return '✓'
    if (v === false) return '✗'
    return '—'
  }
  if (row.type === 'consistency') {
    if (v === true) return 'Required'
    if (v === false) return 'None'
    return '—'
  }
  if (row.type === 'drawdown') {
    if (!v) return '—'
    const s = String(v)
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  return renderValue(row, firm)
}

// Returns 'full' | 'half' | 'empty' for each of the 5 star dots
function starState(rating: number, n: number): 'full' | 'half' | 'empty' {
  if (n <= Math.floor(rating)) return 'full'
  if (n === Math.ceil(rating) && rating % 1 >= 0.25) return 'half'
  return 'empty'
}

function getBestValue(row: RowDef): number | null {
  if (!row.bestFn) return null
  const vals = selected.value.map(f => {
    const v = row.value(f)
    return typeof v === 'number' ? v : null
  })
  return row.bestFn(vals)
}

function isBestCell(row: RowDef, firm: PropFirm): boolean {
  if (!row.bestFn) return false
  const best = getBestValue(row)
  if (best === null) return false
  const v = row.value(firm)
  return v === best
}
</script>

<template>
  <div class="cpv">
    <!-- Header -->
    <div class="cpv-header">
      <div>
        <div class="cpv-eyebrow">INTELLIGENCE</div>
        <h1 class="cpv-title">Compare Prop Firms</h1>
      </div>
      <p class="cpv-sub">Select up to 3 firms · data updates periodically</p>
    </div>

    <!-- Firm picker -->
    <div class="picker">
      <div class="picker-top">
        <div class="picker-search-wrap">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" class="picker-search-icon">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M8 8L11.5 11.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <input v-model="search" class="picker-search" placeholder="Filter firms..." autocomplete="off" />
        </div>
        <div class="picker-slots">
          <div
            v-for="(slot, i) in 3"
            :key="i"
            class="picker-slot"
            :class="{ filled: !!selected[i] }"
            :style="selected[i] ? { '--slot-color': FIRM_COLORS[i] } : {}"
          >
            <template v-if="selected[i]">
              <span class="slot-dot" />
              <span class="slot-name">{{ selected[i].name }}</span>
              <button class="slot-remove" @click="remove(selected[i])">✕</button>
            </template>
            <template v-else>
              <span class="slot-empty">Slot {{ i + 1 }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- Firm table -->
      <div v-if="loading" class="picker-loading">
        <span class="loading-pulse" />Loading firms...
      </div>
      <div v-else-if="firms.length === 0" class="picker-loading">No prop firm data available</div>
      <div v-else class="firm-table-wrap">
        <table class="firm-table">
          <thead>
            <tr>
              <th class="ft-name">Firm</th>
              <th>Rating</th>
              <th>Reviews</th>
              <th>Split</th>
              <th>Fee $10k</th>
              <th>Phases</th>
              <th class="ft-action" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="firm in searchResults"
              :key="firm.id"
              class="firm-row"
              :class="{
                'firm-row--selected': isSelected(firm),
                'firm-row--disabled': !isSelected(firm) && selected.length >= 3
              }"
              :style="isSelected(firm) ? { '--row-color': FIRM_COLORS[firmIndex(firm)] } : {}"
              @click="toggle(firm)"
            >
              <td class="ft-name">
                <span class="row-sel-bar" />
                <span class="row-name">{{ firm.name }}</span>
                <span v-if="firm.instant_funding" class="badge-instant">INSTANT</span>
              </td>
              <td>
                <span v-if="firm.rating" class="row-rating">
                  <span class="rating-stars">
                    <span
                      v-for="n in 5"
                      :key="n"
                      class="star"
                      :class="starState(firm.rating, n)"
                    />
                  </span>
                  <span class="rating-num">{{ firm.rating }}</span>
                </span>
                <span v-else class="cell-muted-text">—</span>
              </td>
              <td>
                <span v-if="firm.reviews_count" class="reviews-count">
                  {{ firm.reviews_count.toLocaleString() }}
                </span>
                <span v-else class="cell-muted-text">—</span>
              </td>
              <td>
                <span v-if="firm.profit_split_pct" class="split-pct">{{ firm.profit_split_pct }}%</span>
                <span v-else class="cell-muted-text">—</span>
              </td>
              <td>
                <span v-if="firm.fee_10k" class="fee-text">${{ firm.fee_10k }}</span>
                <span v-else class="cell-muted-text">—</span>
              </td>
              <td>
                <span class="phases-text">
                  {{ firm.instant_funding ? 'Instant' : firm.phases != null ? `${firm.phases}` : '—' }}
                </span>
              </td>
              <td class="ft-action">
                <button class="add-btn" :class="{ added: isSelected(firm) }">
                  {{ isSelected(firm) ? '✕' : '+' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="selected.length === 0" class="empty-state">
      <div class="empty-arrows">⟵ &nbsp; ⟶</div>
      <p>Select firms from the list above to compare</p>
    </div>

    <!-- Comparison grid -->
    <div v-else class="comp-wrap">
      <div class="comp-grid" :style="{ '--firm-count': selected.length }">

        <!-- Sticky header row -->
        <div class="comp-header">
          <div class="comp-label-cell comp-header-spacer" />
          <div
            v-for="(firm, fi) in selected"
            :key="firm.id"
            class="comp-firm-cell"
            :style="{ '--fc': FIRM_COLORS[fi] }"
          >
            <div class="cfh-bar" />
            <div class="cfh-name">{{ firm.name }}</div>
            <a v-if="firm.website" :href="firm.website" target="_blank" rel="noopener" class="cfh-link">
              Visit ↗
            </a>
            <div class="cfh-meta">
              <span v-if="firm.rating" class="cfh-rating">★ {{ firm.rating }}</span>
              <span v-if="firm.profit_split_pct" class="cfh-split">{{ firm.profit_split_pct }}% split</span>
            </div>
            <button class="cfh-remove" @click="remove(firm)">Remove</button>
          </div>
        </div>

        <!-- Sections -->
        <template v-for="section in sections" :key="section.label">
          <!-- Section divider -->
          <div class="comp-section-row">
            <div class="comp-section-label">{{ section.label }}</div>
            <div v-for="firm in selected" :key="firm.id" class="comp-section-fill" />
          </div>

          <!-- Data rows -->
          <div
            v-for="row in section.rows"
            :key="row.label"
            class="comp-data-row"
          >
            <div class="comp-label-cell">{{ row.label }}</div>
            <div
              v-for="(firm, fi) in selected"
              :key="firm.id"
              class="comp-value-cell"
              :class="cellClass(row, firm, isBestCell(row, firm))"
              :style="{ '--fc': FIRM_COLORS[fi] }"
            >
              {{ cellText(row, firm) }}
            </div>
          </div>
        </template>

        <!-- Notes -->
        <div v-if="selected.some(f => f.notes)" class="comp-data-row comp-notes-row">
          <div class="comp-label-cell">Notes</div>
          <div
            v-for="(firm, fi) in selected"
            :key="firm.id"
            class="comp-value-cell comp-notes-cell"
            :style="{ '--fc': FIRM_COLORS[fi] }"
          >{{ firm.notes ?? '—' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────── */
.cpv {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px 100px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Header ─────────────────────────────────────────────────── */
.cpv-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.cpv-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--accent);
  margin-bottom: 4px;
}

.cpv-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.cpv-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
  padding-bottom: 4px;
}

/* ── Picker ─────────────────────────────────────────────────── */
.picker {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.picker-top {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.picker-search-wrap {
  position: relative;
  flex-shrink: 0;
}

.picker-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.picker-search {
  padding: 7px 12px 7px 30px;
  width: 200px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.picker-search:focus { border-color: var(--accent); }

.picker-slots {
  display: flex;
  gap: 8px;
  flex: 1;
  flex-wrap: wrap;
}

.picker-slot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  min-width: 120px;
  font-size: 12px;
  color: var(--text-muted);
  transition: border-color 0.2s;
}

.picker-slot.filled {
  border-style: solid;
  border-color: var(--slot-color);
  background: color-mix(in srgb, var(--slot-color) 6%, transparent);
}

.slot-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--slot-color);
  flex-shrink: 0;
}

.slot-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.slot-remove {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  padding: 0 2px;
  transition: color 0.15s;
}
.slot-remove:hover { color: var(--red); }

.slot-empty {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
}

/* ── Firm table ─────────────────────────────────────────────── */
.picker-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  font-size: 13px;
  color: var(--text-muted);
}

.loading-pulse {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse-live 1.4s ease-in-out infinite;
}

.firm-table-wrap {
  overflow-y: auto;
  max-height: 260px;
}

.firm-table {
  width: 100%;
  border-collapse: collapse;
}

.firm-table thead th {
  position: sticky;
  top: 0;
  padding: 8px 14px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  text-align: left;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.firm-row {
  cursor: pointer;
  transition: background 0.12s;
  border-bottom: 1px solid var(--border-subtle);
}

.firm-row:hover:not(.firm-row--disabled) {
  background: var(--bg-elevated);
}

.firm-row--selected {
  background: color-mix(in srgb, var(--row-color) 5%, transparent) !important;
}

.firm-row--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.firm-table td {
  padding: 9px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  vertical-align: middle;
  white-space: nowrap;
}

.ft-name {
  width: 40%;
}

.ft-action {
  width: 48px;
  text-align: right;
}

.row-sel-bar {
  display: inline-block;
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--row-color, transparent);
  margin-right: 8px;
  vertical-align: middle;
  transition: background 0.15s;
}

.row-name {
  font-weight: 500;
  color: var(--text-primary);
}

.badge-instant {
  margin-left: 6px;
  padding: 1px 5px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #22d3ee;
  border: 1px solid #22d3ee44;
  border-radius: 3px;
  background: #22d3ee10;
}

.row-rating {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rating-stars {
  display: flex;
  gap: 2px;
}

.star {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  flex-shrink: 0;
}

.star.full {
  background: #f59e0b;
}

.star.half {
  background: linear-gradient(90deg, #f59e0b 50%, var(--border) 50%);
}

.star.empty {
  background: var(--border);
}

.rating-num {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
}

.reviews-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.split-pct {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--green);
  font-weight: 600;
}

.fee-text {
  font-family: var(--font-mono);
  font-size: 12px;
}

.phases-text {
  font-family: var(--font-mono);
  font-size: 12px;
}

.cell-muted-text {
  color: var(--text-muted);
}

.add-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  margin-left: auto;
}

.add-btn:hover { color: var(--accent); border-color: var(--accent); }
.add-btn.added { color: var(--red); border-color: var(--red); background: rgba(239, 68, 68, 0.06); }

/* ── Empty state ────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 24px;
  color: var(--text-muted);
  font-size: 13px;
}

.empty-arrows {
  font-size: 28px;
  opacity: 0.2;
  letter-spacing: 8px;
}

/* ── Comparison grid ────────────────────────────────────────── */
.comp-wrap {
  overflow-x: auto;
}

.comp-grid {
  display: grid;
  grid-template-columns: 180px repeat(var(--firm-count), 1fr);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  min-width: 480px;
}

/* Header row */
.comp-header {
  display: contents;
}

.comp-header-spacer {
  background: var(--bg-elevated);
  border-bottom: 2px solid var(--border);
}

.comp-firm-cell {
  padding: 16px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg-elevated);
  border-left: 1px solid var(--border);
  border-bottom: 2px solid var(--border);
  position: relative;
  overflow: hidden;
}

.cfh-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--fc);
}

.cfh-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 2px;
}

.cfh-link {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fc);
  text-decoration: none;
  letter-spacing: 0.04em;
}
.cfh-link:hover { text-decoration: underline; }

.cfh-meta {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.cfh-rating, .cfh-split {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
}

.cfh-remove {
  margin-top: 6px;
  align-self: flex-start;
  padding: 3px 8px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.cfh-remove:hover { color: var(--red); border-color: var(--red); }

/* Section header rows */
.comp-section-row {
  display: contents;
}

.comp-section-label {
  padding: 6px 14px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-elevated));
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
}

.comp-section-fill {
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-elevated));
  border-left: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
}

/* Data rows */
.comp-data-row {
  display: contents;
}

.comp-data-row:nth-child(even) .comp-label-cell,
.comp-data-row:nth-child(even) .comp-value-cell {
  background: var(--surface);
}

.comp-label-cell {
  padding: 9px 14px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  border-right: 1px solid var(--border);
  letter-spacing: 0.02em;
}

.comp-value-cell {
  padding: 9px 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  border-left: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition: background 0.15s;
}

/* Cell state classes */
.cell-green {
  color: var(--green);
  font-weight: 700;
}

.cell-red {
  color: var(--red);
  font-weight: 600;
}

.cell-amber {
  color: #f59e0b;
}

.cell-muted {
  color: var(--text-muted);
}

.cell-best {
  background: color-mix(in srgb, var(--green) 10%, transparent) !important;
  color: var(--green) !important;
  font-weight: 700;
}

/* Notes */
.comp-notes-row .comp-value-cell {
  font-family: var(--font-ui);
  font-size: 12px;
  text-align: left;
  justify-content: flex-start;
  line-height: 1.5;
  color: var(--text-muted);
}
</style>
