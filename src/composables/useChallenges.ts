import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useMetaCopier } from './useMetaCopier'
import type { Challenge, ChallengeRow, MetaCopierAccount, ServerMapping } from '@/types'

const challenges = ref<Challenge[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Server name → prop firm mapping (user can extend)
const serverMappings: ServerMapping[] = [
  { pattern: 'FTMO', prop_firm: 'FTMO' },
  { pattern: 'TheFive', prop_firm: 'The 5%ers' },
  { pattern: '5ers', prop_firm: 'The 5%ers' },
  { pattern: 'FundedHive', prop_firm: 'FundedHive' },
  { pattern: 'FundedNext', prop_firm: 'FundedNext' },
  { pattern: 'MyFundedFX', prop_firm: 'MyFundedFX' },
  { pattern: 'TrueForex', prop_firm: 'TrueForexFunds' },
  { pattern: 'Topstep', prop_firm: 'Topstep' },
  { pattern: 'E8Fund', prop_firm: 'E8 Funding' },
  { pattern: 'E8Markets', prop_firm: 'E8 Funding' },
  { pattern: 'SurgeTrader', prop_firm: 'SurgeTrader' },
  { pattern: 'CityTraders', prop_firm: 'City Traders Imperium' },
  { pattern: 'Alpha', prop_firm: 'Alpha Capital' },
]

function guessProFirm(server: string): string {
  const match = serverMappings.find(m =>
    server.toLowerCase().includes(m.pattern.toLowerCase())
  )
  return match?.prop_firm ?? 'Unknown'
}

function guessPlatform(account: MetaCopierAccount): string {
  const p = (account.platform ?? '').toLowerCase()
  if (p.includes('mt5') || p.includes('metatrader 5')) return 'MT5'
  if (p.includes('mt4') || p.includes('metatrader 4')) return 'MT4'
  if (p.includes('ctrader')) return 'cTrader'
  return account.platform || 'Unknown'
}

export function useChallenges() {
  const { accounts, openPositionsMap, lastTradeMap, tradeCountMap, streakMap, dailyPnlMap } = useMetaCopier()
  const startingBalances = ref<Record<string, number>>({})

  async function fetchChallenges() {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err
      challenges.value = data ?? []
      // Fetch starting balances from earliest snapshots
      await fetchStartingBalances()
    } catch (e: any) {
      error.value = e.message
      console.error('Failed to fetch challenges:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchStartingBalances() {
    for (const ch of challenges.value) {
      if (startingBalances.value[ch.id]) continue
      try {
        const { data } = await supabase
          .from('snapshots')
          .select('balance')
          .eq('challenge_id', ch.id)
          .order('timestamp', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (data?.balance) {
          startingBalances.value[ch.id] = data.balance
        }
      } catch {
        // No snapshot yet, will use current balance
      }
    }
  }

  const challengeRows = computed<ChallengeRow[]>(() => {
    return challenges.value.map(ch => {
      const acc = accounts.value.find(a => a.id === ch.metacopier_account_id)

      const balance = acc?.balance ?? 0
      const equity = acc?.equity ?? 0
      // Priority: explicit starting_balance from DB > earliest snapshot > current balance
      const starting = ch.starting_balance ?? startingBalances.value[ch.id] ?? balance
      const safeDivisor = starting > 0 ? starting : 1
      const profitPct = ((equity - safeDivisor) / safeDivisor) * 100
      const isMaster = ch.phase === 'Master'

      return {
        id: ch.id,
        metacopier_account_id: ch.metacopier_account_id,
        alias: ch.alias || acc?.name || ch.login_number,
        owner: ch.owner,
        prop_firm: ch.prop_firm,
        phase: ch.phase,
        platform: ch.platform || (acc ? guessPlatform(acc) : 'Unknown'),
        balance,
        equity,
        starting_balance: safeDivisor,
        target_pct: ch.target_pct,
        progress: Math.round(profitPct * 10) / 10,
        open_pnl: openPositionsMap.value[ch.metacopier_account_id]?.pnl ?? 0,
        open_positions: openPositionsMap.value[ch.metacopier_account_id]?.positions ?? [],
        is_master: isMaster,
        state: acc?.connected ? 'Connected' : 'Disconnected',
        trades_count: tradeCountMap.value[ch.metacopier_account_id] ?? acc?.trades_count ?? 0,
        last_trade: lastTradeMap.value[ch.metacopier_account_id] || null,
        login_number: ch.login_number,
        login_server: ch.login_server,
        cost: ch.cost ?? 0,
        daily_dd_pct: ch.daily_dd_pct ?? null,
        max_dd_pct: ch.max_dd_pct ?? null,
        started_at: ch.started_at ?? null,
        streak: streakMap.value[ch.metacopier_account_id] ?? null,
        daily_pnl: dailyPnlMap.value[ch.metacopier_account_id] ?? 0,
        created_at: ch.created_at,
      }
    })
  })

  // Accounts not yet linked to a challenge
  const unlinkedAccounts = computed(() => {
    const linkedIds = new Set(challenges.value.map(c => c.metacopier_account_id))
    return accounts.value.filter(a => !linkedIds.has(a.id))
  })

  async function addChallenge(challenge: Omit<Challenge, 'id' | 'created_at'>) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('challenges')
      .insert({ ...challenge, user_id: user.id })
      .select()
      .single()

    if (err) throw err
    challenges.value.unshift(data)
    return data
  }

  async function updateChallenge(id: string, fields: Partial<Omit<Challenge, 'id' | 'created_at' | 'metacopier_account_id' | 'login_number' | 'login_server' | 'platform'>>) {
    const { data, error: err } = await supabase
      .from('challenges')
      .update(fields)
      .eq('id', id)
      .select()
      .single()

    if (err) throw err
    const idx = challenges.value.findIndex(c => c.id === id)
    if (idx !== -1) challenges.value[idx] = data
    return data
  }

  async function deleteChallenge(id: string) {
    const { error: err } = await supabase
      .from('challenges')
      .delete()
      .eq('id', id)

    if (err) throw err
    challenges.value = challenges.value.filter(c => c.id !== id)
  }

  async function saveSnapshot(challengeId: string, balance: number, equity: number) {
    const drawdown = balance > 0 ? ((balance - equity) / balance) * 100 : 0
    await supabase.from('snapshots').insert({
      challenge_id: challengeId,
      balance,
      equity,
      drawdown: Math.round(drawdown * 100) / 100,
      unrealized_pnl: equity - balance,
    })
  }

  // Store snapshots for all active challenges
  async function captureSnapshots() {
    for (const row of challengeRows.value) {
      if (row.state === 'Connected' && row.balance > 0) {
        await saveSnapshot(row.id, row.balance, row.equity)
      }
    }
  }

  async function fetchSnapshots(challengeId: string): Promise<{ timestamp: string; equity: number }[]> {
    const { data } = await supabase
      .from('snapshots')
      .select('timestamp, equity')
      .eq('challenge_id', challengeId)
      .order('timestamp', { ascending: true })
    return data ?? []
  }

  return {
    challenges,
    challengeRows,
    unlinkedAccounts,
    loading,
    error,
    fetchChallenges,
    addChallenge,
    updateChallenge,
    deleteChallenge,
    captureSnapshots,
    fetchSnapshots,
    guessProFirm,
    guessPlatform,
  }
}
