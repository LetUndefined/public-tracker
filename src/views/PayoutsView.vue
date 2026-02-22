<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePayouts } from '@/composables/usePayouts'
import { useChallenges } from '@/composables/useChallenges'
import { usePageTour } from '@/composables/usePageTour'
import type { Payout } from '@/types'

const { payouts, loading, totalReceived, totalPending, fetchPayouts, addPayout, updatePayout, deletePayout } = usePayouts()
const { challenges, fetchChallenges } = useChallenges()

const statusFilter = ref<'all' | 'pending' | 'received' | 'rejected'>('all')
const showAddModal = ref(false)
const submitting = ref(false)
const formError = ref('')

const form = ref({
  challenge_id: '',
  amount: '',
  status: 'pending' as Payout['status'],
  requested_at: new Date().toISOString().split('T')[0],
  received_at: '',
  notes: '',
})

// ── Stats ─────────────────────────────────────────────────
const totalInvested = computed(() =>
  challenges.value.reduce((s, c) => s + (c.cost ?? 0), 0)
)
const netPnl = computed(() => totalReceived.value - totalInvested.value)
const roi = computed(() =>
  totalInvested.value > 0 ? (netPnl.value / totalInvested.value) * 100 : 0
)
const pendingCount  = computed(() => payouts.value.filter(p => p.status === 'pending').length)
const receivedCount = computed(() => payouts.value.filter(p => p.status === 'received').length)
const rejectedCount = computed(() => payouts.value.filter(p => p.status === 'rejected').length)

const filteredPayouts = computed(() => {
  if (statusFilter.value === 'all') return payouts.value
  return payouts.value.filter(p => p.status === statusFilter.value)
})

function getChallenge(id: string) {
  return challenges.value.find(c => c.id === id)
}

function fmt(v: number): string {
  return `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtRelative(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

async function handleMarkReceived(payout: Payout) {
  await updatePayout(payout.id, {
    status: 'received',
    received_at: new Date().toISOString().split('T')[0],
  })
}

async function handleDelete(id: string) {
  if (confirm('Remove this payout entry?')) {
    await deletePayout(id)
  }
}

async function handleSubmit() {
  if (!form.value.challenge_id || !form.value.amount) {
    formError.value = 'Challenge and amount are required.'
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    await addPayout({
      challenge_id: form.value.challenge_id,
      amount: parseFloat(form.value.amount),
      status: form.value.status,
      requested_at: form.value.requested_at,
      received_at: form.value.status === 'received' && form.value.received_at
        ? form.value.received_at
        : null,
      notes: form.value.notes || null,
    })
    showAddModal.value = false
    resetForm()
  } catch (e: any) {
    formError.value = e.message
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  form.value = {
    challenge_id: '',
    amount: '',
    status: 'pending',
    requested_at: new Date().toISOString().split('T')[0],
    received_at: '',
    notes: '',
  }
  formError.value = ''
}

const { startPageTour } = usePageTour()

onMounted(() => {
  fetchPayouts()
  fetchChallenges()
  startPageTour('payouts', [
    {
      title: 'Log Your Payouts',
      body: 'Record every payout you receive from your prop firms. Link each one to a challenge, add the amount and date.',
    },
    {
      title: 'Total Capital Extracted',
      body: 'The ledger tracks your running total across all firms. Use it to measure your real return on funded accounts.',
    },
  ])
})
</script>

<template>
  <div class="payouts-view">

    <!-- ── Banner Header ───────────────────────────────── -->
    <header class="page-header">
      <div class="header-grid" aria-hidden="true" />

      <div class="header-inner">
        <div class="header-left">
          <div class="header-tag">
            <span class="tag-mark">▸</span>
            CHALLENGE TRACKER
          </div>
          <h1 class="page-title">
            Payout<br />
            <span class="title-accent">Ledger</span>
          </h1>
        </div>

        <div class="header-right">
          <div class="hdr-stat-block">
            <div class="hdr-stat-row">
              <span class="hdr-big-num green">{{ fmt(totalReceived) }}</span>
            </div>
            <div class="hdr-stat-label">RECEIVED</div>
          </div>

          <div class="hdr-divider" />

          <div class="hdr-stat-block">
            <div class="hdr-stat-row">
              <span v-if="pendingCount > 0" class="hdr-live-dot amber-dot" />
              <span class="hdr-big-num" :class="pendingCount > 0 ? 'amber' : 'dim'">{{ fmt(totalPending) }}</span>
            </div>
            <div class="hdr-stat-label">PENDING</div>
          </div>

          <div class="hdr-divider" />

          <div class="hdr-stat-block hdr-accent">
            <div class="hdr-stat-row">
              <span class="hdr-big-num" :class="netPnl >= 0 ? 'green' : 'red'">
                {{ netPnl >= 0 ? '+' : '-' }}{{ fmt(Math.abs(netPnl)) }}
              </span>
            </div>
            <div class="hdr-stat-label">NET P&amp;L</div>
          </div>
        </div>
      </div>

      <!-- Loading bar -->
      <div v-if="loading" class="loading-bar">
        <div class="loading-progress" />
      </div>
    </header>

    <!-- ── Page body ───────────────────────────────────── -->
    <div class="page-body">

      <!-- ── Stats Strip ──────────────────────────────── -->
      <div class="strip-wrap">
        <div class="scan-line" />
        <div class="strip">

          <div class="cell">
            <div class="cell-label">ROI</div>
            <div class="cell-value" :class="roi >= 0 ? 'green' : 'red'">
              {{ roi >= 0 ? '+' : '' }}{{ Math.round(roi * 10) / 10 }}%
            </div>
            <div class="cell-sub">
              <span class="sub-dim">on capital</span>
            </div>
          </div>

          <div class="divider" />

          <div class="cell">
            <div class="cell-label">TOTAL PAYOUTS</div>
            <div class="cell-value accent">{{ payouts.length }}</div>
            <div class="cell-sub">
              <span v-if="rejectedCount > 0" class="sub-red">{{ rejectedCount }} rejected</span>
              <span v-else class="sub-dim">all time</span>
            </div>
          </div>

          <div class="divider" />

          <div class="cell cell-wide">
            <div class="cell-label">TOTAL INVESTED</div>
            <div class="cell-value orange">{{ totalInvested > 0 ? fmt(totalInvested) : '—' }}</div>
            <div class="cell-sub">
              <span class="sub-dim">challenge costs</span>
            </div>
          </div>

          <div class="divider" />

          <div class="cell">
            <div class="cell-label">RECEIVED</div>
            <div class="cell-value green">{{ receivedCount }}</div>
            <div class="cell-sub">
              <span class="sub-dim">confirmed</span>
            </div>
          </div>

          <div class="divider" />

          <div class="cell">
            <div class="cell-label">
              <span v-if="pendingCount > 0" class="live-pip" />
              PENDING
            </div>
            <div class="cell-value" :class="pendingCount > 0 ? 'amber' : 'dim'">{{ pendingCount }}</div>
            <div class="cell-sub">
              <span class="sub-dim">awaiting</span>
            </div>
          </div>

        </div>
        <div class="ticker-line" />
      </div>

      <!-- ── Command Bar ──────────────────────────────── -->
      <div class="cmd-bar">
        <div class="bar-sep" />

        <!-- Status filter chips -->
        <div class="filter-group">
          <span class="filter-key">STATUS</span>
          <div class="chips">
            <button
              :class="['chip', statusFilter === 'all' && 'chip-active']"
              @click="statusFilter = 'all'"
            >All <span class="chip-count">{{ payouts.length }}</span></button>
            <button
              :class="['chip chip-amber', statusFilter === 'pending' && 'chip-active']"
              @click="statusFilter = statusFilter === 'pending' ? 'all' : 'pending'"
            >
              <span class="status-pip pip-pending" />Pending <span class="chip-count">{{ pendingCount }}</span>
            </button>
            <button
              :class="['chip chip-green', statusFilter === 'received' && 'chip-active']"
              @click="statusFilter = statusFilter === 'received' ? 'all' : 'received'"
            >
              <span class="status-pip pip-received" />Received <span class="chip-count">{{ receivedCount }}</span>
            </button>
            <button
              :class="['chip chip-red', statusFilter === 'rejected' && 'chip-active']"
              @click="statusFilter = statusFilter === 'rejected' ? 'all' : 'rejected'"
            >
              Rejected <span class="chip-count">{{ rejectedCount }}</span>
            </button>
          </div>
        </div>

        <div class="bar-grow" />

        <!-- Log Payout button -->
        <button class="btn-add" @click="showAddModal = true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Log Payout
        </button>
      </div>

      <!-- ── Ledger Table (desktop) ───────────────────── -->
      <div class="table-wrapper desktop-table">
        <table class="ledger-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Challenge</th>
              <th class="text-right">Amount</th>
              <th>Requested</th>
              <th>Received</th>
              <th>Notes</th>
              <th class="th-actions" />
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredPayouts.length === 0">
              <td colspan="7" class="empty-state">
                <div class="empty-inner">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <path d="M2 10h20M6 15h4M14 15h4"/>
                  </svg>
                  <span>{{ statusFilter === 'all' ? 'No payouts logged yet.' : `No ${statusFilter} payouts.` }}</span>
                  <button v-if="statusFilter === 'all'" class="btn-add-empty" @click="showAddModal = true">
                    Log your first payout
                  </button>
                </div>
              </td>
            </tr>
            <tr
              v-for="(payout, i) in filteredPayouts"
              :key="payout.id"
              :class="['payout-row', `row-${payout.status}`]"
              :style="{ animationDelay: `${i * 30}ms` }"
            >
              <td>
                <div class="status-badge" :class="`status-${payout.status}`">
                  <span class="status-dot" :class="`dot-${payout.status}`" />
                  <span>{{ payout.status.toUpperCase() }}</span>
                </div>
              </td>
              <td>
                <div class="challenge-cell">
                  <span class="ch-alias">{{ getChallenge(payout.challenge_id)?.alias || '—' }}</span>
                  <span v-if="getChallenge(payout.challenge_id)?.prop_firm" class="ch-firm">
                    {{ getChallenge(payout.challenge_id)?.prop_firm }}
                  </span>
                </div>
              </td>
              <td class="text-right">
                <span class="amount" :class="`amount-${payout.status}`">
                  {{ fmt(payout.amount) }}
                </span>
              </td>
              <td>
                <div class="date-cell">
                  <span class="date-main">{{ fmtDate(payout.requested_at) }}</span>
                  <span class="date-rel">{{ fmtRelative(payout.requested_at) }}</span>
                </div>
              </td>
              <td>
                <span v-if="payout.received_at" class="date-main">{{ fmtDate(payout.received_at) }}</span>
                <span v-else class="text-ghost">—</span>
              </td>
              <td class="notes-td">
                <span v-if="payout.notes" class="notes-text" :title="payout.notes">{{ payout.notes }}</span>
                <span v-else class="text-ghost">—</span>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    v-if="payout.status === 'pending'"
                    class="btn-receive"
                    title="Mark as received"
                    @click="handleMarkReceived(payout)"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  </button>
                  <button class="btn-delete" title="Remove" @click="handleDelete(payout.id)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Mobile Cards ─────────────────────────────── -->
      <div class="mobile-cards">
        <div v-if="filteredPayouts.length === 0" class="empty-state-mobile">
          <span>{{ statusFilter === 'all' ? 'No payouts logged yet.' : `No ${statusFilter} payouts.` }}</span>
          <button v-if="statusFilter === 'all'" class="btn-add-empty" @click="showAddModal = true">
            Log your first payout
          </button>
        </div>
        <div
          v-for="(payout, i) in filteredPayouts"
          :key="payout.id"
          :class="['payout-card', `card-${payout.status}`]"
          :style="{ animationDelay: `${i * 40}ms` }"
        >
          <div class="card-top">
            <div class="status-badge" :class="`status-${payout.status}`">
              <span class="status-dot" :class="`dot-${payout.status}`" />
              <span>{{ payout.status.toUpperCase() }}</span>
            </div>
            <span class="amount" :class="`amount-${payout.status}`">{{ fmt(payout.amount) }}</span>
          </div>
          <div class="card-challenge">
            <span class="ch-alias">{{ getChallenge(payout.challenge_id)?.alias || '—' }}</span>
            <span v-if="getChallenge(payout.challenge_id)?.prop_firm" class="ch-firm">
              {{ getChallenge(payout.challenge_id)?.prop_firm }}
            </span>
          </div>
          <div class="card-dates">
            <div class="card-date-item">
              <span class="card-date-label">REQUESTED</span>
              <span class="date-main">{{ fmtDate(payout.requested_at) }}</span>
              <span class="date-rel">{{ fmtRelative(payout.requested_at) }}</span>
            </div>
            <div v-if="payout.received_at" class="card-date-item">
              <span class="card-date-label">RECEIVED</span>
              <span class="date-main">{{ fmtDate(payout.received_at) }}</span>
            </div>
          </div>
          <div v-if="payout.notes" class="card-notes">{{ payout.notes }}</div>
          <div class="card-actions">
            <button
              v-if="payout.status === 'pending'"
              class="btn-receive-full"
              @click="handleMarkReceived(payout)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Mark Received
            </button>
            <button class="btn-delete-sm" @click="handleDelete(payout.id)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

    </div><!-- /.page-body -->
  </div>

  <!-- ── Add Payout Modal ────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false; resetForm()">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-eyebrow">// NEW ENTRY</div>
              <h2 class="modal-title">Log Payout</h2>
            </div>
            <button class="modal-close" @click="showAddModal = false; resetForm()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div v-if="formError" class="form-error">{{ formError }}</div>

            <div class="form-grid">
              <div class="form-field form-full">
                <label class="form-label">Challenge</label>
                <select v-model="form.challenge_id" class="form-select">
                  <option value="" disabled>Select a challenge…</option>
                  <option v-for="ch in challenges" :key="ch.id" :value="ch.id">
                    {{ ch.alias || ch.login_number }} — {{ ch.prop_firm }}
                  </option>
                </select>
              </div>

              <div class="form-field">
                <label class="form-label">Amount ($)</label>
                <input
                  v-model="form.amount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-input"
                  placeholder="0.00"
                />
              </div>

              <div class="form-field">
                <label class="form-label">Status</label>
                <select v-model="form.status" class="form-select">
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div class="form-field">
                <label class="form-label">Requested Date</label>
                <input v-model="form.requested_at" type="date" class="form-input" />
              </div>

              <div v-if="form.status === 'received'" class="form-field">
                <label class="form-label">Received Date</label>
                <input v-model="form.received_at" type="date" class="form-input" />
              </div>

              <div class="form-field form-full">
                <label class="form-label">Notes <span class="form-optional">(optional)</span></label>
                <textarea
                  v-model="form.notes"
                  class="form-textarea"
                  rows="2"
                  placeholder="e.g. FTMO Phase 1 pass payout"
                />
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="showAddModal = false; resetForm()">Cancel</button>
            <button class="btn-submit" :disabled="submitting" @click="handleSubmit">
              <span v-if="submitting">Saving…</span>
              <span v-else>Log Payout</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── View ──────────────────────────────────────────────── */
.payouts-view {
  padding: 0;
  max-width: 1440px;
  margin: 0 auto;
  animation: fadeInUp 0.35s var(--ease-out);
}

/* ── Banner Header ─────────────────────────────────────── */
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
  background: linear-gradient(
    to right,
    var(--surface) 0%,
    transparent 20%,
    transparent 70%,
    var(--surface) 100%
  );
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

/* Header right stats card */
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

.hdr-big-num.green  { color: var(--green); }
.hdr-big-num.red    { color: var(--red); }
.hdr-big-num.amber  { color: var(--accent); }
.hdr-big-num.dim    { color: var(--text-tertiary); }

.hdr-divider {
  width: 1px;
  background: var(--border-subtle);
  align-self: stretch;
}

.hdr-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse-live 2.5s ease-in-out infinite;
}

.amber-dot {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

/* Loading bar */
.loading-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--border-subtle);
  overflow: hidden;
  z-index: 1;
}

.loading-progress {
  height: 100%;
  width: 40%;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: loading-slide 1.2s ease-in-out infinite;
}

@keyframes loading-slide {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

/* ── Page body ─────────────────────────────────────────── */
.page-body {
  padding: 0 28px 28px;
}

/* ── Stats Strip ───────────────────────────────────────── */
.strip-wrap {
  position: relative;
  margin: 20px 0 14px;
}

.scan-line {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--accent) 30%, var(--cyan) 60%, transparent 100%);
  opacity: 0.5;
  animation: scan 4s ease-in-out infinite;
  background-size: 200% 100%;
}

@keyframes scan {
  0%   { background-position: -100% 0; opacity: 0.3; }
  50%  { background-position: 100% 0;  opacity: 0.6; }
  100% { background-position: -100% 0; opacity: 0.3; }
}

@keyframes spin { to { transform: rotate(360deg); } }

.strip {
  display: flex;
  align-items: stretch;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-top: none;
  border-bottom: none;
  overflow: hidden;
}

.ticker-line {
  height: 1px;
  background: var(--border-subtle);
}

.cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 14px 18px;
  min-width: 0;
}

.cell-wide { flex: 1.4; }

.cell-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
  text-transform: uppercase;
  white-space: nowrap;
}

.cell-value {
  font-family: var(--font-mono);
  font-size: 21px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
  white-space: nowrap;
  color: var(--text-primary);
}

.cell-value.accent { color: var(--accent); }
.cell-value.green  { color: var(--green); }
.cell-value.red    { color: var(--red); }
.cell-value.amber  { color: var(--accent); }
.cell-value.orange { color: var(--orange); }
.cell-value.dim    { color: var(--text-tertiary); }

.cell-sub {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  white-space: nowrap;
}

.sub-dim { color: var(--text-tertiary); }
.sub-red { color: var(--red); }

.divider {
  width: 1px;
  background: var(--border-subtle);
  flex-shrink: 0;
  margin: 10px 0;
}

.live-pip {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: pulse-live 2s ease-in-out infinite;
}

/* ── Command Bar ───────────────────────────────────────── */
.cmd-bar {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 14px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  height: 46px;
}

.bar-sep {
  width: 1px;
  height: 100%;
  background: var(--border-subtle);
  flex-shrink: 0;
}

.bar-grow { flex: 1; }

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  height: 100%;
  flex-shrink: 0;
}

.filter-key {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.chips {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
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
  line-height: 1;
  height: 26px;
}

.chip:hover {
  border-color: var(--border);
  color: var(--text-secondary);
  background: var(--surface-hover);
}

.chip-active {
  background: var(--accent-muted) !important;
  border-color: rgba(240, 180, 41, 0.25) !important;
  color: var(--accent) !important;
}

.chip-green.chip-active {
  background: var(--green-muted) !important;
  border-color: rgba(0, 212, 170, 0.25) !important;
  color: var(--green) !important;
}

.chip-amber.chip-active {
  background: var(--accent-muted) !important;
  border-color: rgba(240, 180, 41, 0.25) !important;
  color: var(--accent) !important;
}

.chip-red.chip-active {
  background: var(--red-muted) !important;
  border-color: rgba(255, 71, 87, 0.25) !important;
  color: var(--red) !important;
}

.chip-count {
  font-size: 10px;
  opacity: 0.6;
}

.status-pip {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pip-pending  { background: var(--accent); animation: pulse-live 2s ease-in-out infinite; }
.pip-received { background: var(--green); }

.btn-add {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 20px;
  height: 100%;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-left: 1px solid rgba(240, 180, 41, 0.3);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s;
}

.btn-add:hover { background: var(--accent-bright); }

/* ── Ledger Table ──────────────────────────────────────── */
.table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.ledger-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.ledger-table th {
  padding: 10px 14px;
  text-align: left;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.th-actions { width: 64px; }
.text-right { text-align: right; }

.ledger-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  white-space: nowrap;
}

.payout-row {
  animation: fadeInUp 0.35s var(--ease-out) both;
  transition: background 0.12s;
}

.payout-row:last-child td { border-bottom: none; }
.payout-row:hover { background: var(--surface-hover); }

.row-pending  { border-left: 2px solid var(--accent); }
.row-received { border-left: 2px solid var(--green); }
.row-rejected { border-left: 2px solid var(--red); }

.row-pending  td:first-child { padding-left: 12px; }
.row-received td:first-child { padding-left: 12px; }
.row-rejected td:first-child { padding-left: 12px; }

/* Status badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.status-pending  { background: var(--accent-muted);  color: var(--accent); border: 1px solid rgba(240, 180, 41, 0.15); }
.status-received { background: var(--green-muted);   color: var(--green);  border: 1px solid rgba(0, 212, 170, 0.15); }
.status-rejected { background: var(--red-muted);     color: var(--red);    border: 1px solid rgba(255, 71, 87, 0.15); }

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-pending  { background: var(--accent); animation: pulse-live 2s ease-in-out infinite; }
.dot-received { background: var(--green); }
.dot-rejected { background: var(--red); }

/* Challenge cell */
.challenge-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ch-alias {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.ch-firm {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  background: var(--accent-muted);
  color: var(--accent);
  border: 1px solid rgba(240, 180, 41, 0.12);
  width: fit-content;
}

/* Amount */
.amount {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.amount-pending  { color: var(--accent); }
.amount-received { color: var(--green); }
.amount-rejected { color: var(--text-tertiary); text-decoration: line-through; }

/* Date */
.date-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.date-main {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.date-rel {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
}

/* Notes */
.notes-td { max-width: 200px; }
.notes-text {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  max-width: 200px;
}

.text-ghost { color: var(--text-tertiary); }

/* Row actions */
.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-receive, .btn-delete {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-receive:hover {
  background: var(--green-muted);
  border-color: rgba(0, 212, 170, 0.2);
  color: var(--green);
}

.btn-delete:hover {
  background: var(--red-muted);
  border-color: rgba(255, 71, 87, 0.2);
  color: var(--red);
}

/* Empty state */
.empty-state { text-align: center; padding: 52px 20px !important; }
.empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.btn-add-empty {
  margin-top: 4px;
  padding: 6px 16px;
  background: var(--accent-muted);
  border: 1px solid rgba(240, 180, 41, 0.2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0.04em;
}

.btn-add-empty:hover { background: rgba(240, 180, 41, 0.15); }

/* ── Mobile Cards ──────────────────────────────────────── */
.mobile-cards { display: none; }

/* ── Modal ─────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 16px;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 480px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  animation: slideDown 0.25s var(--ease-out);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-eyebrow {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--accent);
  opacity: 0.7;
  margin-bottom: 2px;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.modal-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}

.modal-close:hover { color: var(--text-primary); border-color: var(--border); }

.modal-body { padding: 20px; }

.form-error {
  padding: 8px 12px;
  background: var(--red-muted);
  border: 1px solid rgba(255, 71, 87, 0.15);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--red);
  margin-bottom: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-full { grid-column: 1 / -1; }

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
}

.form-optional {
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  opacity: 0.6;
}

.form-input,
.form-select,
.form-textarea {
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--accent);
}

.form-textarea { resize: vertical; min-height: 56px; }
.form-select option { background: var(--bg); }

input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(0.4);
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-subtle);
}

.btn-cancel {
  padding: 7px 16px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover { border-color: var(--text-tertiary); color: var(--text-secondary); }

.btn-submit {
  padding: 7px 20px;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--bg);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-submit:hover:not(:disabled) { background: var(--accent-bright); }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* Modal transition */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal, .modal-leave-active .modal { transition: transform 0.2s var(--ease-out); }
.modal-enter-from .modal, .modal-leave-to .modal { transform: scale(0.97) translateY(8px); }

/* ── Responsive ────────────────────────────────────────── */
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

  .page-body { padding: 0 16px 16px; }
}

@media (max-width: 1100px) {
  .strip {
    flex-wrap: wrap;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }
  .cell { flex: 1 1 30%; border-bottom: 1px solid var(--border-subtle); padding: 12px 16px; }
  .cell:nth-last-child(-n+3) { border-bottom: none; }
  .divider { display: none; }
  .scan-line { border-radius: var(--radius-md) var(--radius-md) 0 0; }
  .ticker-line { display: none; }
}

@media (max-width: 900px) {
  .cmd-bar {
    height: auto;
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    padding: 8px 14px;
    height: auto;
    border-bottom: 1px solid var(--border-subtle);
    flex-wrap: wrap;
  }

  .bar-sep { display: none; }
  .bar-grow { display: none; }

  .btn-add {
    border: none;
    border-top: 1px solid rgba(240, 180, 41, 0.15);
    padding: 11px 14px;
    justify-content: center;
    height: auto;
  }
}

@media (max-width: 640px) {
  .strip .cell { flex: 1 1 45%; }
  .strip .cell:nth-last-child(-n+3) { border-bottom: 1px solid var(--border-subtle); }
  .strip .cell:nth-last-child(-n+2) { border-bottom: none; }
  .cell-value { font-size: 17px; }

  .desktop-table { display: none; }

  .mobile-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .empty-state-mobile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 52px 20px;
    color: var(--text-tertiary);
    font-size: 13px;
    text-align: center;
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }

  .payout-card {
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 14px;
    animation: fadeInUp 0.35s var(--ease-out) both;
    border-left-width: 3px;
  }

  .card-pending  { border-left-color: var(--accent); }
  .card-received { border-left-color: var(--green); }
  .card-rejected { border-left-color: var(--red); }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .card-challenge {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .card-dates {
    display: flex;
    gap: 20px;
    margin-bottom: 10px;
  }

  .card-date-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .card-date-label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-tertiary);
  }

  .card-notes {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 10px;
    padding: 8px 10px;
    background: var(--bg);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle);
  }

  .btn-receive-full {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px;
    background: var(--green-muted);
    border: 1px solid rgba(0, 212, 170, 0.2);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--green);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-delete-sm {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-delete-sm:hover { background: var(--red-muted); color: var(--red); }
}
</style>
