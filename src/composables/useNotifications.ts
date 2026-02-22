import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useMetaCopier } from './useMetaCopier'
import { useChallenges } from './useChallenges'
import { usePushNotifications } from './usePushNotifications'
import { useAppNotifications } from './useAppNotifications'
import type { MetaCopierTrade } from '@/types'

export interface TradeNotification {
  id: string
  challenge_id: string
  account_alias: string
  symbol: string
  side: string
  volume: number
  profit: number | null
  open_price: number
  close_price: number | null
  open_time: string
  close_time: string | null
  is_open: boolean
  timestamp: string
}

const notifications = ref<TradeNotification[]>([])
const seenTradeIds = ref<Set<string>>(new Set())
const targetAlertedIds = ref<Set<string>>(new Set())
const loading = ref(false)
const includeMaster = ref(false)

let pollInterval: ReturnType<typeof setInterval> | null = null
let targetWatchSetup = false

export function useNotifications() {
  const { fetchTrades } = useMetaCopier()
  const { challenges, challengeRows } = useChallenges()
  const { notify } = usePushNotifications()

  async function pollForNewTrades() {
    loading.value = true
    try {
      for (const ch of challenges.value) {
        const row = challengeRows.value.find(r => r.id === ch.id)
        // Skip master accounts unless toggled on
        if (row?.is_master && !includeMaster.value) continue

        // Use cached trades from useMetaCopier (populated by fetchHistory every 90s)
        // to avoid fetching trade history a second time on this cycle
        const trades = await fetchTrades(ch.metacopier_account_id)
        const alias = row?.alias ?? ch.alias ?? ch.login_number

        for (const trade of trades) {
          const key = `${ch.metacopier_account_id}-${trade.id}`
          if (!seenTradeIds.value.has(key)) {
            seenTradeIds.value.add(key)
            const isOpen = trade.close_time === null
            notifications.value.unshift({
              id: key,
              challenge_id: ch.id,
              account_alias: alias,
              symbol: trade.symbol,
              side: trade.type,
              volume: trade.volume,
              profit: trade.profit,
              open_price: trade.open_price,
              close_price: trade.close_price,
              open_time: trade.open_time,
              close_time: trade.close_time,
              is_open: isOpen,
              timestamp: trade.close_time ?? trade.open_time,
            })

            // Push alerts — master account only
            if (row?.is_master) {
              const tradeSide = trade.type.toLowerCase()
              const isBuy = tradeSide.includes('buy') || tradeSide === 'long'

              if (isOpen) {
                // Count how many copier accounts opened the same position
                const copiers = challengeRows.value.filter(r => !r.is_master && r.state === 'Connected')
                const total = copiers.length
                const matched = copiers.filter(r =>
                  r.open_positions.some(p => {
                    const ps = p.side.toLowerCase()
                    const pIsBuy = ps.includes('buy') || ps === 'long'
                    return p.symbol.toUpperCase() === trade.symbol.toUpperCase() && pIsBuy === isBuy
                  })
                ).length
                notify(
                  'Trade Opened',
                  `${trade.symbol} · ${matched}/${total} accounts`,
                  key,
                )
              } else {
                const profit = trade.profit ?? 0
                const outcome = profit > 0 ? 'Take Profit hit ✅' : profit < 0 ? 'Stop Loss hit ❌' : 'Trade Closed'
                const pnlStr = profit !== 0
                  ? ` · ${profit >= 0 ? '+' : ''}$${Math.abs(profit).toFixed(2)}`
                  : ''
                notify(
                  outcome,
                  `${trade.symbol}${pnlStr}`,
                  key,
                )
              }
            }
          }
        }
      }
      // Keep last 200 notifications
      if (notifications.value.length > 200) {
        notifications.value = notifications.value.slice(0, 200)
      }
    } catch (e) {
      console.error('Failed to poll trades:', e)
    } finally {
      loading.value = false
    }
  }

  // Watch for accounts hitting their profit target or drawdown warnings
  if (!targetWatchSetup) {
    targetWatchSetup = true
    watch(challengeRows, (rows) => {
      const { push, checkDrawdown } = useAppNotifications()
      for (const row of rows) {
        if (!row.is_master) {
          // Profit target
          if (
            row.target_pct > 0 &&
            row.progress >= row.target_pct &&
            !targetAlertedIds.value.has(row.id)
          ) {
            targetAlertedIds.value.add(row.id)
            notify('Profit Target Reached 🎯', `${row.alias} · ${row.progress}% / ${row.target_pct}% target`, `target-${row.id}`)
            push('profit_target', 'Profit Target Reached 🎯', `${row.alias} · ${row.progress}% of ${row.target_pct}% target`)
          }

          // Drawdown warning — check % of max DD limit consumed
          if (row.max_dd_pct && row.max_dd_pct > 0 && row.starting_balance > 0) {
            const ddUsed = ((row.starting_balance - row.equity) / row.starting_balance) * 100
            const ddUsedPct = (ddUsed / row.max_dd_pct) * 100
            checkDrawdown(row.id, row.alias, ddUsedPct)
          }
        }
      }
    })
  }

  // When master toggle changes, add/remove master notifications
  watch(includeMaster, (val) => {
    if (!val) {
      // Remove master notifications and clear their seen IDs
      const masterRows = challengeRows.value.filter(r => r.is_master)
      const masterAccountIds = new Set(masterRows.map(r => r.metacopier_account_id))
      const toRemove = notifications.value.filter(n => {
        const row = challengeRows.value.find(r => r.id === n.challenge_id)
        return row && masterAccountIds.has(row.metacopier_account_id)
      })
      for (const n of toRemove) {
        seenTradeIds.value.delete(n.id)
      }
      notifications.value = notifications.value.filter(n => !toRemove.includes(n))
    } else {
      pollForNewTrades()
    }
  })

  function startPolling(intervalMs = 90_000) {
    stopPolling()
    pollForNewTrades()
    pollInterval = setInterval(pollForNewTrades, intervalMs)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  const unreadCount = computed(() => {
    // Count notifications from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    return notifications.value.filter(n => n.timestamp > oneHourAgo).length
  })

  return {
    notifications,
    loading,
    unreadCount,
    includeMaster,
    pollForNewTrades,
    startPolling,
    stopPolling,
  }
}
