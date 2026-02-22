import { ref, computed } from 'vue'

export type AppNotifType =
  | 'account_added'
  | 'account_removed'
  | 'daily_profit'
  | 'profit_target'
  | 'drawdown_warning'
  | 'disconnected'

export interface AppNotification {
  id: string
  type: AppNotifType
  title: string
  body: string
  timestamp: string
  read: boolean
}

export interface NotifPrefs {
  dailyProfitEnabled: boolean
  dailyProfitTarget: number      // $ amount
  accountEventsEnabled: boolean
  drawdownWarningEnabled: boolean
  drawdownThreshold: number      // % of max DD used
}

const NOTIFS_KEY = 'ct_app_notifs'
const PREFS_KEY  = 'ct_notif_prefs'
const DAILY_ALERTED_KEY = 'ct_daily_alerted_date'

const DEFAULT_PREFS: NotifPrefs = {
  dailyProfitEnabled: false,
  dailyProfitTarget: 500,
  accountEventsEnabled: true,
  drawdownWarningEnabled: false,
  drawdownThreshold: 80,         // % of DD limit consumed
}

function loadNotifs(): AppNotification[] {
  try { return JSON.parse(localStorage.getItem(NOTIFS_KEY) ?? '[]') }
  catch { return [] }
}

function loadPrefs(): NotifPrefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') } }
  catch { return { ...DEFAULT_PREFS } }
}

// Module-level singletons
const notifications = ref<AppNotification[]>(loadNotifs())
const prefs = ref<NotifPrefs>(loadPrefs())
const drawdownAlertedIds = ref<Set<string>>(new Set())

export function useAppNotifications() {
  function push(type: AppNotifType, title: string, body: string) {
    const notif: AppNotification = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      body,
      timestamp: new Date().toISOString(),
      read: false,
    }
    notifications.value = [notif, ...notifications.value].slice(0, 100)
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifications.value))
  }

  function markAllRead() {
    notifications.value = notifications.value.map(n => ({ ...n, read: true }))
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifications.value))
  }

  function markRead(id: string) {
    const n = notifications.value.find(n => n.id === id)
    if (n) n.read = true
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifications.value))
  }

  function clearAll() {
    notifications.value = []
    localStorage.removeItem(NOTIFS_KEY)
  }

  function savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs.value))
  }

  // Call after each fetchHistory with the summed daily P&L across all accounts
  function checkDailyProfit(totalDailyPnl: number) {
    if (!prefs.value.dailyProfitEnabled) return
    const today = new Date().toDateString()
    if (localStorage.getItem(DAILY_ALERTED_KEY) === today) return
    if (totalDailyPnl >= prefs.value.dailyProfitTarget) {
      localStorage.setItem(DAILY_ALERTED_KEY, today)
      push('daily_profit', 'Daily Profit Target Reached 🎯',
        `+$${totalDailyPnl.toFixed(2)} today — target was $${prefs.value.dailyProfitTarget}`)
    }
  }

  // Call when challenge drawdown data updates
  function checkDrawdown(accountId: string, alias: string, ddUsedPct: number) {
    if (!prefs.value.drawdownWarningEnabled) return
    if (drawdownAlertedIds.value.has(accountId)) return
    if (ddUsedPct >= prefs.value.drawdownThreshold) {
      drawdownAlertedIds.value.add(accountId)
      push('drawdown_warning', 'Drawdown Warning ⚠️',
        `${alias} — ${ddUsedPct.toFixed(1)}% of drawdown limit used`)
    }
  }

  const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

  return {
    notifications,
    prefs,
    unreadCount,
    push,
    markAllRead,
    markRead,
    clearAll,
    savePrefs,
    checkDailyProfit,
    checkDrawdown,
  }
}
