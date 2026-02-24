<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useChallenges } from '@/composables/useChallenges'
import { useAuth } from '@/composables/useAuth'
import { usePageTour } from '@/composables/usePageTour'

interface HistoryEntry {
  id: string
  challenge_id: string | null
  alias: string
  prop_firm: string
  phase: string
  outcome: 'Passed' | 'Failed' | 'Abandoned' | 'Active'
  starting_balance: number
  final_balance: number
  payout_received: number
  started_at: string | null
  ended_at: string | null
  duration_days: number | null
  notes: string | null
  created_at: string
}

const { challengeRows, fetchChallenges } = useChallenges()
const { user } = useAuth()

const entries = ref<HistoryEntry[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingEntry = ref<HistoryEntry | null>(null)
const suggestions = ref<HistoryEntry[]>([])

const form = ref({
  challenge_id: '',
  alias: '',
  prop_firm: '',
  phase: '',
  outcome: 'Passed' as 'Passed' | 'Failed' | 'Abandoned' | 'Active',
  starting_balance: '',
  final_balance: '',
  payout_received: '',
  started_at: '',
  ended_at: '',
  notes: '',
})

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('challenge_history')
    .select('*')
    .order('ended_at', { ascending: false })
  // Active entries float to the top
  const raw = data ?? []
  entries.value = raw.sort((a, b) => {
    if (a.outcome === 'Active' && b.outcome !== 'Active') return -1
    if (a.outcome !== 'Active' && b.outcome === 'Active') return 1
    return 0
  })
  loading.value = false
}

function buildSuggestions() {
  const s: HistoryEntry[] = []
  for (const row of challengeRows.value) {
    if (row.is_master) continue
    if (row.target_pct > 0 && row.progress >= row.target_pct) {
      s.push({
        id: '',
        challenge_id: row.id,
        alias: row.alias,
        prop_firm: row.prop_firm,
        phase: row.phase,
        outcome: 'Passed',
        starting_balance: row.starting_balance,
        final_balance: row.balance,
        payout_received: 0,
        started_at: row.started_at ?? null,
        ended_at: new Date().toISOString().slice(0, 10),
        duration_days: null,
        notes: null,
        created_at: '',
      })
    }
  }
  const loggedIds = new Set(entries.value.map(e => e.challenge_id).filter(Boolean))
  suggestions.value = s.filter(s => !loggedIds.has(s.challenge_id))
}

function openAdd(prefill?: Partial<typeof form.value>) {
  editingEntry.value = null
  form.value = {
    challenge_id: prefill?.challenge_id ?? '',
    alias: prefill?.alias ?? '',
    prop_firm: prefill?.prop_firm ?? '',
    phase: prefill?.phase ?? '',
    outcome: (prefill?.outcome as any) ?? 'Passed',
    starting_balance: prefill?.starting_balance ?? '',
    final_balance: prefill?.final_balance ?? '',
    payout_received: prefill?.payout_received ?? '',
    started_at: prefill?.started_at ?? '',
    ended_at: prefill?.ended_at ?? new Date().toISOString().slice(0, 10),
    notes: prefill?.notes ?? '',
  }
  showModal.value = true
}

function openEdit(entry: HistoryEntry) {
  editingEntry.value = entry
  form.value = {
    challenge_id: entry.challenge_id ?? '',
    alias: entry.alias,
    prop_firm: entry.prop_firm,
    phase: entry.phase,
    outcome: entry.outcome,
    starting_balance: entry.starting_balance ? String(entry.starting_balance) : '',
    final_balance: entry.final_balance ? String(entry.final_balance) : '',
    payout_received: entry.payout_received ? String(entry.payout_received) : '',
    started_at: entry.started_at ?? '',
    ended_at: entry.ended_at ?? '',
    notes: entry.notes ?? '',
  }
  showModal.value = true
}

function onChallengeSelect() {
  const row = challengeRows.value.find(r => r.id === form.value.challenge_id)
  if (!row) return
  form.value.alias = row.alias
  form.value.prop_firm = row.prop_firm
  form.value.phase = row.phase
  form.value.starting_balance = String(row.starting_balance)
  form.value.final_balance = String(row.balance)
  if (row.started_at) form.value.started_at = row.started_at.slice(0, 10)
}

async function save() {
  const payload = {
    user_id: user.value?.id,
    challenge_id: form.value.challenge_id || null,
    alias: form.value.alias,
    prop_firm: form.value.prop_firm,
    phase: form.value.phase,
    outcome: form.value.outcome,
    starting_balance: parseFloat(form.value.starting_balance) || 0,
    final_balance: parseFloat(form.value.final_balance) || 0,
    payout_received: parseFloat(form.value.payout_received) || 0,
    started_at: form.value.started_at || null,
    ended_at: form.value.ended_at || null,
    notes: form.value.notes || null,
  }

  if (editingEntry.value) {
    const { data } = await supabase
      .from('challenge_history')
      .update(payload)
      .eq('id', editingEntry.value.id)
      .select()
      .single()
    if (data) {
      const idx = entries.value.findIndex(e => e.id === editingEntry.value!.id)
      if (idx !== -1) entries.value[idx] = data
    }
  } else {
    const { data } = await supabase
      .from('challenge_history')
      .insert(payload)
      .select()
      .single()
    if (data) entries.value.unshift(data)
  }
  showModal.value = false
  buildSuggestions()
}

async function quickSetOutcome(entry: HistoryEntry, outcome: 'Passed' | 'Failed' | 'Abandoned') {
  const ended_at = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('challenge_history')
    .update({ outcome, ended_at })
    .eq('id', entry.id)
    .select()
    .single()
  if (data) {
    const idx = entries.value.findIndex(e => e.id === entry.id)
    if (idx !== -1) entries.value[idx] = data
    // Re-sort so completed entries move below active ones
    entries.value = [...entries.value].sort((a, b) => {
      if (a.outcome === 'Active' && b.outcome !== 'Active') return -1
      if (a.outcome !== 'Active' && b.outcome === 'Active') return 1
      return 0
    })
  }
}

async function deleteEntry(id: string) {
  if (!confirm('Delete this history entry?')) return
  await supabase.from('challenge_history').delete().eq('id', id)
  entries.value = entries.value.filter(e => e.id !== id)
}

function pnlPct(entry: HistoryEntry): string {
  if (!entry.starting_balance || !entry.final_balance) return ''
  const pct = ((entry.final_balance - entry.starting_balance) / entry.starting_balance) * 100
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'
}

function pnlClass(entry: HistoryEntry): string {
  if (!entry.starting_balance || !entry.final_balance) return ''
  return entry.final_balance >= entry.starting_balance ? 'pos' : 'neg'
}

function fmt(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return d.slice(0, 10)
}

function phaseKey(phase: string): 'p1' | 'p2' | 'funded' | null {
  const p = phase.toLowerCase()
  if (/fund/.test(p)) return 'funded'
  if (/1/.test(p)) return 'p1'
  if (/2/.test(p)) return 'p2'
  return null
}

function avgDaysByPhase(outcome: 'Passed' | 'Failed') {
  const rows = entries.value.filter(e => e.outcome === outcome && e.duration_days !== null)
  const avg = (list: typeof rows) =>
    list.length ? Math.round(list.reduce((s, e) => s + e.duration_days!, 0) / list.length) : null
  return {
    p1:     avg(rows.filter(e => phaseKey(e.phase) === 'p1')),
    p2:     avg(rows.filter(e => phaseKey(e.phase) === 'p2')),
    funded: avg(rows.filter(e => phaseKey(e.phase) === 'funded')),
    hasAny: rows.length > 0,
  }
}

const stats = computed(() => {
  const active    = entries.value.filter(e => e.outcome === 'Active').length
  const passed    = entries.value.filter(e => e.outcome === 'Passed').length
  const failed    = entries.value.filter(e => e.outcome === 'Failed').length
  const abandoned = entries.value.filter(e => e.outcome === 'Abandoned').length
  const completed = passed + failed + abandoned
  const payout    = entries.value.reduce((s, e) => s + (e.payout_received ?? 0), 0)
  const passRate  = completed > 0 ? Math.round(passed / completed * 100) : 0
  const passAvg   = avgDaysByPhase('Passed')
  const failAvg   = avgDaysByPhase('Failed')
  return { active, passed, failed, abandoned, completed, payout, passRate, passAvg, failAvg }
})

const { startPageTour } = usePageTour()

onMounted(async () => {
  await fetchChallenges()
  await load()
  buildSuggestions()
  startPageTour('history', [
    {
      title: 'Challenge Log',
      body: 'Archive completed challenges here — mark them Passed, Failed, or Abandoned. This builds your personal prop firm track record.',
    },
    {
      title: 'Pass/Fail Scoreboard',
      body: 'The stats at the top show your overall pass rate and the average number of days it took to pass or fail each phase.',
    },
  ])
})
</script>

<template>
  <div class="hv">

    <!-- ── Top bar ── -->
    <div class="hv-topbar">
      <div class="hv-identity">
        <div class="hv-eyebrow">CHALLENGE LEDGER</div>
        <h1 class="hv-title">History</h1>
      </div>
      <button class="hv-log-btn" @click="openAdd()">
        <span class="log-btn-plus">+</span>
        <span>Log Outcome</span>
      </button>
    </div>

    <!-- ── Stats scoreboard ── -->
    <div class="scoreboard" v-if="entries.length > 0">
      <template v-if="stats.active > 0">
        <div class="sb-cell">
          <div class="sb-label">ACTIVE</div>
          <div class="sb-val sb-accent">{{ stats.active }}</div>
        </div>
        <div class="sb-sep" />
      </template>
      <div class="sb-cell">
        <div class="sb-label">COMPLETED</div>
        <div class="sb-val">{{ stats.completed }}</div>
      </div>
      <div class="sb-sep" />
      <div class="sb-cell">
        <div class="sb-label">PASSED</div>
        <div class="sb-val sb-green">{{ stats.passed }}</div>
      </div>
      <div class="sb-sep" />
      <div class="sb-cell">
        <div class="sb-label">FAILED</div>
        <div class="sb-val sb-red">{{ stats.failed }}</div>
      </div>
      <div class="sb-sep" />
      <div class="sb-cell">
        <div class="sb-label">WIN RATE</div>
        <div class="sb-val" :class="stats.passRate >= 50 ? 'sb-green' : 'sb-red'">{{ stats.passRate }}<span class="sb-unit">%</span></div>
      </div>
      <div class="sb-sep" />
      <div class="sb-cell sb-cell--wide">
        <div class="sb-label">TOTAL EXTRACTED</div>
        <div class="sb-val sb-accent">{{ fmt(stats.payout) }}</div>
      </div>
      <template v-if="stats.passAvg.hasAny">
        <div class="sb-sep" />
        <div class="sb-cell sb-cell--phases">
          <div class="sb-label sb-label--green">AVG DAYS · PASS</div>
          <div class="sb-phase-rows">
            <div class="sb-phase-row" v-if="stats.passAvg.p1 !== null">
              <span class="sb-phase-tag">PH1</span>
              <span class="sb-phase-val">{{ stats.passAvg.p1 }}<span class="sb-phase-unit">d</span></span>
            </div>
            <div class="sb-phase-row" v-if="stats.passAvg.p2 !== null">
              <span class="sb-phase-tag">PH2</span>
              <span class="sb-phase-val">{{ stats.passAvg.p2 }}<span class="sb-phase-unit">d</span></span>
            </div>
            <div class="sb-phase-row" v-if="stats.passAvg.funded !== null">
              <span class="sb-phase-tag">FND</span>
              <span class="sb-phase-val">{{ stats.passAvg.funded }}<span class="sb-phase-unit">d</span></span>
            </div>
            <div class="sb-phase-row sb-phase-empty" v-if="stats.passAvg.p1 === null && stats.passAvg.p2 === null && stats.passAvg.funded === null">
              <span class="sb-phase-val">—</span>
            </div>
          </div>
        </div>
      </template>
      <template v-if="stats.failAvg.hasAny">
        <div class="sb-sep" />
        <div class="sb-cell sb-cell--phases">
          <div class="sb-label sb-label--red">AVG DAYS · FAIL</div>
          <div class="sb-phase-rows">
            <div class="sb-phase-row" v-if="stats.failAvg.p1 !== null">
              <span class="sb-phase-tag">PH1</span>
              <span class="sb-phase-val">{{ stats.failAvg.p1 }}<span class="sb-phase-unit">d</span></span>
            </div>
            <div class="sb-phase-row" v-if="stats.failAvg.p2 !== null">
              <span class="sb-phase-tag">PH2</span>
              <span class="sb-phase-val">{{ stats.failAvg.p2 }}<span class="sb-phase-unit">d</span></span>
            </div>
            <div class="sb-phase-row" v-if="stats.failAvg.funded !== null">
              <span class="sb-phase-tag">FND</span>
              <span class="sb-phase-val">{{ stats.failAvg.funded }}<span class="sb-phase-unit">d</span></span>
            </div>
            <div class="sb-phase-row sb-phase-empty" v-if="stats.failAvg.p1 === null && stats.failAvg.p2 === null && stats.failAvg.funded === null">
              <span class="sb-phase-val">—</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Win bar -->
      <div class="sb-win-bar">
        <div
          class="sb-win-fill"
          :style="{ width: stats.passRate + '%' }"
        />
      </div>
    </div>

    <!-- ── Ledger ── -->
    <div class="ledger-wrap">
      <div v-if="loading" class="ledger-empty">
        <span class="ledger-spinner" />
        <span>Loading records...</span>
      </div>
      <div v-else-if="entries.length === 0" class="ledger-empty">
        <div class="ledger-empty-icon">≡</div>
        <div class="ledger-empty-text">No records in the ledger.</div>
        <div class="ledger-empty-sub">Log your first outcome to get started.</div>
      </div>

      <table v-else class="ledger">
        <thead>
          <tr class="ledger-head">
            <th class="lh-status" />
            <th>Account</th>
            <th>Firm</th>
            <th>Phase</th>
            <th class="lh-r">Starting</th>
            <th class="lh-r">Final</th>
            <th class="lh-r">P&L</th>
            <th class="lh-r">Payout</th>
            <th>Period</th>
            <th class="lh-r lh-days">Days</th>
            <th class="lh-notes">Notes</th>
            <th class="lh-act" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(entry, i) in entries"
            :key="entry.id"
            class="ledger-row"
            :class="'row-' + entry.outcome.toLowerCase()"
            :style="{ animationDelay: `${i * 30}ms` }"
          >
            <!-- Left status bar -->
            <td class="lc-status">
              <span class="status-pill" :class="'pill-' + entry.outcome.toLowerCase()">
                <span v-if="entry.outcome === 'Active'" class="pill-active-dot" />
                {{ entry.outcome === 'Passed' ? 'PASS' : entry.outcome === 'Failed' ? 'FAIL' : entry.outcome === 'Active' ? 'ACTIVE' : 'ABND' }}
              </span>
            </td>
            <td class="lc-alias">{{ entry.alias }}</td>
            <td class="lc-firm">{{ entry.prop_firm }}</td>
            <td class="lc-phase">{{ entry.phase }}</td>
            <td class="lc-r lc-money">{{ entry.starting_balance > 0 ? fmt(entry.starting_balance) : '—' }}</td>
            <td class="lc-r lc-money">{{ entry.final_balance > 0 ? fmt(entry.final_balance) : '—' }}</td>
            <td class="lc-r lc-pnl" :class="pnlClass(entry)">{{ pnlPct(entry) || '—' }}</td>
            <td class="lc-r lc-payout" :class="entry.payout_received > 0 ? 'lc-extracted' : ''">
              {{ entry.payout_received > 0 ? fmt(entry.payout_received) : '—' }}
            </td>
            <td class="lc-period">
              <span class="period-start">{{ fmtDate(entry.started_at) }}</span>
              <span class="period-arrow">→</span>
              <span v-if="entry.outcome === 'Active'" class="period-end period-ongoing">ongoing</span>
              <span v-else class="period-end">{{ fmtDate(entry.ended_at) }}</span>
            </td>
            <td class="lc-r lc-days">{{ entry.duration_days ?? '—' }}</td>
            <td class="lc-notes">{{ entry.notes ?? '' }}</td>
            <td class="lc-act" :class="entry.outcome === 'Active' ? 'lc-act--active' : ''">
              <template v-if="entry.outcome === 'Active'">
                <button class="qsa-btn qsa-pass" @click="quickSetOutcome(entry, 'Passed')" title="Mark Passed">PASS</button>
                <button class="qsa-btn qsa-fail" @click="quickSetOutcome(entry, 'Failed')" title="Mark Failed">FAIL</button>
                <button class="qsa-btn qsa-abnd" @click="quickSetOutcome(entry, 'Abandoned')" title="Mark Abandoned">ABND</button>
              </template>
              <template v-else>
                <button class="act-edit" @click="openEdit(entry)" title="Edit">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="act-del" @click="deleteEntry(entry.id)" title="Delete">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Modal ── -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-veil" @click.self="showModal = false">
        <div class="modal-box">

          <div class="modal-top">
            <div class="modal-top-left">
              <div class="modal-eyebrow">{{ editingEntry ? 'EDIT RECORD' : 'NEW RECORD' }}</div>
              <div class="modal-top-title">{{ editingEntry ? 'Edit Entry' : 'Log Outcome' }}</div>
            </div>
            <button class="modal-x" @click="showModal = false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">

            <div class="field-row">
              <label class="field-lbl">Link to Active Challenge</label>
              <select v-model="form.challenge_id" @change="onChallengeSelect" class="field-ctrl">
                <option value="">— None —</option>
                <option v-for="row in challengeRows.filter(r => !r.is_master)" :key="row.id" :value="row.id">
                  {{ row.alias }} · {{ row.prop_firm }} · {{ row.phase }}
                </option>
              </select>
            </div>

            <div class="field-grid-2">
              <div class="field-row">
                <label class="field-lbl">Account Alias *</label>
                <input v-model="form.alias" class="field-ctrl" placeholder="e.g. FTMO-001" />
              </div>
              <div class="field-row">
                <label class="field-lbl">Prop Firm *</label>
                <input v-model="form.prop_firm" class="field-ctrl" placeholder="e.g. FTMO" />
              </div>
            </div>

            <div class="field-grid-2">
              <div class="field-row">
                <label class="field-lbl">Phase *</label>
                <input v-model="form.phase" class="field-ctrl" placeholder="e.g. Phase 1" />
              </div>
              <div class="field-row">
                <label class="field-lbl">Outcome *</label>
                <div class="outcome-toggle">
                  <button
                    v-for="o in ['Active', 'Passed', 'Failed', 'Abandoned']"
                    :key="o"
                    type="button"
                    class="ot-btn"
                    :class="['ot-' + o.toLowerCase(), form.outcome === o ? 'ot-active' : '']"
                    @click="form.outcome = o as any"
                  >{{ o }}</button>
                </div>
              </div>
            </div>

            <div class="field-grid-3">
              <div class="field-row">
                <label class="field-lbl">Starting Balance</label>
                <input v-model="form.starting_balance" type="number" class="field-ctrl" placeholder="10000" />
              </div>
              <div class="field-row">
                <label class="field-lbl">Final Balance</label>
                <input v-model="form.final_balance" type="number" class="field-ctrl" placeholder="11000" />
              </div>
              <div class="field-row">
                <label class="field-lbl">Payout Received</label>
                <input v-model="form.payout_received" type="number" class="field-ctrl" placeholder="0" />
              </div>
            </div>

            <div class="field-grid-2">
              <div class="field-row">
                <label class="field-lbl">Started</label>
                <input v-model="form.started_at" type="date" class="field-ctrl" />
              </div>
              <div class="field-row">
                <label class="field-lbl">Ended</label>
                <input v-model="form.ended_at" type="date" class="field-ctrl" />
              </div>
            </div>

            <div class="field-row">
              <label class="field-lbl">Notes</label>
              <textarea v-model="form.notes" rows="2" class="field-ctrl field-textarea" placeholder="Optional notes..." />
            </div>
          </div>

          <div class="modal-foot">
            <button class="mf-cancel" @click="showModal = false">Cancel</button>
            <button class="mf-save" @click="save">
              {{ editingEntry ? 'Save Changes' : 'Log Entry' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Page shell ─────────────────────────────────────────────── */
.hv {
  padding: 28px 28px 100px;
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: hv-enter 0.35s ease both;
}

@keyframes hv-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Top bar ─────────────────────────────────────────────────── */
.hv-topbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.hv-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--accent);
  margin-bottom: 4px;
}

.hv-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.03em;
}

.hv-log-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  color: #0a0b0f;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  flex-shrink: 0;
}

.hv-log-btn:hover { opacity: 0.88; transform: translateY(-1px); }
.hv-log-btn:active { transform: translateY(0); }

.log-btn-plus {
  font-size: 16px;
  line-height: 1;
  margin-top: -1px;
}

/* ── Scoreboard ──────────────────────────────────────────────── */
.scoreboard {
  position: relative;
  display: flex;
  align-items: stretch;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

/* Win progress bar along the bottom */
.sb-win-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255,255,255,0.04);
}

.sb-win-fill {
  height: 100%;
  background: var(--green);
  transition: width 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  opacity: 0.7;
}

.sb-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 16px 20px;
  min-width: 0;
}

.sb-cell--wide { flex: 1.6; }

.sb-sep {
  width: 1px;
  background: var(--border);
  margin: 14px 0;
  flex-shrink: 0;
}

.sb-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.sb-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.04em;
  line-height: 1;
}

.sb-unit {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.6;
}

.sb-green  { color: var(--green); }
.sb-red    { color: var(--red); }
.sb-accent { color: var(--accent); }

.sb-label--green { color: var(--green); opacity: 0.9; }
.sb-label--red   { color: var(--red);   opacity: 0.9; }

.sb-cell--phases {
  justify-content: flex-start;
  gap: 6px;
  padding-top: 14px;
  padding-bottom: 14px;
}

.sb-phase-rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sb-phase-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.sb-phase-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  width: 26px;
  flex-shrink: 0;
}

.sb-phase-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  line-height: 1;
}

.sb-phase-unit {
  font-size: 10px;
  font-weight: 500;
  opacity: 0.55;
}

.sb-phase-empty .sb-phase-val {
  font-size: 16px;
  color: var(--text-muted);
}

/* ── Alert banner ────────────────────────────────────────────── */
.alert-banner {
  background: var(--surface);
  border: 1px solid rgba(240, 180, 41, 0.2);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  overflow: hidden;
}

.alert-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  background: rgba(240, 180, 41, 0.05);
  border-bottom: 1px solid rgba(240, 180, 41, 0.1);
}

.alert-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse-alert 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulse-alert {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.alert-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--accent);
}

.alert-count {
  margin-left: auto;
  width: 18px;
  height: 18px;
  background: var(--accent);
  color: #0a0b0f;
  border-radius: 50%;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.alert-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 13px;
}

.alert-row:last-child { border-bottom: none; }

.alert-outcome {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--green);
  background: rgba(0, 230, 118, 0.1);
  border: 1px solid rgba(0, 230, 118, 0.2);
  border-radius: 3px;
  padding: 2px 6px;
  flex-shrink: 0;
}

.alert-alias {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

.alert-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
  flex: 1;
}

.alert-confirm-btn {
  padding: 5px 12px;
  background: var(--accent);
  border: none;
  border-radius: 4px;
  color: #0a0b0f;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.alert-confirm-btn:hover { opacity: 0.85; }

/* ── Ledger table ────────────────────────────────────────────── */
.ledger-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow-x: auto;
}

.ledger-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 72px 24px;
  color: var(--text-muted);
}

.ledger-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.ledger-empty-icon {
  font-size: 36px;
  opacity: 0.12;
  font-family: 'JetBrains Mono', monospace;
}

.ledger-empty-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--text-secondary);
}

.ledger-empty-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
}

.ledger {
  width: 100%;
  border-collapse: collapse;
}

/* Head */
.ledger-head {
  border-bottom: 1px solid var(--border);
}

.ledger-head th {
  padding: 10px 14px;
  text-align: left;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-muted);
  white-space: nowrap;
  background: rgba(255,255,255,0.015);
}

.lh-r { text-align: right; }
.lh-status { width: 80px; }
.lh-days { width: 52px; }
.lh-notes { max-width: 160px; }
.lh-act { width: auto; min-width: 64px; }

/* Rows */
.ledger-row {
  border-bottom: 1px solid rgba(255,255,255,0.04);
  border-left: 3px solid transparent;
  animation: row-enter 0.35s ease both;
  transition: background 0.12s, border-left-color 0.15s;
}

@keyframes row-enter {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}

.ledger-row:last-child { border-bottom: none; }

.row-passed  { border-left-color: rgba(0, 230, 118, 0.5); }
.row-failed  { border-left-color: rgba(255, 71, 87, 0.5); }
.row-abandoned { border-left-color: rgba(255, 159, 67, 0.5); }
.row-active  { border-left-color: rgba(240, 180, 41, 0.6); background: rgba(240, 180, 41, 0.025); }

.row-passed:hover  { background: rgba(0, 230, 118, 0.04); border-left-color: var(--green); }
.row-failed:hover  { background: rgba(255, 71, 87, 0.04); border-left-color: var(--red); }
.row-abandoned:hover { background: rgba(255, 159, 67, 0.04); border-left-color: rgba(255,159,67,0.9); }
.row-active:hover  { background: rgba(240, 180, 41, 0.05); border-left-color: var(--accent); }

/* Cells */
.ledger-row td {
  padding: 11px 14px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  vertical-align: middle;
}

.lc-status {
  padding: 8px 14px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 7px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.pill-passed {
  background: rgba(0, 230, 118, 0.1);
  border: 1px solid rgba(0, 230, 118, 0.25);
  color: var(--green);
}

.pill-failed {
  background: rgba(255, 71, 87, 0.1);
  border: 1px solid rgba(255, 71, 87, 0.22);
  color: var(--red);
}

.pill-abandoned {
  background: rgba(255, 159, 67, 0.08);
  border: 1px solid rgba(255, 159, 67, 0.2);
  color: #ff9f43;
}

.pill-active {
  background: rgba(240, 180, 41, 0.12);
  border: 1px solid rgba(240, 180, 41, 0.3);
  color: var(--accent);
  gap: 5px;
}

.pill-active-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse-active 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulse-active {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.lc-alias {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

.lc-firm, .lc-phase {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
}

.lc-r { text-align: right; }

.lc-money {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-secondary);
}

.lc-pnl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
}

.lc-pnl.pos { color: var(--green); }
.lc-pnl.neg { color: var(--red); }

.lc-payout {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.lc-extracted {
  color: var(--accent);
  font-weight: 700;
}

.lc-period {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}

.period-start, .period-end { color: var(--text-muted); }
.period-arrow { color: var(--border); font-size: 9px; }
.period-ongoing { color: var(--accent); opacity: 0.7; font-style: italic; }

.lc-days {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
}

.lc-notes {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

/* Row actions */
.lc-act {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
}

.lc-act--active {
  gap: 3px;
}

/* Quick status action buttons for Active rows */
.qsa-btn {
  padding: 3px 6px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.qsa-pass {
  background: rgba(0, 230, 118, 0.08);
  border: 1px solid rgba(0, 230, 118, 0.2);
  color: var(--green);
}

.qsa-fail {
  background: rgba(255, 71, 87, 0.08);
  border: 1px solid rgba(255, 71, 87, 0.2);
  color: var(--red);
}

.qsa-abnd {
  background: rgba(255, 159, 67, 0.06);
  border: 1px solid rgba(255, 159, 67, 0.18);
  color: #ff9f43;
}

.qsa-pass:hover { background: rgba(0, 230, 118, 0.18); border-color: rgba(0, 230, 118, 0.4); }
.qsa-fail:hover { background: rgba(255, 71, 87, 0.18); border-color: rgba(255, 71, 87, 0.38); }
.qsa-abnd:hover { background: rgba(255, 159, 67, 0.16); border-color: rgba(255, 159, 67, 0.38); }

.act-edit, .act-del {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  color: transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.ledger-row:hover .act-edit,
.ledger-row:hover .act-del {
  border-color: var(--border);
  color: var(--text-muted);
}

.act-edit:hover { border-color: rgba(99,179,237,0.3) !important; color: #63b3ed !important; background: rgba(99,179,237,0.07); }
.act-del:hover  { border-color: rgba(255,71,87,0.3) !important; color: var(--red) !important; background: rgba(255,71,87,0.07); }

/* ── Modal ───────────────────────────────────────────────────── */
.modal-veil {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  animation: modal-enter 0.2s ease both;
  box-shadow: 0 32px 80px rgba(0,0,0,0.6);
}

@keyframes modal-enter {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--border);
}

.modal-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--accent);
  margin-bottom: 3px;
}

.modal-top-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-x {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.modal-x:hover { border-color: var(--red); color: var(--red); }

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

.field-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.field-ctrl {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 9px 11px;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s;
}

.field-ctrl:focus { border-color: var(--accent); }

.field-textarea { resize: vertical; min-height: 60px; }

/* Outcome toggle */
.outcome-toggle {
  display: flex;
  gap: 4px;
}

.ot-btn {
  flex: 1;
  padding: 8px 6px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.ot-btn.ot-active.ot-active   { background: rgba(240,180,41,0.12); border-color: rgba(240,180,41,0.35); color: var(--accent); }
.ot-btn.ot-active.ot-passed  { background: rgba(0,230,118,0.1); border-color: rgba(0,230,118,0.35); color: var(--green); }
.ot-btn.ot-active.ot-failed  { background: rgba(255,71,87,0.1); border-color: rgba(255,71,87,0.3); color: var(--red); }
.ot-btn.ot-active.ot-abandoned { background: rgba(255,159,67,0.1); border-color: rgba(255,159,67,0.3); color: #ff9f43; }

.modal-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}

.mf-cancel {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.mf-cancel:hover { border-color: var(--text-muted); }

.mf-save {
  padding: 8px 20px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  color: #0a0b0f;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: opacity 0.15s;
}

.mf-save:hover { opacity: 0.88; }

/* ── Responsive ──────────────────────────────────────────────── */
@media (max-width: 768px) {
  .hv { padding: 16px 14px 80px; }
  .scoreboard { flex-wrap: wrap; }
  .sb-cell { flex: 1 1 40%; }
  .sb-sep { display: none; }
  .field-grid-2, .field-grid-3 { grid-template-columns: 1fr; }
}
</style>
