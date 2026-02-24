<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdmin } from '@/composables/useAdmin'
import { supabase } from '@/lib/supabase'

const { fetchAdminData } = useAdmin()
const router = useRouter()

interface Challenge {
  id: string
  alias: string
  prop_firm: string
  phase: string
  starting_balance: number
  target_pct: number
  created_at: string
}

interface UserRow {
  id: string
  email: string
  created_at: string
  last_sign_in: string | null
  confirmed: boolean
  has_api_key: boolean
  challenges: Challenge[]
  expanded: boolean
}

interface SystemStats {
  histPassed: number
  histFailed: number
  histExtracted: number
}

interface VisitorStats {
  todayViews: number
  todaySessions: number
  weekViews: number
  weekSessions: number
  totalViews: number
  topPages: { page: string; views: number }[]
}

interface FeedbackRow {
  id: string
  user_id: string | null
  email: string | null
  message: string
  category: 'bug' | 'feature' | 'general'
  read: boolean
  created_at: string
}

const users    = ref<UserRow[]>([])
const system   = ref<SystemStats>({ histPassed: 0, histFailed: 0, histExtracted: 0 })
const feedback = ref<FeedbackRow[]>([])
const visitors = ref<VisitorStats>({ todayViews: 0, todaySessions: 0, weekViews: 0, weekSessions: 0, totalViews: 0, topPages: [] })
const loading  = ref(true)
const error    = ref('')
const search   = ref('')
const sortKey  = ref<'newest' | 'last_active' | 'most_challenges'>('newest')

// ── computed stats ────────────────────────────────────────────────
const now = Date.now()

const stats = computed(() => {
  const total        = users.value.length
  const confirmed    = users.value.filter(u => u.confirmed).length
  const unconfirmed  = total - confirmed
  const withKey      = users.value.filter(u => u.has_api_key).length
  const totalCh      = users.value.reduce((s, u) => s + u.challenges.length, 0)
  const active7d     = users.value.filter(u => u.last_sign_in && (now - new Date(u.last_sign_in).getTime()) < 7 * 864e5).length
  const newWeek      = users.value.filter(u => (now - new Date(u.created_at).getTime()) < 7 * 864e5).length
  const noActivity   = users.value.filter(u => !u.last_sign_in).length
  const unreadFb     = feedback.value.filter(f => !f.read).length
  return { total, confirmed, unconfirmed, withKey, totalCh, active7d, newWeek, noActivity, unreadFb }
})

// ── filtering + sorting ───────────────────────────────────────────
const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return q ? users.value.filter(u => u.email?.toLowerCase().includes(q)) : users.value
})

const sorted = computed(() => {
  const list = [...filtered.value]
  if (sortKey.value === 'newest')
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (sortKey.value === 'last_active')
    return list.sort((a, b) => new Date(b.last_sign_in ?? 0).getTime() - new Date(a.last_sign_in ?? 0).getTime())
  if (sortKey.value === 'most_challenges')
    return list.sort((a, b) => b.challenges.length - a.challenges.length)
  return list
})

// ── helpers ───────────────────────────────────────────────────────
function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function relTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = now - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  const w = Math.floor(d / 7)
  if (m < 60)  return `${m}m ago`
  if (h < 24)  return `${h}h ago`
  if (d < 7)   return `${d}d ago`
  if (w < 5)   return `${w}w ago`
  return fmt(iso)
}

function activityStatus(iso: string | null): 'active' | 'idle' | 'inactive' | 'never' {
  if (!iso) return 'never'
  const d = (now - new Date(iso).getTime()) / 86400000
  if (d < 3)  return 'active'
  if (d < 14) return 'idle'
  return 'inactive'
}

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function toggle(user: UserRow) { user.expanded = !user.expanded }

async function markRead(id: string) {
  const row = feedback.value.find(f => f.id === id)
  if (!row || row.read) return
  row.read = true // optimistic
  const { fetchAdminData: _ } = useAdmin()
  await supabase.functions.invoke('admin-data', { body: { action: 'markRead', id } })
}

function categoryLabel(c: string) {
  if (c === 'bug') return '🐛 Bug'
  if (c === 'feature') return '💡 Feature'
  return '💬 General'
}

async function copyEmail(e: Event, email: string) {
  e.stopPropagation()
  await navigator.clipboard.writeText(email)
}

async function fetchVisitorStats() {
  const today   = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(Date.now() - 7 * 86400000)

  const [{ data: recent }, { count: total }] = await Promise.all([
    supabase.from('page_views').select('page, session_id, created_at').gte('created_at', weekAgo.toISOString()),
    supabase.from('page_views').select('*', { count: 'exact', head: true }),
  ])

  const rows        = recent ?? []
  const todayRows   = rows.filter(r => new Date(r.created_at) >= today)
  const pageCounts  = rows.reduce((acc: Record<string, number>, r) => {
    acc[r.page] = (acc[r.page] ?? 0) + 1; return acc
  }, {})
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([page, views]) => ({ page, views }))

  visitors.value = {
    todayViews:    todayRows.length,
    todaySessions: new Set(todayRows.map(r => r.session_id)).size,
    weekViews:     rows.length,
    weekSessions:  new Set(rows.map(r => r.session_id)).size,
    totalViews:    total ?? 0,
    topPages,
  }
}

onMounted(async () => {
  try {
    const data = await fetchAdminData()
    users.value    = (data.users    ?? []).map((u: any) => ({ ...u, expanded: false }))
    system.value   = data.system   ?? { histPassed: 0, histFailed: 0, histExtracted: 0 }
    feedback.value = data.feedback ?? []
    await fetchVisitorStats()
  } catch (e: any) {
    error.value = e.message
    if (e.message === 'Not authorized') router.replace('/')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="admin-page">
    <div class="admin-inner">

      <!-- Header -->
      <div class="page-header">
        <div class="header-top">
          <div class="header-left">
            <span class="page-tag">▸ ADMIN</span>
            <h1 class="page-title">User Dashboard</h1>
          </div>
          <div class="header-badge">RESTRICTED</div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="state-center">
        <div class="spinner-lg" />
        <span class="state-label">Loading data…</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="alert-error-box">{{ error }}</div>

      <template v-else>

        <!-- ── Stats strip ── -->
        <div class="stats-strip">
          <div class="stat-cell">
            <div class="stat-val">{{ stats.total }}</div>
            <div class="stat-key">TOTAL USERS</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val stat-green">{{ stats.active7d }}</div>
            <div class="stat-key">ACTIVE 7D</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val stat-accent">{{ stats.newWeek }}</div>
            <div class="stat-key">NEW THIS WEEK</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val" :class="stats.unconfirmed > 0 ? 'stat-warn' : ''">{{ stats.unconfirmed }}</div>
            <div class="stat-key">UNCONFIRMED</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val">{{ stats.withKey }}</div>
            <div class="stat-key">WITH API KEY</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val">{{ stats.totalCh }}</div>
            <div class="stat-key">CHALLENGES</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val stat-green">{{ system.histPassed }}</div>
            <div class="stat-key">PASSED (ALL)</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val stat-accent">{{ fmtMoney(system.histExtracted) }}</div>
            <div class="stat-key">EXTRACTED</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val" :class="stats.unreadFb > 0 ? 'stat-accent' : ''">{{ stats.unreadFb }}</div>
            <div class="stat-key">UNREAD FEEDBACK</div>
          </div>
        </div>

        <!-- ── Controls ── -->
        <div class="controls-bar">
          <div class="search-bar">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" class="search-icon">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/>
              <path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <input v-model="search" class="search-input" placeholder="Filter by email…" />
            <span v-if="search" class="search-count">{{ filtered.length }}</span>
          </div>
          <div class="sort-group">
            <span class="sort-label">SORT</span>
            <button
              v-for="s in [
                { key: 'newest',          label: 'Newest' },
                { key: 'last_active',     label: 'Last Active' },
                { key: 'most_challenges', label: 'Challenges' },
              ]"
              :key="s.key"
              class="sort-btn"
              :class="{ active: sortKey === s.key }"
              @click="sortKey = s.key as any"
            >{{ s.label }}</button>
          </div>
        </div>

        <!-- ── User table ── -->
        <div class="user-table">
          <div class="table-head">
            <span>EMAIL</span>
            <span>JOINED</span>
            <span>LAST ACTIVE</span>
            <span>ACTIVITY</span>
            <span>STATUS</span>
            <span>API KEY</span>
            <span>CHALLENGES</span>
          </div>

          <div v-if="sorted.length === 0" class="empty-row">No users found.</div>

          <template v-for="user in sorted" :key="user.id">
            <div
              class="table-row"
              :class="{ expanded: user.expanded }"
              @click="toggle(user)"
            >
              <span class="col-email">
                {{ user.email ?? '—' }}
                <button class="copy-btn" @click="copyEmail($event, user.email)" title="Copy email">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </span>
              <span class="col-date">{{ fmt(user.created_at) }}</span>
              <span class="col-rel" :class="'rel-' + activityStatus(user.last_sign_in)">
                {{ relTime(user.last_sign_in) }}
              </span>
              <span>
                <span :class="['pill', 'pill-activity-' + activityStatus(user.last_sign_in)]">
                  {{ activityStatus(user.last_sign_in) }}
                </span>
              </span>
              <span>
                <span :class="['pill', user.confirmed ? 'pill-ok' : 'pill-warn']">
                  {{ user.confirmed ? 'Confirmed' : 'Pending' }}
                </span>
              </span>
              <span>
                <span :class="['pill', user.has_api_key ? 'pill-ok' : 'pill-neutral']">
                  {{ user.has_api_key ? 'Set' : 'None' }}
                </span>
              </span>
              <span class="col-count">
                {{ user.challenges.length }}
                <svg class="chevron" :class="{ open: user.expanded }" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </span>
            </div>

            <!-- Expanded: challenges -->
            <Transition name="expand">
              <div v-if="user.expanded" class="challenge-rows">
                <div v-if="user.challenges.length === 0" class="challenge-row ch-empty">
                  No challenges added yet.
                </div>
                <template v-else>
                  <div class="challenge-head">
                    <span>ALIAS</span>
                    <span>FIRM</span>
                    <span>PHASE</span>
                    <span class="ch-r">BALANCE</span>
                    <span class="ch-r">TARGET</span>
                    <span class="ch-r">ADDED</span>
                  </div>
                  <div v-for="ch in user.challenges" :key="ch.id" class="challenge-row">
                    <span class="ch-alias">{{ ch.alias || '(unnamed)' }}</span>
                    <span class="ch-firm">{{ ch.prop_firm || '—' }}</span>
                    <span class="ch-phase">{{ ch.phase || '—' }}</span>
                    <span class="ch-r ch-balance">${{ ch.starting_balance.toLocaleString() }}</span>
                    <span class="ch-r ch-target">{{ ch.target_pct > 0 ? ch.target_pct + '%' : '—' }}</span>
                    <span class="ch-r ch-date">{{ fmt(ch.created_at) }}</span>
                  </div>
                </template>
              </div>
            </Transition>
          </template>
        </div>

        <!-- ── Feedback inbox ── -->
        <div class="inbox-section" v-if="feedback.length > 0">
          <div class="section-label">
            FEEDBACK INBOX
            <span v-if="stats.unreadFb > 0" class="inbox-badge">{{ stats.unreadFb }} unread</span>
          </div>
          <div class="inbox-list">
            <div
              v-for="fb in feedback"
              :key="fb.id"
              class="inbox-card"
              :class="{ 'inbox-read': fb.read }"
              @click="markRead(fb.id)"
            >
              <div class="inbox-card-top">
                <span class="inbox-cat" :class="'cat-' + fb.category">{{ categoryLabel(fb.category) }}</span>
                <span class="inbox-email">{{ fb.email ?? 'anonymous' }}</span>
                <span class="inbox-time">{{ relTime(fb.created_at) }}</span>
                <span v-if="!fb.read" class="inbox-dot" />
              </div>
              <div class="inbox-msg">{{ fb.message }}</div>
            </div>
          </div>
        </div>

        <!-- ── Visitor traffic ── -->
        <div class="system-section">
          <div class="section-label">VISITOR TRAFFIC</div>
          <div class="sys-cards">
            <div class="sys-card">
              <div class="sys-val sys-accent">{{ visitors.todayViews }}</div>
              <div class="sys-key">VIEWS TODAY</div>
            </div>
            <div class="sys-card">
              <div class="sys-val sys-accent">{{ visitors.todaySessions }}</div>
              <div class="sys-key">VISITORS TODAY</div>
            </div>
            <div class="sys-card">
              <div class="sys-val">{{ visitors.weekViews }}</div>
              <div class="sys-key">VIEWS 7D</div>
            </div>
            <div class="sys-card">
              <div class="sys-val">{{ visitors.weekSessions }}</div>
              <div class="sys-key">VISITORS 7D</div>
            </div>
            <div class="sys-card">
              <div class="sys-val">{{ visitors.totalViews.toLocaleString() }}</div>
              <div class="sys-key">TOTAL VIEWS</div>
            </div>
          </div>
          <div class="top-pages" v-if="visitors.topPages.length">
            <div class="tp-label">TOP PAGES · LAST 7 DAYS</div>
            <div class="tp-rows">
              <div v-for="p in visitors.topPages" :key="p.page" class="tp-row">
                <span class="tp-page">{{ p.page || '/' }}</span>
                <div class="tp-bar-wrap">
                  <div class="tp-bar" :style="{ width: `${Math.round(p.views / visitors.topPages[0].views * 100)}%` }" />
                </div>
                <span class="tp-count">{{ p.views }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── System history summary ── -->
        <div class="system-section" v-if="system.histPassed + system.histFailed > 0">
          <div class="section-label">SYSTEM · CHALLENGE HISTORY</div>
          <div class="sys-cards">
            <div class="sys-card">
              <div class="sys-val sys-green">{{ system.histPassed }}</div>
              <div class="sys-key">PASSED</div>
            </div>
            <div class="sys-card">
              <div class="sys-val sys-red">{{ system.histFailed }}</div>
              <div class="sys-key">FAILED</div>
            </div>
            <div class="sys-card">
              <div class="sys-val">
                {{ system.histPassed + system.histFailed > 0
                  ? Math.round(system.histPassed / (system.histPassed + system.histFailed) * 100)
                  : 0 }}%
              </div>
              <div class="sys-key">WIN RATE</div>
            </div>
            <div class="sys-card sys-card--wide">
              <div class="sys-val sys-accent">{{ fmtMoney(system.histExtracted) }}</div>
              <div class="sys-key">TOTAL EXTRACTED</div>
            </div>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 16px 80px;
}

.admin-inner { display: flex; flex-direction: column; gap: 20px; }

.page-header { display: flex; flex-direction: column; gap: 4px; }
.header-top { display: flex; align-items: flex-start; justify-content: space-between; }
.header-left { display: flex; flex-direction: column; gap: 4px; }

.page-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: var(--accent);
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.35);
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.08);
}

/* ── Stats strip ── */
.stats-strip {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 1px;
  background: var(--border-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
}

.stat-cell {
  background: var(--surface);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.stat-key {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.stat-green  { color: var(--green); }
.stat-accent { color: var(--accent); }
.stat-warn   { color: #ef4444; }

/* ── Controls ── */
.controls-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-bar {
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 8px 14px;
}

.search-icon { color: var(--text-muted); flex-shrink: 0; }

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--text-primary);
}

.search-input::placeholder { color: var(--text-muted); opacity: 0.5; }

.search-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 2px 7px;
}

.sort-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin-right: 4px;
}

.sort-btn {
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.sort-btn:hover { border-color: var(--accent); color: var(--accent); }
.sort-btn.active {
  background: rgba(240,180,41,0.1);
  border-color: rgba(240,180,41,0.35);
  color: var(--accent);
}

/* ── Table ── */
.user-table {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
}

.table-head {
  display: grid;
  grid-template-columns: 2.2fr 1fr 1fr 90px 90px 80px 90px;
  padding: 10px 20px;
  background: var(--bg);
  border-bottom: 1px solid var(--border-subtle);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.table-row {
  display: grid;
  grid-template-columns: 2.2fr 1fr 1fr 90px 90px 80px 90px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s;
  align-items: center;
}

.table-row:last-child { border-bottom: none; }
.table-row:hover { background: rgba(255,255,255,0.02); }
.table-row.expanded { background: rgba(255,255,255,0.02); }

.empty-row {
  padding: 24px 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-muted);
}

.col-email {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.copy-btn {
  background: none;
  border: none;
  padding: 2px 4px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  border-radius: 3px;
  flex-shrink: 0;
}

.table-row:hover .copy-btn { opacity: 1; }
.copy-btn:hover { color: var(--accent); }

.col-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
}

.col-rel {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.rel-active   { color: var(--green); }
.rel-idle     { color: var(--text-secondary); }
.rel-inactive { color: var(--text-muted); }
.rel-never    { color: var(--text-muted); opacity: 0.5; }

.col-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.chevron { color: var(--text-muted); transition: transform 0.2s; }
.chevron.open { transform: rotate(180deg); }

.pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.pill-ok      { background: rgba(34,197,94,0.12);  color: var(--green); }
.pill-warn    { background: rgba(240,180,41,0.12);  color: var(--accent); }
.pill-neutral { background: var(--bg); color: var(--text-muted); border: 1px solid var(--border-subtle); }

.pill-activity-active   { background: rgba(34,197,94,0.12);  color: var(--green); }
.pill-activity-idle     { background: rgba(255,255,255,0.05); color: var(--text-secondary); }
.pill-activity-inactive { background: rgba(255,255,255,0.03); color: var(--text-muted); }
.pill-activity-never    { background: rgba(239,68,68,0.08);   color: #ef4444; }

/* ── Challenge rows ── */
.challenge-rows {
  border-top: 1px solid var(--border-subtle);
  background: var(--bg);
}

.challenge-head {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr 80px 1fr;
  padding: 7px 20px 7px 36px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
  opacity: 0.7;
}

.challenge-row {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr 80px 1fr;
  padding: 9px 20px 9px 36px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  font-size: 12px;
  color: var(--text-muted);
  align-items: center;
}

.challenge-row:last-child { border-bottom: none; }

.ch-alias {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.ch-firm {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-secondary);
}

.ch-phase {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
}

.ch-r { text-align: right; }

.ch-balance {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-secondary);
}

.ch-target {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--accent);
}

.ch-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-muted);
}

.ch-empty {
  grid-template-columns: 1fr;
  color: var(--text-muted);
  font-style: italic;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

/* ── System history section ── */
.system-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--text-muted);
}

.sys-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
}

.sys-card {
  background: var(--surface);
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sys-card--wide { flex: 1.5; }

.sys-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.sys-key {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.sys-green  { color: var(--green); }
.sys-red    { color: var(--red); }
.sys-accent { color: var(--accent); }

/* ── Expand animation ── */
.expand-enter-active, .expand-leave-active { transition: opacity 0.15s; }
.expand-enter-from, .expand-leave-to { opacity: 0; }

/* ── States ── */
.state-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 60px 0;
  color: var(--text-muted);
}

.state-label { font-family: 'JetBrains Mono', monospace; font-size: 12px; }

.spinner-lg {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.alert-error-box {
  padding: 16px 20px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: #ef4444;
}

/* ── Feedback inbox ── */
.inbox-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.inbox-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  color: #0a0b0f;
  background: var(--accent);
  border-radius: 4px;
  padding: 2px 7px;
  margin-left: 8px;
  letter-spacing: 0.06em;
}

.inbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inbox-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s, border-left-color 0.15s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inbox-card:hover { background: rgba(255,255,255,0.02); }

.inbox-card.inbox-read {
  border-left-color: var(--border-subtle);
  opacity: 0.55;
}

.inbox-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.inbox-cat {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.cat-bug     { background: rgba(239,68,68,0.1);   color: #ef4444; }
.cat-feature { background: rgba(34,197,94,0.1);   color: var(--green); }
.cat-general { background: rgba(240,180,41,0.1);  color: var(--accent); }

.inbox-email {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.inbox-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.inbox-msg {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Top pages ── */
.top-pages {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
}

.tp-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.tp-rows { display: flex; flex-direction: column; gap: 6px; }

.tp-row {
  display: grid;
  grid-template-columns: 120px 1fr 36px;
  align-items: center;
  gap: 10px;
}

.tp-page {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tp-bar-wrap {
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}

.tp-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.6s cubic-bezier(0.23,1,0.32,1);
  opacity: 0.7;
}

.tp-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-align: right;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .stats-strip { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 640px) {
  .stats-strip { grid-template-columns: repeat(2, 1fr); }
  .table-head { display: none; }
  .table-row { grid-template-columns: 1fr auto; gap: 6px; }
  .table-row > :nth-child(n+2):not(:last-child) { display: none; }
  .challenge-head { display: none; }
  .challenge-row { grid-template-columns: 1fr 1fr; gap: 4px; }
  .ch-date, .ch-target { display: none; }
  .sys-cards { grid-template-columns: repeat(2, 1fr); }
  .sort-group { display: none; }
}
</style>
