import type { MetaCopierAccount, MetaCopierTrade } from '@/types'
import { supabase } from '@/lib/supabase'

// All MetaCopier calls go through the Edge Function — API key never touches the browser
async function proxyFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('proxy-metacopier', {
    body: { path, params },
  })

  if (error) {
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

function parseAccount(acc: RawAccount, info: RawAccountInfo | null): MetaCopierAccount {
  const master = checkIsMaster(acc)
  if (!info) {
    return {
      id: acc.id,
      name: acc.alias || acc.name || acc.number || acc.id,
      login: acc.number || '',
      server: acc.server || '',
      platform: (acc.type as any)?.name ?? acc.platform ?? '',
      balance: 0, equity: 0, margin: 0, free_margin: 0,
      connected: false, trades_count: 0, unrealized_pnl: 0, is_master: master,
    }
  }
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
  }
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

function parsePositions(raw: any[]): OpenPositionInfo {
  const positions = Array.isArray(raw) ? raw : []
  const mapped: OpenPosition[] = positions.map((p: any) => {
    const openPrice = p.openPrice ?? 0
    const tp = p.takeProfit ?? null
    const sl = p.stopLoss ?? null
    const profit = p.profit ?? p.netProfit ?? p.pnl ?? 0
    const volume = p.volume ?? 0
    const side = normalizeTradeType(p.orderType ?? p.dealType ?? p.type ?? '')
    const isBuy = side.includes('buy') || side === 'long'
    const symbol = (p.symbol ?? '').toUpperCase()

    let dollarPerPoint: number
    if (symbol.includes('XAU') || symbol.includes('GOLD')) dollarPerPoint = volume * 100
    else if (symbol.includes('XAG') || symbol.includes('SILVER')) dollarPerPoint = volume * 5000
    else if (symbol.includes('BTC')) dollarPerPoint = volume * 1
    else if (symbol.includes('US30') || symbol.includes('DJ30')) dollarPerPoint = volume * 1
    else if (symbol.includes('NAS') || symbol.includes('US100')) dollarPerPoint = volume * 1
    else if (symbol.includes('SPX') || symbol.includes('US500')) dollarPerPoint = volume * 1
    else dollarPerPoint = volume * 100000

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
    return { symbol, side: isBuy ? 'buy' : 'sell', tp, sl, volume, profit, tpPnl, slPnl }
  })
  const pnl = mapped.reduce((sum, p) => sum + p.profit, 0)
  return { pnl, positions: mapped }
}

// MT5 returns numeric deal types: 0 = BUY, 1 = SELL
function normalizeTradeType(raw: any): string {
  if (raw === 0 || raw === '0') return 'buy'
  if (raw === 1 || raw === '1') return 'sell'
  return String(raw ?? '').toLowerCase()
}

// For CLOSED positions, infer direction from price movement + profit.
// MetaCopier history returns the closing deal type which is inverted in MT5
// (closing a BUY uses a SELL deal), so the type field is unreliable.
function inferClosedSide(openPrice: number, closePrice: number, profit: number): string {
  if (openPrice > 0 && closePrice > 0 && Math.abs(closePrice - openPrice) > 0.00001) {
    if (closePrice > openPrice) return profit >= 0 ? 'buy' : 'sell'
    return profit >= 0 ? 'sell' : 'buy'
  }
  return profit >= 0 ? 'buy' : 'sell'
}

function parseTradeHistory(raw: any[]): MetaCopierTrade[] {
  const positions = (Array.isArray(raw) ? raw : []).filter((p: any) => {
    const type = normalizeTradeType(p.type ?? p.side ?? '')
    if (type === 'balance' || type === 'deposit' || type === 'withdrawal' || type === 'credit') return false
    if (!p.symbol && (p.volume === 0 || p.volume === undefined)) return false
    return true
  })
  return positions.map((p: any) => {
    const openPrice = p.openPrice ?? p.entryPrice ?? 0
    const closePrice = p.closePrice ?? p.exitPrice ?? null
    const profit = p.profit ?? p.pnl ?? p.netProfit ?? p.pl ?? p.realizedPnl ?? 0
    const side = closePrice !== null
      ? inferClosedSide(openPrice, closePrice, profit)
      : normalizeTradeType(p.type ?? p.side ?? '')
    return {
      id: p.id || p.positionId || String(p.ticket),
      symbol: p.symbol || '',
      type: side,
      volume: p.volume ?? p.lots ?? 0,
      open_price: openPrice,
      close_price: closePrice,
      profit,
      swap: p.swap ?? 0,
      commission: p.commission ?? 0,
      open_time: p.openTime ?? p.openedAt ?? '',
      close_time: p.closeTime ?? p.closedAt ?? null,
    }
  })
}

// ── Batch fetch: all accounts + info + positions in 1 edge call ──────────────
export async function getBatchLive(): Promise<{
  accounts: MetaCopierAccount[]
  openPositionsMap: Record<string, OpenPositionInfo>
}> {
  const enriched = await proxyFetch<{ account: RawAccount; info: RawAccountInfo | null; positions: any[] }[]>('/batch/live')
  const accounts = enriched.map(e => parseAccount(e.account, e.info))
  const openPositionsMap = Object.fromEntries(
    enriched.map(e => [e.account.id, parsePositions(e.positions ?? [])])
  )
  return { accounts, openPositionsMap }
}

// ── Batch fetch: trade history for all accounts in 1 edge call ───────────────
export async function getBatchHistory(daysBack = 30): Promise<Record<string, MetaCopierTrade[]>> {
  const endDate = new Date().toISOString()
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
  const histories = await proxyFetch<{ id: string; history: any[] }[]>('/batch/history', {
    start: startDate,
    stop: endDate,
  })
  return Object.fromEntries(histories.map(h => [h.id, parseTradeHistory(h.history ?? [])]))
}

// ── Legacy single-account fetches (kept for fallback / ad-hoc use) ───────────
export async function getAccounts(): Promise<MetaCopierAccount[]> {
  const { accounts } = await getBatchLive()
  return accounts
}

export async function getOpenPositions(accountId: string): Promise<OpenPositionInfo> {
  try {
    const data = await proxyFetch<any[]>(`/accounts/${accountId}/positions`)
    return parsePositions(data)
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
  return parseTradeHistory(Array.isArray(data) ? data : [])
}
