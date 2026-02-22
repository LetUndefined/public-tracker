import { ref } from 'vue'
import type { MetaCopierAccount, MetaCopierTrade } from '@/types'
import { getBatchLive, getBatchHistory, getAccountTrades } from '@/lib/metacopier'
import type { OpenPositionInfo } from '@/lib/metacopier'

const accounts = ref<MetaCopierAccount[]>([])
const openPositionsMap = ref<Record<string, OpenPositionInfo>>({})
const lastTradeMap = ref<Record<string, string>>({})
const tradeCountMap = ref<Record<string, number>>({})
const streakMap = ref<Record<string, { direction: 'W' | 'L'; count: number } | null>>({})
const dailyPnlMap = ref<Record<string, number>>({})
// Shared trade cache — populated by fetchAccounts, consumed by useNotifications
// so trades are never fetched twice per cycle
const tradesMap = ref<Record<string, MetaCopierTrade[]>>({})
const loading = ref(false)
const error = ref<string | null>(null)

function computeDailyPnl(trades: MetaCopierTrade[]): number {
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const midnightMs = midnight.getTime()
  return trades
    .filter(t => t.close_time !== null && new Date(t.close_time).getTime() >= midnightMs)
    .reduce((sum, t) => sum + (t.profit ?? 0), 0)
}

function computeStreak(trades: MetaCopierTrade[]): { direction: 'W' | 'L'; count: number } | null {
  const closed = trades
    .filter(t => t.close_time !== null && (t.profit ?? 0) !== 0)
    .sort((a, b) => (b.close_time ?? '').localeCompare(a.close_time ?? ''))
  if (closed.length === 0) return null
  const direction = (closed[0].profit ?? 0) > 0 ? 'W' : 'L'
  let count = 0
  for (const t of closed) {
    if (((t.profit ?? 0) > 0) === (direction === 'W')) count++
    else break
  }
  return { direction, count }
}

let liveInterval: ReturnType<typeof setInterval> | null = null
let fullInterval: ReturnType<typeof setInterval> | null = null

export function useMetaCopier() {
  // Fast path: all accounts + info + open positions in 1 batch edge call
  // Called every 60s — was 1 + 2N calls, now just 1
  async function fetchLive() {
    loading.value = true
    error.value = null
    try {
      const { accounts: accs, openPositionsMap: posMap } = await getBatchLive()
      accounts.value = accs
      openPositionsMap.value = posMap
    } catch (e: any) {
      error.value = e.message
      console.error('Failed to fetch MetaCopier accounts:', e)
    } finally {
      loading.value = false
    }
  }

  // Slow path: trade history for all accounts in 1 batch edge call
  // Called every 180s — was N calls, now just 1
  async function fetchHistory() {
    try {
      const allTrades = await getBatchHistory()
      const tradeResults = Object.entries(allTrades).map(([id, trades]) => {
        let lastTime = ''
        if (trades.length > 0) {
          const sorted = [...trades].sort((a, b) => {
            const ta = a.close_time ?? a.open_time
            const tb = b.close_time ?? b.open_time
            return tb.localeCompare(ta)
          })
          lastTime = sorted[0].close_time ?? sorted[0].open_time
        }
        return { id, trades, lastTime, count: trades.length, streak: computeStreak(trades), dailyPnl: computeDailyPnl(trades) }
      })
      tradesMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.trades]))
      lastTradeMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.lastTime]))
      tradeCountMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.count]))
      streakMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.streak]))
      dailyPnlMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.dailyPnl]))
    } catch (e: any) {
      console.error('Failed to fetch trade history:', e)
    }
  }

  // Full refresh: live + history together (used on mount)
  async function fetchAccounts() {
    await fetchLive()
    await fetchHistory()
  }

  async function fetchTrades(accountId: string, daysBack = 30): Promise<MetaCopierTrade[]> {
    // Return cached trades if available — avoids a redundant proxy call
    if (tradesMap.value[accountId]?.length) return tradesMap.value[accountId]
    try {
      return await getAccountTrades(accountId, daysBack)
    } catch (e: any) {
      console.error(`Failed to fetch trades for ${accountId}:`, e)
      return []
    }
  }

  function startAutoRefresh(liveMs = 60_000, historyMs = 180_000) {
    stopAutoRefresh()
    fetchAccounts()
    // Live positions refresh every 60s
    liveInterval = setInterval(fetchLive, liveMs)
    // Trade history refresh every 3 min (also updates notification cache)
    fullInterval = setInterval(fetchHistory, historyMs)
  }

  function stopAutoRefresh() {
    if (liveInterval) { clearInterval(liveInterval); liveInterval = null }
    if (fullInterval) { clearInterval(fullInterval); fullInterval = null }
  }

  return {
    accounts,
    openPositionsMap,
    lastTradeMap,
    tradeCountMap,
    streakMap,
    dailyPnlMap,
    tradesMap,
    loading,
    error,
    fetchAccounts,
    fetchTrades,
    startAutoRefresh,
    stopAutoRefresh,
  }
}
