<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMetaCopier } from '@/composables/useMetaCopier'
import { useChallenges } from '@/composables/useChallenges'
import { useToast } from '@/composables/useToast'
import { useMasterToggle } from '@/composables/useMasterToggle'
import type { ChallengeRow } from '@/types'
import StatsBar from '@/components/StatsBar.vue'
import FilterBar from '@/components/FilterBar.vue'
import ChallengeTable from '@/components/ChallengeTable.vue'
import AddChallengeModal from '@/components/AddChallengeModal.vue'
import EditChallengeModal from '@/components/EditChallengeModal.vue'

const { startAutoRefresh, stopAutoRefresh, loading: mcLoading, error: mcError } = useMetaCopier()
const {
  challengeRows,
  unlinkedAccounts,
  fetchChallenges,
  deleteChallenge,
  captureSnapshots,
  loading: chLoading,
} = useChallenges()
const toast = useToast()

const search = ref('')
const ownerFilter = ref('')
const statusFilter = ref('')
const { includeMaster: showMaster } = useMasterToggle()
const showModal = ref(false)
const showEditModal = ref(false)
const editingRow = ref<ChallengeRow | null>(null)

let snapshotInterval: ReturnType<typeof setInterval> | null = null

const filteredRows = computed(() => {
  return challengeRows.value.filter(row => {
    if (!showMaster.value && row.is_master) return false
    if (search.value) {
      const q = search.value.toLowerCase()
      const matchesSearch =
        row.alias.toLowerCase().includes(q) ||
        row.login_number.toLowerCase().includes(q) ||
        row.prop_firm.toLowerCase().includes(q) ||
        row.owner.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
    if (ownerFilter.value && row.owner !== ownerFilter.value) return false
    if (statusFilter.value && row.state !== statusFilter.value) return false
    return true
  })
})

async function handleDelete(id: string) {
  if (confirm('Remove this challenge?')) {
    try {
      await deleteChallenge(id)
      toast.success('Challenge removed')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to remove challenge')
    }
  }
}

function handleEdit(row: ChallengeRow) {
  editingRow.value = row
  showEditModal.value = true
}

onMounted(async () => {
  startAutoRefresh(30_000)
  await fetchChallenges()
  snapshotInterval = setInterval(captureSnapshots, 5 * 60_000)
})

onUnmounted(() => {
  stopAutoRefresh()
  if (snapshotInterval) clearInterval(snapshotInterval)
})
</script>

<template>
  <div class="challenges-view">
    <header class="page-header">
      <!-- Background grid texture -->
      <div class="header-grid" aria-hidden="true" />

      <div class="header-inner">
        <div class="header-left">
          <div class="header-tag">
            <span class="tag-mark">▸</span>
            METACOPIER
          </div>
          <h1 class="page-title">
            Challenge<br />
            <span class="title-accent">Dashboard</span>
          </h1>
        </div>

        <div class="header-right">
          <!-- Connection status -->
          <div class="hdr-stat-block">
            <div class="hdr-stat-row">
              <template v-if="mcLoading || chLoading">
                <div class="sync-spinner" />
                <span class="hdr-status-text syncing">Syncing data...</span>
              </template>
              <template v-else>
                <span class="hdr-live-dot" />
                <span class="hdr-status-text live">Feed active</span>
              </template>
            </div>
            <div class="hdr-stat-label">AUTO REFRESH 60s</div>
          </div>

          <div class="hdr-divider" />

          <!-- Account count pill -->
          <div class="hdr-stat-block hdr-accent">
            <div class="hdr-stat-row">
              <span class="hdr-big-num">{{ challengeRows.filter(r => !r.is_master).length }}</span>
            </div>
            <div class="hdr-stat-label">CHALLENGES</div>
          </div>
        </div>
      </div>

      <!-- Error state -->
      <div v-if="mcError" class="api-error">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        MetaCopier: {{ mcError }}
      </div>
    </header>

    <div class="page-body">
      <StatsBar :rows="challengeRows" />

      <FilterBar
        v-model:search="search"
        v-model:owner="ownerFilter"
        v-model:status="statusFilter"
        v-model:showMaster="showMaster"
        :rows="challengeRows"
        @add-challenge="showModal = true"
      />

      <ChallengeTable :rows="filteredRows" @delete="handleDelete" @edit="handleEdit" />
    </div>

    <AddChallengeModal
      :show="showModal"
      :unlinked-accounts="unlinkedAccounts"
      @close="showModal = false"
      @added="showModal = false; fetchChallenges(); toast.success('Challenge added')"
    />

    <EditChallengeModal
      :show="showEditModal"
      :row="editingRow"
      @close="showEditModal = false; editingRow = null"
      @saved="showEditModal = false; editingRow = null; fetchChallenges(); toast.success('Challenge updated')"
    />
  </div>
</template>

<style scoped>
.challenges-view {
  padding: 0;
  max-width: 1440px;
  margin: 0 auto;
  animation: fadeInUp 0.4s var(--ease-out);
}

/* ── Page header / banner ────────────────────────────── */
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

/* Dot-grid background texture */
.header-grid {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}

/* Fade the grid at the edges */
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

/* ── Left: tag + title ───────────────────────────────── */
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

.tag-mark {
  font-size: 11px;
  line-height: 1;
  opacity: 0.8;
}

.page-title {
  font-family: var(--font-ui);
  font-size: 42px;
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.04em;
  color: var(--text-primary);
  margin: 0;
}

.title-accent {
  color: var(--accent);
}

/* ── Right: status + count ───────────────────────────── */
.header-right {
  display: flex;
  align-items: flex-end;
  gap: 0;
  flex-shrink: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
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

.hdr-status-text {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.hdr-status-text.live    { color: var(--green); }
.hdr-status-text.syncing { color: var(--accent); }

.hdr-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: pulse-live 2.5s ease-in-out infinite;
  flex-shrink: 0;
}

.hdr-big-num {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--accent);
}

.hdr-divider {
  width: 1px;
  background: var(--border-subtle);
  align-self: stretch;
}

.sync-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── API error ───────────────────────────────────────── */
.api-error {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding: 5px 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--red-muted);
  border: 1px solid rgba(255, 71, 87, 0.15);
  border-radius: var(--radius-sm);
  color: var(--red);
}

/* ── Main content area ───────────────────────────────── */
.page-body {
  padding: 0 28px 28px;
}

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
    gap: 16px;
  }

  .header-right {
    width: 100%;
  }

  .hdr-stat-block {
    flex: 1;
  }

  .page-body {
    padding: 0 16px 16px;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 28px;
  }
}
</style>
