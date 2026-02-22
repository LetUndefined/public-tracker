<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdmin } from '@/composables/useAdmin'

const { fetchAdminData } = useAdmin()
const router = useRouter()

interface Challenge {
  id: string
  alias: string
  starting_balance: number
  target_pct: number
  is_master: boolean
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

const users = ref<UserRow[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')

const stats = computed(() => ({
  total: users.value.length,
  confirmed: users.value.filter(u => u.confirmed).length,
  withKey: users.value.filter(u => u.has_api_key).length,
  totalChallenges: users.value.reduce((s, u) => s + u.challenges.length, 0),
}))

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return users.value
  return users.value.filter(u => u.email?.toLowerCase().includes(q))
})

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function toggle(user: UserRow) {
  user.expanded = !user.expanded
}

onMounted(async () => {
  try {
    const data = await fetchAdminData()
    users.value = (data.users ?? []).map((u: any) => ({ ...u, expanded: false }))
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
        <span class="state-label">Loading user data&hellip;</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="alert-error-box">{{ error }}</div>

      <template v-else>
        <!-- Stats strip -->
        <div class="stats-strip">
          <div class="stat-cell">
            <div class="stat-val">{{ stats.total }}</div>
            <div class="stat-key">TOTAL USERS</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val">{{ stats.confirmed }}</div>
            <div class="stat-key">CONFIRMED</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val">{{ stats.withKey }}</div>
            <div class="stat-key">WITH API KEY</div>
          </div>
          <div class="stat-cell">
            <div class="stat-val">{{ stats.totalChallenges }}</div>
            <div class="stat-key">CHALLENGES</div>
          </div>
        </div>

        <!-- Search -->
        <div class="search-bar">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="search-icon">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <input v-model="search" class="search-input" placeholder="Filter by email…" />
        </div>

        <!-- User table -->
        <div class="user-table">
          <div class="table-head">
            <span>EMAIL</span>
            <span>JOINED</span>
            <span>LAST SIGN IN</span>
            <span>STATUS</span>
            <span>API KEY</span>
            <span>CHALLENGES</span>
          </div>

          <div v-if="filtered.length === 0" class="empty-row">No users found.</div>

          <template v-for="user in filtered" :key="user.id">
            <div
              class="table-row"
              :class="{ expanded: user.expanded }"
              @click="toggle(user)"
            >
              <span class="col-email">{{ user.email ?? '—' }}</span>
              <span class="col-date">{{ fmt(user.created_at) }}</span>
              <span class="col-date">{{ fmtTime(user.last_sign_in) }}</span>
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
                <svg
                  class="chevron"
                  :class="{ open: user.expanded }"
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                >
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </span>
            </div>

            <!-- Expanded: challenges -->
            <Transition name="expand">
              <div v-if="user.expanded && user.challenges.length > 0" class="challenge-rows">
                <div
                  v-for="ch in user.challenges"
                  :key="ch.id"
                  class="challenge-row"
                >
                  <span class="ch-alias">
                    {{ ch.alias || '(unnamed)' }}
                    <span v-if="ch.is_master" class="master-tag">MASTER</span>
                  </span>
                  <span class="ch-balance">${{ ch.starting_balance.toLocaleString() }}</span>
                  <span class="ch-target">{{ ch.target_pct }}% target</span>
                  <span class="ch-date">{{ fmt(ch.created_at) }}</span>
                </div>
              </div>
              <div v-else-if="user.expanded" class="challenge-rows">
                <div class="challenge-row ch-empty">No challenges added yet.</div>
              </div>
            </Transition>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 960px;
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

/* Stats */
.stats-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md, 10px);
  overflow: hidden;
}

.stat-cell {
  background: var(--surface);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-key {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

/* Search */
.search-bar {
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

/* Table */
.user-table {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md, 10px);
  overflow: hidden;
}

.table-head {
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 90px 80px 90px;
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
  grid-template-columns: 2fr 1fr 1.2fr 90px 80px 90px;
  padding: 13px 20px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s;
  align-items: center;
}

.table-row:last-child { border-bottom: none; }
.table-row:hover { background: var(--bg); }
.table-row.expanded { background: var(--bg); }

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
}

.col-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
}

.col-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.chevron { color: var(--text-muted); transition: transform 0.2s; }
.chevron.open { transform: rotate(180deg); }

.pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
}

.pill-ok      { background: rgba(34,197,94,0.12); color: var(--green, #22c55e); }
.pill-warn    { background: rgba(240,180,41,0.12); color: var(--accent); }
.pill-neutral { background: var(--bg); color: var(--text-muted); border: 1px solid var(--border-subtle); }

/* Challenge rows */
.challenge-rows {
  border-top: 1px solid var(--border-subtle);
  background: var(--bg);
}

.challenge-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  padding: 10px 20px 10px 36px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-muted);
  align-items: center;
}

.challenge-row:last-child { border-bottom: none; }

.ch-alias {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.master-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: 1px 5px;
  border-radius: 3px;
  opacity: 0.7;
}

.ch-balance, .ch-target, .ch-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.ch-empty { color: var(--text-muted); font-style: italic; padding-left: 36px; }

/* Expand animation */
.expand-enter-active, .expand-leave-active { transition: opacity 0.15s; }
.expand-enter-from, .expand-leave-to { opacity: 0; }

/* States */
.state-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 60px 0;
  color: var(--text-muted);
}

.state-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

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

@media (max-width: 640px) {
  .stats-strip { grid-template-columns: repeat(2, 1fr); }
  .table-head { display: none; }
  .table-row { grid-template-columns: 1fr auto; gap: 6px; }
  .table-row > :nth-child(n+2):not(:last-child) { display: none; }
  .challenge-row { grid-template-columns: 1fr 1fr; }
  .ch-date { display: none; }
}
</style>
