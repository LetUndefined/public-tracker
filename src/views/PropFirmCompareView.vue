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
  if (!search.value.trim()) return firms.value.slice(0, 12)
  const q = search.value.toLowerCase()
  return firms.value.filter(f => f.name.toLowerCase().includes(q)).slice(0, 12)
})

function isSelected(firm: PropFirm) {
  return selected.value.some(s => s.id === firm.id)
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

function fmt(val: boolean | null, yes = 'Yes', no = 'No') {
  if (val === null) return '—'
  return val ? yes : no
}

function fmtNum(val: number | null, suffix = '') {
  if (val === null || val === undefined) return '—'
  return `${val}${suffix}`
}

const rows: { label: string; key: (f: PropFirm) => string }[] = [
  { label: 'Rating', key: f => fmtNum(f.rating) },
  { label: 'Reviews', key: f => fmtNum(f.reviews_count) },
  { label: 'Phases', key: f => f.instant_funding ? 'Instant' : fmtNum(f.phases) },
  { label: 'Profit Target P1', key: f => fmtNum(f.profit_target_p1, '%') },
  { label: 'Profit Target P2', key: f => fmtNum(f.profit_target_p2, '%') },
  { label: 'Min Trading Days', key: f => fmtNum(f.min_trading_days, ' days') },
  { label: 'Max Trading Days', key: f => fmtNum(f.max_trading_days, ' days') },
  { label: 'Drawdown Type', key: f => f.drawdown_type ?? '—' },
  { label: 'Max Daily Loss', key: f => fmtNum(f.max_daily_loss_pct, '%') },
  { label: 'Max Total Loss', key: f => fmtNum(f.max_total_loss_pct, '%') },
  { label: 'Profit Split', key: f => fmtNum(f.profit_split_pct, '%') },
  { label: 'Payout Frequency', key: f => f.payout_frequency ?? '—' },
  { label: 'Fee $10k', key: f => f.fee_10k ? `$${f.fee_10k}` : '—' },
  { label: 'Fee $25k', key: f => f.fee_25k ? `$${f.fee_25k}` : '—' },
  { label: 'Fee $50k', key: f => f.fee_50k ? `$${f.fee_50k}` : '—' },
  { label: 'Fee $100k', key: f => f.fee_100k ? `$${f.fee_100k}` : '—' },
  { label: 'EA Allowed', key: f => fmt(f.ea_allowed) },
  { label: 'Copy Trading', key: f => fmt(f.copy_trading_allowed) },
  { label: 'News Trading', key: f => fmt(f.news_trading_allowed) },
  { label: 'Weekend Holding', key: f => fmt(f.weekend_holding) },
  { label: 'Overnight Holding', key: f => fmt(f.overnight_holding) },
  { label: 'Consistency Rule', key: f => fmt(f.consistency_rule, 'Required', 'None') },
  { label: 'Multiple Accounts', key: f => fmt(f.multiple_accounts) },
  { label: 'Forex', key: f => fmt(f.forex) },
  { label: 'Crypto', key: f => fmt(f.crypto) },
  { label: 'Indices', key: f => fmt(f.indices) },
  { label: 'Commodities', key: f => fmt(f.commodities) },
  { label: 'Futures', key: f => fmt(f.futures) },
  { label: 'MT4', key: f => fmt(f.mt4) },
  { label: 'MT5', key: f => fmt(f.mt5) },
  { label: 'cTrader', key: f => fmt(f.ctrader) },
]
</script>

<template>
  <div class="compare-view">
    <div class="compare-header">
      <div class="compare-title">
        <span class="compare-label">COMPARE</span>
        <h1>Prop Firms</h1>
      </div>
      <p class="compare-sub">Select up to 3 prop firms to compare side by side</p>
    </div>

    <!-- Selection area -->
    <div class="selection-area">
      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.4"/>
          <path d="M8.5 8.5L12 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        <input
          v-model="search"
          class="search-input"
          placeholder="Search prop firms..."
          autocomplete="off"
        />
      </div>

      <div v-if="loading" class="search-empty">Loading...</div>
      <div v-else-if="firms.length === 0" class="search-empty">No prop firm data available</div>
      <div v-else class="firm-list">
        <button
          v-for="firm in searchResults"
          :key="firm.id"
          class="firm-chip"
          :class="{ selected: isSelected(firm), disabled: !isSelected(firm) && selected.length >= 3 }"
          @click="toggle(firm)"
        >
          <span class="chip-name">{{ firm.name }}</span>
          <span v-if="firm.rating" class="chip-rating">★ {{ firm.rating }}</span>
          <span class="chip-action">{{ isSelected(firm) ? '✕' : '+' }}</span>
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="selected.length === 0" class="empty-compare">
      <div class="empty-icon">⟷</div>
      <p>Pick firms above to start comparing</p>
    </div>

    <!-- Comparison columns -->
    <div v-else class="comparison-wrap">
      <!-- Firm headers -->
      <div class="comp-grid" :style="{ '--cols': selected.length }">
        <div class="comp-row comp-header-row">
          <div class="comp-label-col" />
          <div
            v-for="firm in selected"
            :key="firm.id"
            class="comp-firm-header"
          >
            <div class="firm-header-name">{{ firm.name }}</div>
            <a v-if="firm.website" :href="firm.website" target="_blank" rel="noopener" class="firm-header-link">
              Visit site ↗
            </a>
            <button class="firm-remove-btn" @click="remove(firm)" title="Remove">✕</button>
          </div>
        </div>

        <!-- Data rows -->
        <div
          v-for="(row, i) in rows"
          :key="row.label"
          class="comp-row"
          :class="{ 'comp-row-alt': i % 2 === 1 }"
        >
          <div class="comp-label-col">{{ row.label }}</div>
          <div
            v-for="firm in selected"
            :key="firm.id"
            class="comp-value-col"
          >{{ row.key(firm) }}</div>
        </div>

        <!-- Notes row -->
        <div v-if="selected.some(f => f.notes)" class="comp-row comp-notes-row">
          <div class="comp-label-col">Notes</div>
          <div
            v-for="firm in selected"
            :key="firm.id"
            class="comp-value-col comp-notes"
          >{{ firm.notes ?? '—' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compare-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.compare-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.compare-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--accent);
}

.compare-header h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.compare-sub {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

/* Selection */
.selection-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 32px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: var(--accent);
}

.search-empty {
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 0;
  text-align: center;
}

.firm-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.firm-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--text-secondary);
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.firm-chip:hover:not(.disabled) {
  border-color: var(--accent);
  color: var(--text-primary);
}

.firm-chip.selected {
  border-color: var(--accent);
  background: rgba(var(--accent-rgb, 99, 102, 241), 0.08);
  color: var(--accent);
}

.firm-chip.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.chip-rating {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.firm-chip.selected .chip-rating {
  color: var(--accent);
  opacity: 0.7;
}

.chip-action {
  font-size: 11px;
  opacity: 0.6;
}

/* Empty state */
.empty-compare {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 64px 24px;
  color: var(--text-muted);
  font-size: 14px;
}

.empty-icon {
  font-size: 36px;
  opacity: 0.3;
}

/* Comparison grid */
.comparison-wrap {
  overflow-x: auto;
}

.comp-grid {
  display: grid;
  grid-template-columns: 200px repeat(var(--cols), 1fr);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  min-width: 500px;
}

.comp-row {
  display: contents;
}

.comp-row > * {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 13px;
  display: flex;
  align-items: center;
}

.comp-row-alt > * {
  background: var(--surface);
}

.comp-header-row > * {
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  padding: 16px 14px;
}

.comp-label-col {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  background: var(--bg-elevated) !important;
  border-right: 1px solid var(--border);
}

.comp-value-col {
  font-family: var(--font-ui);
  color: var(--text-secondary);
  justify-content: center;
  text-align: center;
  border-right: 1px solid var(--border-subtle);
}

.comp-value-col:last-child {
  border-right: none;
}

.comp-firm-header {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border-right: 1px solid var(--border);
}

.comp-firm-header:last-child {
  border-right: none;
}

.firm-header-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.firm-header-link {
  font-size: 11px;
  color: var(--accent);
  text-decoration: none;
}

.firm-header-link:hover {
  text-decoration: underline;
}

.firm-remove-btn {
  margin-top: 2px;
  padding: 2px 6px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 10px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.firm-remove-btn:hover {
  color: var(--red);
  border-color: var(--red);
}

.comp-notes {
  font-size: 12px;
  color: var(--text-muted);
  text-align: left !important;
  justify-content: flex-start !important;
  line-height: 1.5;
}
</style>
