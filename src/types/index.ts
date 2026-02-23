// ── Supabase row types ──

export interface Challenge {
  id: string
  metacopier_account_id: string
  alias: string
  prop_firm: string
  phase: 'Phase 1' | 'Phase 2' | 'Funded' | 'Master'
  platform: string
  target_pct: number
  owner: string
  login_number: string
  login_server: string
  starting_balance?: number
  cost?: number
  daily_dd_pct?: number | null
  max_dd_pct?: number | null
  started_at?: string | null
  created_at: string
}

export interface Snapshot {
  id: string
  challenge_id: string
  balance: number
  equity: number
  drawdown: number
  unrealized_pnl: number
  timestamp: string
}

export interface Trade {
  id: string
  challenge_id: string
  symbol: string
  side: 'buy' | 'sell'
  volume: number
  open_price: number
  close_price: number
  profit: number
  swap: number
  commission: number
  open_time: string
  close_time: string
}

// ── MetaCopier API types ──

export interface MetaCopierAccount {
  id: string
  name: string
  login: string
  server: string
  platform: string
  balance: number
  equity: number
  margin: number
  free_margin: number
  connected: boolean
  trades_count: number
  unrealized_pnl: number
  is_master: boolean
}

export interface MetaCopierTrade {
  id: string
  symbol: string
  type: string
  volume: number
  open_price: number
  close_price: number | null
  profit: number
  swap: number
  commission: number
  open_time: string
  close_time: string | null
}

// ── Combined display type ──

export interface ChallengeRow {
  id: string
  metacopier_account_id: string
  alias: string
  owner: string
  prop_firm: string
  phase: string
  platform: string
  balance: number
  equity: number
  starting_balance: number
  target_pct: number
  progress: number       // (profit / target) * 100
  open_pnl: number       // live PNL from open positions
  open_positions: { symbol: string; side: string; tp: number | null; sl: number | null; volume: number; profit: number; tpPnl: number | null; slPnl: number | null }[]
  is_master: boolean
  state: 'Connected' | 'Disconnected'
  stale_since: string | null   // timestamp of last known good data, null when connected
  trades_count: number
  last_trade: string | null
  login_number: string
  login_server: string
  cost: number
  daily_dd_pct: number | null
  max_dd_pct: number | null
  started_at: string | null
  streak: { direction: 'W' | 'L'; count: number } | null
  daily_pnl: number
  created_at: string
}

// ── Prop firm config ──

export interface PropFirmConfig {
  id: string
  name: string
  phases: {
    name: string
    target_pct: number
    daily_dd_pct: number
    max_dd_pct: number
  }[]
}

export interface Payout {
  id: string
  challenge_id: string
  amount: number
  status: 'pending' | 'received' | 'rejected'
  requested_at: string
  received_at: string | null
  notes: string | null
  created_at: string
}

export interface Owner {
  id: string
  name: string
  challenges_count?: number
}

// ── Server → prop firm mapping ──

export interface ServerMapping {
  pattern: string       // regex or substring to match server name
  prop_firm: string
}
