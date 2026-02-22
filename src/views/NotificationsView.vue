<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNotifications } from '@/composables/useNotifications'
import { usePushNotifications } from '@/composables/usePushNotifications'
import type { TradeNotification } from '@/composables/useNotifications'

const { notifications, loading, includeMaster } = useNotifications()
const { supported: pushSupported, permission: pushPermission, requestPermission, notify } = usePushNotifications()

async function testNotification() {
  await notify('Trade Opened', 'EURUSD · 4/4 accounts', 'test-open')
  setTimeout(() => notify('Take Profit hit ✅', 'EURUSD · +$312.50', 'test-close'), 3000)
}

// ── Filter state ─────────────────────────────────────────
type FeedFilter = 'all' | 'open' | 'closed'
const feedFilter = ref<FeedFilter>('all')

// ── Group by account ─────────────────────────────────────
interface AccountGroup {
  challenge_id: string
  account_alias: string
  trades: TradeNotification[]
  openCount: number
  closedPnl: number
  totalPnl: number
}

const accountGroups = computed<AccountGroup[]>(() => {
  const map = new Map<string, AccountGroup>()

  for (const n of notifications.value) {
    if (!map.has(n.challenge_id)) {
      map.set(n.challenge_id, {
        challenge_id: n.challenge_id,
        account_alias: n.account_alias,
        trades: [],
        openCount: 0,
        closedPnl: 0,
        totalPnl: 0,
      })
    }
    const g = map.get(n.challenge_id)!
    g.trades.push(n)
    if (n.is_open) g.openCount++
    if (!n.is_open && n.profit !== null) {
      g.closedPnl += n.profit
      g.totalPnl += n.profit
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    // Accounts with open trades first, then by recency
    if (a.openCount > 0 && b.openCount === 0) return -1
    if (b.openCount > 0 && a.openCount === 0) return 1
    const aT = a.trades[0]?.timestamp ?? ''
    const bT = b.trades[0]?.timestamp ?? ''
    return bT.localeCompare(aT)
  })
})

const selectedId = ref<string | null>(null) // null = "All Accounts" combined view
const tradeLimit = ref<number | null>(25)   // per-account trade limit in combined view

// Combined view: last N trades per account, merged and sorted by time
const allCombinedTrades = computed<TradeNotification[]>(() => {
  const all: TradeNotification[] = []
  for (const g of accountGroups.value) {
    const trades = tradeLimit.value !== null ? g.trades.slice(0, tradeLimit.value) : g.trades
    all.push(...trades)
  }
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
})

const selectedGroup = computed<AccountGroup | null>(() => {
  if (selectedId.value === null) return null
  return accountGroups.value.find(g => g.challenge_id === selectedId.value) ?? null
})

const filteredTrades = computed<TradeNotification[]>(() => {
  const trades = selectedId.value === null
    ? allCombinedTrades.value
    : (selectedGroup.value?.trades ?? [])
  if (feedFilter.value === 'open')   return trades.filter(t => t.is_open)
  if (feedFilter.value === 'closed') return trades.filter(t => !t.is_open)
  return trades
})

// Feed header helpers
const feedName      = computed(() => selectedId.value === null ? 'All Accounts' : (selectedGroup.value?.account_alias ?? ''))
const feedOpen      = computed(() => selectedId.value === null ? totalOpenCount.value : (selectedGroup.value?.openCount ?? 0))
const feedClosedPnl = computed(() => selectedId.value === null ? totalClosedPnl.value : (selectedGroup.value?.closedPnl ?? 0))

// Summary stats across all accounts
const totalOpenCount = computed(() => accountGroups.value.reduce((s, g) => s + g.openCount, 0))
const totalClosedPnl = computed(() => accountGroups.value.reduce((s, g) => s + g.closedPnl, 0))

function selectAccount(id: string | null) {
  selectedId.value = id
}

// ── Formatting ────────────────────────────────────────────
function formatTime(ts: string): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatPnl(v: number): string {
  const abs = Math.abs(v).toFixed(2)
  return v >= 0 ? `+$${abs}` : `-$${abs}`
}

function isBuy(side: string): boolean {
  const s = side.toLowerCase()
  return s.includes('buy') || s === 'long'
}

</script>

<template>
  <div class="notifications-view">

    <!-- ── HEADER BANNER ─────────────────────────────── -->
    <header class="page-header">
      <div class="header-grid" aria-hidden="true" />

      <div class="header-inner">
        <div class="header-left">
          <div class="header-tag">
            <span class="tag-mark">▸</span>
            METACOPIER
          </div>
          <h1 class="page-title">
            Trade<br />
            <span class="title-accent">Feed</span>
          </h1>
        </div>

        <div class="header-right">
          <!-- Summary stats -->
          <div class="hdr-block">
            <div class="hdr-row">
              <span class="hdr-num" :class="totalClosedPnl >= 0 ? 'green' : 'red'">
                {{ totalClosedPnl === 0 ? '—' : formatPnl(totalClosedPnl) }}
              </span>
            </div>
            <div class="hdr-lbl">SESSION P&amp;L</div>
          </div>

          <div class="hdr-div" />

          <div class="hdr-block">
            <div class="hdr-row">
              <span v-if="totalOpenCount > 0" class="hdr-live-dot" />
              <span class="hdr-num accent">{{ totalOpenCount }}</span>
            </div>
            <div class="hdr-lbl">OPEN NOW</div>
          </div>

          <div class="hdr-div" />

          <div class="hdr-block">
            <div class="hdr-row">
              <template v-if="loading">
                <div class="hdr-spinner" />
                <span class="hdr-status syncing">Polling...</span>
              </template>
              <template v-else>
                <span class="hdr-live-dot dot-dim" />
                <span class="hdr-status">Every 15s</span>
              </template>
            </div>
            <div class="hdr-lbl">AUTO POLL</div>
          </div>
        </div>
      </div>
    </header>

    <!-- ── CONTROLS BAR ──────────────────────────────── -->
    <div class="controls-bar">

      <!-- Feed filter chips -->
      <div class="ctrl-group">
        <span class="ctrl-lbl">VIEW</span>
        <div class="ctrl-chips">
          <button :class="['ctrl-chip', feedFilter === 'all' && 'chip-on']" @click="feedFilter = 'all'">
            All <span class="chip-count">{{ notifications.length }}</span>
          </button>
          <button :class="['ctrl-chip', feedFilter === 'open' && 'chip-on chip-on-live']" @click="feedFilter = 'open'">
            <span class="pip-sm" />Open
          </button>
          <button :class="['ctrl-chip', feedFilter === 'closed' && 'chip-on']" @click="feedFilter = 'closed'">
            Closed
          </button>
        </div>
      </div>

      <div class="ctrl-sep" />

      <!-- Trade limit (combined view only) -->
      <template v-if="selectedId === null">
        <div class="ctrl-group">
          <span class="ctrl-lbl">PER ACCT</span>
          <div class="ctrl-chips">
            <button :class="['ctrl-chip', tradeLimit === 10 && 'chip-on']" @click="tradeLimit = 10">10</button>
            <button :class="['ctrl-chip', tradeLimit === 25 && 'chip-on']" @click="tradeLimit = 25">25</button>
            <button :class="['ctrl-chip', tradeLimit === 50 && 'chip-on']" @click="tradeLimit = 50">50</button>
            <button :class="['ctrl-chip', tradeLimit === null && 'chip-on']" @click="tradeLimit = null">All</button>
          </div>
        </div>
        <div class="ctrl-sep" />
      </template>

      <!-- Master toggle -->
      <div class="ctrl-group">
        <label class="toggle-wrap">
          <input type="checkbox" v-model="includeMaster" class="sr-only" />
          <div class="toggle-track">
            <div class="toggle-thumb" />
          </div>
          <span class="ctrl-lbl">MASTER</span>
        </label>
      </div>

      <div class="ctrl-grow" />

      <!-- Push notifications -->
      <template v-if="pushSupported">
        <button
          v-if="pushPermission !== 'granted'"
          class="ctrl-push-btn"
          :disabled="pushPermission === 'denied'"
          @click="requestPermission"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {{ pushPermission === 'denied' ? 'Alerts blocked' : 'Enable push alerts' }}
        </button>

        <div v-else class="push-on">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Alerts on
          <button class="test-btn" @click="testNotification" title="Test open + close alerts">test</button>
        </div>
      </template>

    </div>

    <!-- ── EMPTY STATE ───────────────────────────────── -->
    <div v-if="accountGroups.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <p class="empty-title">No trade activity yet</p>
      <p class="empty-sub">Positions will appear here as your accounts execute trades · polling every 15s</p>
    </div>

    <!-- ── MAIN BODY ─────────────────────────────────── -->
    <div v-else class="body">

      <!-- Account sidebar -->
      <aside class="sidebar">
        <div class="sidebar-label">ACCOUNTS</div>

        <!-- All Accounts entry -->
        <div
          class="acct-card acct-all-entry"
          :class="{ 'acct-active': selectedId === null }"
          @click="selectAccount(null)"
        >
          <div class="acct-top">
            <span class="acct-name">All Accounts</span>
            <span v-if="totalOpenCount > 0" class="acct-live-badge">
              <span class="acct-pip" />{{ totalOpenCount }}
            </span>
          </div>
          <div class="acct-bottom">
            <span class="acct-count">{{ notifications.length }} trade{{ notifications.length !== 1 ? 's' : '' }}</span>
            <span class="acct-pnl" :class="totalClosedPnl >= 0 ? 'pnl-pos' : 'pnl-neg'">{{ totalClosedPnl !== 0 ? formatPnl(totalClosedPnl) : '—' }}</span>
          </div>
        </div>

        <div
          v-for="(g, i) in accountGroups"
          :key="g.challenge_id"
          class="acct-card"
          :class="{
            'acct-active': selectedId === g.challenge_id,
            'acct-live': g.openCount > 0,
          }"
          :style="{ 'animation-delay': `${i * 40}ms` }"
          @click="selectAccount(g.challenge_id)"
        >
          <div class="acct-top">
            <span class="acct-name">{{ g.account_alias }}</span>
            <span v-if="g.openCount > 0" class="acct-live-badge">
              <span class="acct-pip" />{{ g.openCount }}
            </span>
          </div>
          <div class="acct-bottom">
            <span class="acct-count">{{ g.trades.length }} trade{{ g.trades.length !== 1 ? 's' : '' }}</span>
            <span
              class="acct-pnl"
              :class="g.closedPnl >= 0 ? 'pnl-pos' : 'pnl-neg'"
            >{{ g.closedPnl !== 0 ? formatPnl(g.closedPnl) : '—' }}</span>
          </div>
        </div>
      </aside>

      <!-- Trade feed -->
      <section class="feed-panel">

        <!-- Feed header -->
        <div class="feed-hdr">
          <div class="feed-hdr-left">
            <span class="feed-acct-name">{{ feedName }}</span>
            <span v-if="selectedId === null && tradeLimit !== null" class="feed-limit-badge">last {{ tradeLimit }}/acct</span>
            <span v-if="feedOpen > 0" class="feed-live-chip">
              <span class="pip-sm" />{{ feedOpen }} live
            </span>
          </div>
          <div class="feed-hdr-right">
            <span class="feed-stat">
              <span class="feed-stat-lbl">P&amp;L</span>
              <span
                class="feed-stat-val"
                :class="feedClosedPnl >= 0 ? 'pnl-pos' : 'pnl-neg'"
              >{{ feedClosedPnl !== 0 ? formatPnl(feedClosedPnl) : '—' }}</span>
            </span>
            <span class="feed-stat">
              <span class="feed-stat-lbl">TRADES</span>
              <span class="feed-stat-val">{{ filteredTrades.length }}</span>
            </span>
          </div>
        </div>

        <!-- Empty feed state (after filter) -->
        <div v-if="filteredTrades.length === 0" class="feed-empty">
          <span>No {{ feedFilter === 'all' ? '' : feedFilter }} trades</span>
        </div>

        <!-- Trade items -->
        <div v-else class="feed">
          <div
            v-for="(n, i) in filteredTrades"
            :key="n.id"
            class="trade-row"
            :class="{ 'row-open': n.is_open, 'row-buy': isBuy(n.side), 'row-sell': !isBuy(n.side) }"
            :style="{ 'animation-delay': `${Math.min(i, 15) * 25}ms` }"
          >
            <!-- Direction -->
            <div class="trade-dir" :class="isBuy(n.side) ? 'dir-buy' : 'dir-sell'">
              <svg v-if="isBuy(n.side)" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
              <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </div>

            <!-- Symbol + side label -->
            <div class="trade-symbol-col">
              <div class="trade-sym">{{ n.symbol }}</div>
              <div class="trade-side" :class="isBuy(n.side) ? 'side-buy' : 'side-sell'">
                {{ isBuy(n.side) ? 'BUY' : 'SELL' }}
              </div>
            </div>

            <!-- Volume + prices -->
            <div class="trade-detail">
              <span class="trade-vol">{{ n.volume }}L</span>
              <span class="trade-prices">
                {{ n.open_price }}
                <template v-if="n.close_price !== null">
                  <span class="arrow">→</span>{{ n.close_price }}
                </template>
              </span>
              <span v-if="selectedId === null" class="trade-acct-tag">{{ n.account_alias }}</span>
            </div>

            <!-- P&L / open chip -->
            <div class="trade-pnl-col">
              <span
                v-if="!n.is_open && n.profit !== null"
                class="trade-pnl"
                :class="n.profit >= 0 ? 'pnl-pos' : 'pnl-neg'"
              >
                {{ formatPnl(n.profit) }}
              </span>
              <span v-else-if="n.is_open" class="open-chip">
                <span class="pip-sm" />LIVE
              </span>
            </div>

            <!-- Time -->
            <div class="trade-time">{{ formatTime(n.timestamp) }}</div>
          </div>
        </div>

      </section>
    </div>
  </div>
</template>

<style scoped>
.notifications-view {
  display: flex;
  flex-direction: column;
  max-width: 1200px;
  margin: 0 auto;
  animation: fadeInUp 0.4s var(--ease-out);
}

/* ── Header banner ───────────────────────────────────── */
.page-header {
  position: relative;
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
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
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

/* Header right stats */
.header-right {
  display: flex;
  align-items: flex-end;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
}

.hdr-block {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4px;
  padding: 14px 18px;
}

.hdr-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hdr-lbl {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.hdr-num {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
}

.hdr-status {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.hdr-status.syncing { color: var(--accent); }

.hdr-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: pulse-live 2.5s ease-in-out infinite;
  flex-shrink: 0;
}

.dot-dim {
  background: var(--text-tertiary);
  box-shadow: none;
  animation: none;
}

.hdr-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.hdr-div {
  width: 1px;
  background: var(--border-subtle);
  align-self: stretch;
}

.green { color: var(--green); }
.red   { color: var(--red); }
.accent { color: var(--accent); }

/* ── Controls bar ────────────────────────────────────── */
.controls-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 28px;
  height: 44px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.ctrl-group {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 0 4px;
}

.ctrl-lbl {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.ctrl-chips {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ctrl-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  height: 26px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-tertiary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
}

.ctrl-chip:hover {
  border-color: var(--border);
  color: var(--text-secondary);
}

.chip-on {
  background: var(--accent-muted) !important;
  border-color: rgba(240, 180, 41, 0.25) !important;
  color: var(--accent) !important;
}

.chip-on-live {
  background: var(--green-muted) !important;
  border-color: rgba(0, 212, 170, 0.25) !important;
  color: var(--green) !important;
}

.chip-count {
  font-size: 10px;
  opacity: 0.7;
}

.ctrl-sep {
  width: 1px;
  height: 20px;
  background: var(--border-subtle);
  margin: 0 8px;
  flex-shrink: 0;
}

.ctrl-grow { flex: 1; }

/* Toggle */
.toggle-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.sr-only { display: none; }

.toggle-track {
  width: 30px;
  height: 16px;
  background: var(--border);
  border-radius: 8px;
  position: relative;
  transition: background 0.2s;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  background: var(--text-tertiary);
  border-radius: 50%;
  transition: transform 0.2s, background 0.2s;
}

.sr-only:checked + .toggle-track { background: var(--accent-muted); border: 1px solid rgba(240,180,41,0.2); }
.sr-only:checked + .toggle-track .toggle-thumb {
  transform: translateX(14px);
  background: var(--accent);
}

/* Push notification controls */
.ctrl-push-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--accent-muted);
  border: 1px solid rgba(240, 180, 41, 0.2);
  border-radius: var(--radius-sm);
  color: var(--accent);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.ctrl-push-btn:hover:not(:disabled) {
  background: rgba(240, 180, 41, 0.15);
}

.ctrl-push-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: var(--text-tertiary);
  background: transparent;
  border-color: var(--border);
}

.push-on {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--green);
}

.test-btn {
  padding: 2px 8px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 2px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.12s;
  margin-left: 4px;
}

.test-btn:hover {
  border-color: var(--green);
  color: var(--green);
}

/* ── Empty state ─────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 100px 24px;
  text-align: center;
}

.empty-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  background: var(--surface);
  opacity: 0.5;
}

.empty-title {
  font-family: var(--font-ui);
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}

.empty-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
  max-width: 380px;
  line-height: 1.6;
}

/* ── All Accounts sidebar entry ──────────────────────── */
.acct-all-entry {
  border-bottom: 2px solid var(--border-subtle);
  margin-bottom: 2px;
}

/* ── Feed limit badge ────────────────────────────────── */
.feed-limit-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: 2px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-tertiary);
}

/* ── Account tag on trade rows (combined view) ───────── */
.trade-acct-tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--accent);
  background: var(--accent-muted);
  border: 1px solid rgba(240, 180, 41, 0.12);
  border-radius: 2px;
  padding: 1px 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

/* ── Body layout ─────────────────────────────────────── */
.body {
  display: grid;
  grid-template-columns: 220px 1fr;
  flex: 1;
  min-height: 0;
}

/* ── Account sidebar ─────────────────────────────────── */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-right: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
}

.sidebar-label {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--text-tertiary);
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.acct-card {
  padding: 12px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-subtle);
  border-left: 2px solid transparent;
  transition: background 0.12s, border-color 0.15s;
  animation: fadeInUp 0.3s var(--ease-out) both;
}

.acct-card:hover { background: var(--surface-hover); }

.acct-active {
  border-left-color: var(--accent) !important;
  background: var(--surface-hover);
}

.acct-live { border-left-color: rgba(240, 180, 41, 0.3); }

.acct-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}

.acct-name {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.acct-live-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  flex-shrink: 0;
}

.acct-pip {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 4px var(--accent);
  animation: pulse-live 2s ease-in-out infinite;
}

.acct-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.acct-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
}

.acct-pnl {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
}

/* ── Feed panel ──────────────────────────────────────── */
.feed-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.feed-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  gap: 12px;
  flex-shrink: 0;
}

.feed-hdr-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.feed-acct-name {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.feed-live-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 2px;
  background: var(--accent-muted);
  border: 1px solid rgba(240, 180, 41, 0.2);
  color: var(--accent);
  letter-spacing: 0.06em;
  animation: pulse-live 2s ease-in-out infinite;
}

.feed-hdr-right {
  display: flex;
  align-items: center;
  gap: 18px;
}

.feed-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.feed-stat-lbl {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-tertiary);
}

.feed-stat-val {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

/* Empty feed */
.feed-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-tertiary);
}

/* ── Trade rows ──────────────────────────────────────── */
.feed {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.trade-row {
  display: grid;
  grid-template-columns: 28px 80px 1fr auto 44px;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border-subtle);
  border-left: 2px solid transparent;
  animation: fadeInUp 0.25s var(--ease-out) both;
  transition: background 0.1s;
}

.trade-row:hover { background: var(--surface-hover); }
.trade-row:last-child { border-bottom: none; }

.row-open { border-left-color: var(--accent); }

/* Direction icon */
.trade-dir {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.dir-buy  { background: var(--green-muted); color: var(--green); }
.dir-sell { background: var(--red-muted);   color: var(--red); }

/* Symbol column */
.trade-symbol-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.trade-sym {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.trade-side {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.side-buy  { color: var(--green); }
.side-sell { color: var(--red); }

/* Detail column */
.trade-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.trade-vol {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}

.trade-prices {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arrow {
  color: var(--text-ghost);
  margin: 0 3px;
}

/* P&L column */
.trade-pnl-col {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.trade-pnl {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.open-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 2px 7px;
  border-radius: 2px;
  background: var(--accent-muted);
  border: 1px solid rgba(240, 180, 41, 0.2);
  color: var(--accent);
  animation: pulse-live 2s ease-in-out infinite;
}

/* Time */
.trade-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-ghost);
  text-align: right;
  white-space: nowrap;
}

/* Shared */
.pnl-pos { color: var(--green); }
.pnl-neg { color: var(--red); }

.pip-sm {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-live 2s ease-in-out infinite;
  flex-shrink: 0;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 768px) {
  .page-header {
    padding: 24px 16px 20px;
  }

  .page-title {
    font-size: 32px;
  }

  .header-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .header-right {
    width: 100%;
  }

  .hdr-block {
    flex: 1;
  }

  .controls-bar {
    padding: 0 16px;
    height: auto;
    padding-top: 8px;
    padding-bottom: 8px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ctrl-sep { display: none; }
  .ctrl-grow { display: none; }

  .body {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    max-height: none;
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--border-subtle);
    overflow-x: auto;
    overflow-y: visible;
  }

  .sidebar-label { display: none; }

  .acct-card {
    min-width: 150px;
    flex-shrink: 0;
    border-bottom: none;
    border-left: none;
    border-top: 2px solid transparent;
  }

  .acct-active {
    border-left-color: transparent !important;
    border-top-color: var(--accent) !important;
  }

  .trade-row {
    grid-template-columns: 28px 70px 1fr auto 36px;
    gap: 8px;
    padding: 10px 14px;
  }

  .trade-detail {
    display: none;
  }

  .trade-row {
    grid-template-columns: 28px 80px 1fr 36px;
  }
}
</style>
