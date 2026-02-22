import type { MetaCopierAccount, MetaCopierTrade } from '@/types'
import { supabase } from '@/lib/supabase'

// All MetaCopier calls go through the Edge Function — API key never touches the browser
async function proxyFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('proxy-metacopier', {
    body: { path, params },
  })

  if (error) {
    // FunctionsHttpError stores the raw Response in .context — read it for the real error
    const ctx = (error as any).context
    if (ctx instanceof Response) {
      try {
        const body = await ctx.json()
        throw new Error(body?.error ?? error.message)
      } catch (inner: any) {
        if (inner.message && inner.message !== 'Proxy error') throw inner
      }
    }
    throw new Error(error.message ?? 'Proxy error')
  }
  return data as T
}

interface RawAccount {
  id: string
  alias?: string
  name?: string
  number?: string
  server?: string
  type?: string | { id: number; name: string }
  platform?: string
}

interface RawAccountInfo {
  balance: number
  equity: number
  connected: boolean
  openPositions: number | boolean
}

function checkIsMaster(acc: RawAccount): boolean {
  const alias = (acc.alias ?? acc.name ?? '').toUpperCase()
  return alias === 'MASTER' || alias.includes('MASTER')
}

export async function getAccounts(): Promise<MetaCopierAccount[]> {
  const raw = await proxyFetch<RawAccount[]>('/accounts')

  const infoPromises = raw.map(async (acc) => {
    const master = checkIsMaster(acc)
    try {
      const info = await proxyFetch<RawAccountInfo>(`/accounts/${acc.id}/information`)
      return {
        id: acc.id,
        name: acc.alias || acc.name || acc.number || acc.id,
        login: acc.number || '',
        server: acc.server || '',
        platform: (acc.type as any)?.name ?? acc.platform ?? '',
        balance: info.balance ?? 0,
        equity: info.equity ?? 0,
        margin: 0,
        free_margin: 0,
        connected: info.connected ?? false,
        trades_count: typeof info.openPositions === 'number' ? info.openPositions : 0,
        unrealized_pnl: (info.equity ?? 0) - (info.balance ?? 0),
        is_master: master,
      } satisfies MetaCopierAccount
    } catch {
      return {
        id: acc.id,
        name: acc.alias || acc.name || acc.number || acc.id,
        login: acc.number || '',
        server: acc.server || '',
        platform: (acc.type as any)?.name ?? acc.platform ?? '',
        balance: 0,
        equity: 0,
        margin: 0,
        free_margin: 0,
        connected: false,
        trades_count: 0,
        unrealized_pnl: 0,
        is_master: false,
      } satisfies MetaCopierAccount
    }
  })

  return Promise.all(infoPromises)
}

export interface OpenPosition {
  symbol: string
  side: string
  tp: number | null
  sl: number | null
  volume: number
  profit: number
  tpPnl: number | null
  slPnl: number | null
}

export interface OpenPositionInfo {
  pnl: number
  positions: OpenPosition[]
}

export async function getOpenPositions(accountId: string): Promise<OpenPositionInfo> {
  try {
    const data = await proxyFetch<any[]>(`/accounts/${accountId}/positions`)
    const positions = Array.isArray(data) ? data : []
    const mapped: OpenPosition[] = positions.map((p: any) => {
      const openPrice = p.openPrice ?? 0
      const tp = p.takeProfit ?? null
      const sl = p.stopLoss ?? null
      const profit = p.profit ?? p.netProfit ?? p.pnl ?? 0
      const volume = p.volume ?? 0
      const side = p.orderType ?? p.dealType ?? p.type ?? ''
      const isBuy = side.toLowerCase().includes('buy') || side.toLowerCase().includes('long')
      const symbol = (p.symbol ?? '').toUpperCase()

      let dollarPerPoint: number
      if (symbol.includes('XAU') || symbol.includes('GOLD')) {
        dollarPerPoint = volume * 100
      } else if (symbol.includes('XAG') || symbol.includes('SILVER')) {
        dollarPerPoint = volume * 5000
      } else if (symbol.includes('BTC')) {
        dollarPerPoint = volume * 1
      } else if (symbol.includes('US30') || symbol.includes('DJ30')) {
        dollarPerPoint = volume * 1
      } else if (symbol.includes('NAS') || symbol.includes('US100')) {
        dollarPerPoint = volume * 1
      } else if (symbol.includes('SPX') || symbol.includes('US500')) {
        dollarPerPoint = volume * 1
      } else {
        dollarPerPoint = volume * 100000
      }

      let tpPnl: number | null = null
      let slPnl: number | null = null
      if (tp !== null) {
        const tpDist = isBuy ? tp - openPrice : openPrice - tp
        tpPnl = Math.round(tpDist * dollarPerPoint * 100) / 100
      }
      if (sl !== null) {
        const slDist = isBuy ? sl - openPrice : openPrice - sl
        slPnl = Math.round(slDist * dollarPerPoint * 100) / 100
      }

      return { symbol, side, tp, sl, volume, profit, tpPnl, slPnl }
    })
    const pnl = mapped.reduce((sum, p) => sum + p.profit, 0)
    return { pnl, positions: mapped }
  } catch {
    return { pnl: 0, positions: [] }
  }
}

export async function getAccountTrades(accountId: string, daysBack = 30): Promise<MetaCopierTrade[]> {
  const endDate = new Date().toISOString()
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()

  const data = await proxyFetch<any[]>(`/accounts/${accountId}/history/positions`, {
    start: startDate,
    stop: endDate,
  })

  const raw = Array.isArray(data) ? data : []
  const positions = raw.filter((p: any) => {
    const type = String(p.type ?? p.side ?? '').toLowerCase()
    if (type === 'balance' || type === 'deposit' || type === 'withdrawal' || type === 'credit') return false
    if (!p.symbol && (p.volume === 0 || p.volume === undefined)) return false
    return true
  })

  return positions.map((p: any) => ({
    id: p.id || p.positionId || String(p.ticket),
    symbol: p.symbol || '',
    type: p.type || p.side || '',
    volume: p.volume ?? p.lots ?? 0,
    open_price: p.openPrice ?? p.entryPrice ?? 0,
    close_price: p.closePrice ?? p.exitPrice ?? null,
    profit: p.profit ?? p.pnl ?? p.netProfit ?? p.pl ?? p.realizedPnl ?? 0,
    swap: p.swap ?? 0,
    commission: p.commission ?? 0,
    open_time: p.openTime ?? p.openedAt ?? '',
    close_time: p.closeTime ?? p.closedAt ?? null,
  }))
}
