import type { PropFirmConfig } from '@/types'

export const propFirms: PropFirmConfig[] = [
  // ── Tier 1 / Most Popular ────────────────────────────────────────────────
  { id: '1', name: 'FTMO', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '2', name: 'The 5%ers', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '3', name: 'FundedHive', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 5, max_dd_pct: 8 },
  ]},
  { id: '4', name: 'FundedNext', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '5', name: 'MyFundedFX', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 12 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 12 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 5, max_dd_pct: 12 },
  ]},
  { id: '6', name: 'E8 Funding', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 5, max_dd_pct: 8 },
  ]},
  { id: '7', name: 'Alpha Capital', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},

  // ── Well-known / Active ──────────────────────────────────────────────────
  { id: '8', name: 'True Forex Funds', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '9', name: 'City Traders Imperium', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 0, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 0, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 0, max_dd_pct: 10 },
  ]},
  { id: '10', name: 'Funding Pips', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '11', name: 'Goat Funded Trader', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '12', name: 'Blue Guardian', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 4, max_dd_pct: 8 },
    { name: 'Phase 2', target_pct: 4, daily_dd_pct: 4, max_dd_pct: 8 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 4, max_dd_pct: 8 },
  ]},
  { id: '13', name: 'Hola Prime', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '14', name: 'Ment Funding', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 4, max_dd_pct: 8 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 4, max_dd_pct: 8 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 4, max_dd_pct: 8 },
  ]},
  { id: '15', name: 'Funded Engineer', phases: [
    { name: 'Phase 1', target_pct: 8,  daily_dd_pct: 4, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 4, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 4, max_dd_pct: 10 },
  ]},
  { id: '16', name: 'Lux Trading Firm', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 0, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 0, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 0, max_dd_pct: 10 },
  ]},
  { id: '17', name: 'Funded Trading Plus', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '18', name: 'FunderPro', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '19', name: 'Breakout Prop', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 4, max_dd_pct: 8 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 4, max_dd_pct: 8 },
  ]},
  { id: '20', name: 'Maven Trading', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '21', name: 'SurgeTrader', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 4, max_dd_pct: 5 },
  ]},
  { id: '22', name: 'Prop Firm X', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 4, max_dd_pct: 8 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 4, max_dd_pct: 8 },
  ]},
  { id: '23', name: 'IC Funded', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '24', name: 'Glow Node', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '25', name: 'FX2 Funding', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '26', name: 'Finotive Funding', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '27', name: 'Audacity Capital', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '28', name: 'Topstep', phases: [
    { name: 'Combine', target_pct: 6, daily_dd_pct: 2, max_dd_pct: 5 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 2, max_dd_pct: 5 },
  ]},

  { id: '29', name: 'Dominion', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '30', name: 'BrightFunded', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},

  // ── Custom / Other ───────────────────────────────────────────────────────
  { id: '99', name: 'Other / Custom', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5,  daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded',  target_pct: 0,  daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
]
