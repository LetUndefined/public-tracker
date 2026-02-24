<script setup lang="ts">
import { computed } from 'vue'
import type { ChallengeRow } from '@/types'

const props = defineProps<{
  rows: ChallengeRow[]
  unlinkedCount?: number
}>()

const search = defineModel<string>('search', { default: '' })
const ownerFilter = defineModel<string>('owner', { default: '' })
const statusFilter = defineModel<string>('status', { default: '' })
const showMaster = defineModel<boolean>('showMaster', { default: false })

const emit = defineEmits<{
  addChallenge: []
}>()

const owners = computed(() => {
  const set = new Set(props.rows.map(r => r.owner).filter(Boolean))
  return Array.from(set).sort()
})

const activeFilterCount = computed(() => {
  let n = 0
  if (ownerFilter.value) n++
  if (statusFilter.value) n++
  if (search.value) n++
  return n
})
</script>

<template>
  <div class="cmd-bar">

    <!-- Search -->
    <div class="search-zone">
      <svg class="search-ico" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input
        v-model="search"
        type="text"
        placeholder="Search accounts, firms, owners..."
        class="search-input"
      />
      <button v-if="search" class="clear-btn" @click="search = ''" title="Clear">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <div class="bar-sep" />

    <!-- Owner filter chips -->
    <div class="filter-group" v-if="owners.length > 0">
      <span class="filter-key">OWNER</span>
      <div class="chips">
        <button
          :class="['chip', ownerFilter === '' && 'chip-active']"
          @click="ownerFilter = ''"
        >All</button>
        <button
          v-for="o in owners"
          :key="o"
          :class="['chip', ownerFilter === o && 'chip-active']"
          @click="ownerFilter = ownerFilter === o ? '' : o"
        >{{ o }}</button>
      </div>
    </div>

    <div class="bar-sep" v-if="owners.length > 0" />

    <!-- Status filter chips -->
    <div class="filter-group">
      <span class="filter-key">STATUS</span>
      <div class="chips">
        <button
          :class="['chip', statusFilter === '' && 'chip-active']"
          @click="statusFilter = ''"
        >All</button>
        <button
          :class="['chip chip-green', statusFilter === 'Connected' && 'chip-active']"
          @click="statusFilter = statusFilter === 'Connected' ? '' : 'Connected'"
        >
          <span class="status-pip pip-on" />Online
        </button>
        <button
          :class="['chip chip-dim', statusFilter === 'Disconnected' && 'chip-active']"
          @click="statusFilter = statusFilter === 'Disconnected' ? '' : 'Disconnected'"
        >
          <span class="status-pip" />Offline
        </button>
      </div>
    </div>

    <div class="bar-sep" />

    <!-- Master toggle -->
    <div class="filter-group">
      <span class="filter-key">MASTER</span>
      <div class="chips">
        <button
          :class="['chip', showMaster ? 'chip-active' : '']"
          @click="showMaster = !showMaster"
        >{{ showMaster ? 'Visible' : 'Hidden' }}</button>
      </div>
    </div>

    <!-- Spacer -->
    <div class="bar-grow" />

    <!-- Reset if filters active -->
    <button
      v-if="activeFilterCount > 0"
      class="reset-btn"
      @click="search = ''; ownerFilter = ''; statusFilter = ''"
      title="Clear all filters"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
      <span>{{ activeFilterCount }}</span>
    </button>

    <!-- Add button -->
    <button class="btn-add" data-tour="add-challenge" @click="emit('addChallenge')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Add Challenge
      <span v-if="unlinkedCount && unlinkedCount > 0" class="btn-add-badge">{{ unlinkedCount }}</span>
    </button>

  </div>
</template>

<style scoped>
/* ── Command bar ─────────────────────────────────────── */
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

/* ── Search zone ─────────────────────────────────────── */
.search-zone {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  flex-shrink: 0;
  width: 220px;
}

.search-ico {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: var(--border);
  border: none;
  border-radius: 50%;
  color: var(--text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.12s;
}

.clear-btn:hover {
  background: var(--text-tertiary);
  color: var(--bg);
}

/* ── Separators ──────────────────────────────────────── */
.bar-sep {
  width: 1px;
  height: 100%;
  background: var(--border-subtle);
  flex-shrink: 0;
}

.bar-grow {
  flex: 1;
}

/* ── Filter groups ───────────────────────────────────── */
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

/* ── Chips ───────────────────────────────────────────── */
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

.chip-dim.chip-active {
  background: rgba(255, 255, 255, 0.04) !important;
  border-color: var(--border) !important;
  color: var(--text-secondary) !important;
}

/* ── Status pip ──────────────────────────────────────── */
.status-pip {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-tertiary);
  flex-shrink: 0;
}

.pip-on {
  background: var(--green);
  box-shadow: 0 0 4px var(--green);
  animation: pulse-live 2.5s ease-in-out infinite;
}

/* ── Reset button ────────────────────────────────────── */
.reset-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  height: 100%;
  background: transparent;
  border: none;
  border-left: 1px solid var(--border-subtle);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.12s;
}

.reset-btn:hover {
  background: var(--red-muted);
  color: var(--red);
  border-left-color: rgba(255, 71, 87, 0.15);
}

.reset-btn span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: var(--border);
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
}

/* ── Add button ──────────────────────────────────────── */
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

.btn-add:hover {
  background: var(--accent-bright);
}

.btn-add-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--bg);
  color: var(--accent);
  border-radius: 9px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 900px) {
  .cmd-bar {
    height: auto;
    flex-direction: column;
    align-items: stretch;
  }

  .search-zone {
    width: auto;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .filter-group {
    padding: 8px 14px;
    height: auto;
    border-bottom: 1px solid var(--border-subtle);
    flex-wrap: wrap;
  }

  .bar-sep {
    display: none;
  }

  .bar-grow {
    display: none;
  }

  .reset-btn {
    border: none;
    border-top: 1px solid var(--border-subtle);
    padding: 8px 14px;
    height: auto;
    justify-content: flex-start;
  }

  .btn-add {
    border: none;
    border-top: 1px solid rgba(240, 180, 41, 0.15);
    padding: 11px 14px;
    justify-content: center;
    height: auto;
  }
}
</style>
