<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppNotifications } from '@/composables/useAppNotifications'
import type { AppNotifType } from '@/composables/useAppNotifications'

const { notifications, unreadCount, markAllRead, markRead, clearAll } = useAppNotifications()

const open = ref(false)
const bellRef = ref<HTMLElement | null>(null)

function toggle() { open.value = !open.value }

function handleClickOutside(e: MouseEvent) {
  if (bellRef.value && !bellRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TYPE_ICONS: Record<AppNotifType, string> = {
  account_added:    '＋',
  account_removed:  '−',
  daily_profit:     '🎯',
  profit_target:    '✅',
  drawdown_warning: '⚠',
  disconnected:     '⚡',
}

const TYPE_CLASS: Record<AppNotifType, string> = {
  account_added:    'type-green',
  account_removed:  'type-red',
  daily_profit:     'type-gold',
  profit_target:    'type-gold',
  drawdown_warning: 'type-red',
  disconnected:     'type-muted',
}
</script>

<template>
  <div class="bell-wrap" ref="bellRef">
    <button class="bell-btn" :class="{ active: open }" @click="toggle" title="Notifications">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span v-if="unreadCount > 0" class="bell-badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
    </button>

    <Transition name="panel">
      <div v-if="open" class="notif-panel">
        <div class="panel-header">
          <span class="panel-title">NOTIFICATIONS</span>
          <div class="panel-actions">
            <button v-if="unreadCount > 0" class="panel-act" @click="markAllRead">Mark all read</button>
            <button v-if="notifications.length > 0" class="panel-act panel-act-dim" @click="clearAll">Clear</button>
          </div>
        </div>

        <div v-if="notifications.length === 0" class="panel-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" opacity=".3">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.4"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.4"/>
          </svg>
          <span>No notifications</span>
        </div>

        <div v-else class="notif-list">
          <div
            v-for="n in notifications"
            :key="n.id"
            class="notif-item"
            :class="{ unread: !n.read }"
            @click="markRead(n.id)"
          >
            <span class="notif-icon" :class="TYPE_CLASS[n.type]">{{ TYPE_ICONS[n.type] }}</span>
            <div class="notif-body">
              <div class="notif-title">{{ n.title }}</div>
              <div class="notif-msg">{{ n.body }}</div>
            </div>
            <span class="notif-time">{{ timeAgo(n.timestamp) }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bell-wrap {
  position: relative;
}

.bell-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.bell-btn:hover,
.bell-btn.active {
  color: var(--accent);
  background: var(--surface);
}

.bell-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  border-radius: 7px;
  background: var(--accent);
  color: #0f1115;
}

/* ── Panel ── */
.notif-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 320px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 200;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--border-subtle);
}

.panel-title {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.panel-act {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s;
}

.panel-act:hover { opacity: 0.7; }
.panel-act-dim { color: var(--text-muted); }

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.notif-list {
  max-height: 380px;
  overflow-y: auto;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 0.12s;
}

.notif-item:last-child { border-bottom: none; }

.notif-item:hover { background: var(--surface); }

.notif-item.unread {
  background: rgba(var(--accent-rgb, 99, 102, 241), 0.04);
  border-left: 2px solid var(--accent);
  padding-left: 12px;
}

.notif-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  background: var(--surface);
  font-style: normal;
}

.type-green { color: var(--green); }
.type-red   { color: var(--red); }
.type-gold  { color: #F0B429; }
.type-muted { color: var(--text-muted); }

.notif-body {
  flex: 1;
  min-width: 0;
}

.notif-title {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-msg {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.4;
}

.notif-time {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  margin-top: 2px;
}

/* ── Transition ── */
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
