<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// ── Animated demo numbers ──────────────────────────────────────────────
const pnl     = ref(1843)
const equity  = ref(149666)
const daily   = ref(312)
let ticker: ReturnType<typeof setInterval>

const trades = ref([
  { id: 1, pair: 'XAUUSD', dir: 'BUY',  pl: 284,  live: true  },
  { id: 2, pair: 'EURUSD', dir: 'SELL', pl: -91,  live: true  },
  { id: 3, pair: 'NAS100', dir: 'BUY',  pl: 1650, live: false },
])

const alert = ref<string | null>(null)
const alertQueue = [
  'Trade opened — XAUUSD BUY 0.5 lots',
  'Progress 87% — FTMO Phase 1',
  'Trade closed — GBPUSD +$148',
  'Daily P&L target reached',
]
let alertIdx = 0

onMounted(() => {
  ticker = setInterval(() => {
    const d = (Math.random() - 0.46) * 60
    pnl.value   = Math.round(pnl.value + d)
    equity.value = 147823 + pnl.value
    daily.value = Math.round(daily.value + (Math.random() - 0.45) * 20)

    trades.value = trades.value.map(t =>
      t.live ? { ...t, pl: Math.round(t.pl + (Math.random() - 0.48) * 30) } : t
    )

    if (Math.random() > 0.72) {
      alert.value = alertQueue[alertIdx % alertQueue.length]
      alertIdx++
      setTimeout(() => { alert.value = null }, 2800)
    }
  }, 1400)
})

onUnmounted(() => clearInterval(ticker))

function fmt(n: number, sign = false) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (!sign) return `$${abs}`
  return `${n >= 0 ? '+' : '-'}$${abs}`
}
</script>

<template>
  <div class="landing">

    <!-- ─── Nav ─────────────────────────────────────────────────────── -->
    <nav class="l-nav">
      <div class="l-nav-inner">
        <div class="l-brand">
          <!-- Reticle logo mark -->
          <svg class="l-mark" width="26" height="26" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10.3" stroke="#F0B429" stroke-width="1.2"/>
            <line x1="12" y1="1.7" x2="12" y2="5"   stroke="#F0B429" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="22.3" y1="12" x2="19" y2="12" stroke="#F0B429" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="12" y1="22.3" x2="12" y2="19" stroke="#F0B429" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="1.7" y1="12" x2="5" y2="12"   stroke="#F0B429" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="12" cy="12" r="4.5" stroke="#F0B429" stroke-width="0.7" stroke-opacity="0.4"/>
            <path d="M12 9.8L14.2 12L12 14.2L9.8 12Z" fill="#F0B429"/>
          </svg>
          <span class="l-brand-name">SENTINEL</span>
        </div>
        <div class="l-nav-right">
          <a href="/login" class="l-nav-link">Sign in</a>
          <a href="/login" class="l-nav-cta">Get started free</a>
        </div>
      </div>
    </nav>

    <!-- ─── Hero ─────────────────────────────────────────────────────── -->
    <section class="hero">
      <div class="hero-grid-overlay" aria-hidden="true" />
      <div class="hero-glow"        aria-hidden="true" />

      <div class="hero-inner">

        <!-- Left: copy -->
        <div class="hero-copy">
          <div class="hero-badge">
            <span class="badge-dot" />
            PROP FIRM INTELLIGENCE
          </div>

          <h1 class="hero-headline">
            Every funded<br />
            account.<br />
            <em>One terminal.</em>
          </h1>

          <p class="hero-sub">
            If you use MetaCopier to copy trades across your
            prop firm accounts, Sentinel gives you a single
            terminal to track live P&amp;L, drawdown, and
            challenge progress — updated every 60 seconds.
          </p>

          <div class="hero-actions">
            <a href="/login" class="btn-primary">
              Start tracking free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <span class="hero-note">No credit card required</span>
          </div>

          <div class="hero-stats">
            <div class="hs">
              <div class="hs-num">60s</div>
              <div class="hs-label">LIVE REFRESH</div>
            </div>
            <div class="hs-sep" />
            <div class="hs">
              <div class="hs-num">∞</div>
              <div class="hs-label">ACCOUNTS</div>
            </div>
            <div class="hs-sep" />
            <div class="hs">
              <div class="hs-num">0</div>
              <div class="hs-label">COST</div>
            </div>
          </div>
        </div>

        <!-- Right: live demo mockup -->
        <div class="hero-demo">
          <div class="demo-card">

            <!-- Demo header -->
            <div class="demo-topbar">
              <div class="demo-brand">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10.3" stroke="#F0B429" stroke-width="1.2"/>
                  <path d="M12 9.8L14.2 12L12 14.2L9.8 12Z" fill="#F0B429"/>
                </svg>
                <span>SENTINEL</span>
              </div>
              <div class="demo-live">
                <span class="demo-live-dot" />
                LIVE
              </div>
            </div>

            <!-- Demo stats strip -->
            <div class="demo-stats">
              <div class="demo-stat">
                <div class="demo-stat-val">${{ (147823).toLocaleString() }}</div>
                <div class="demo-stat-lbl">BALANCE</div>
              </div>
              <div class="demo-stat">
                <div class="demo-stat-val">${{ equity.toLocaleString() }}</div>
                <div class="demo-stat-lbl">EQUITY</div>
              </div>
              <div class="demo-stat">
                <div class="demo-stat-val" :class="pnl >= 0 ? 'pos' : 'neg'">{{ fmt(pnl, true) }}</div>
                <div class="demo-stat-lbl">OPEN P&L</div>
              </div>
              <div class="demo-stat">
                <div class="demo-stat-val" :class="daily >= 0 ? 'pos' : 'neg'">{{ fmt(daily, true) }}</div>
                <div class="demo-stat-lbl">DAILY P&L</div>
              </div>
            </div>

            <!-- Demo table -->
            <div class="demo-table">
              <div class="demo-thead">
                <span>ACCOUNT</span>
                <span>BALANCE</span>
                <span>PROGRESS</span>
                <span>OPEN P&L</span>
              </div>

              <div class="demo-row">
                <div class="demo-acct">
                  <div class="demo-acct-name">FTMO – Phase 1</div>
                  <div class="demo-acct-firm">FTMO</div>
                </div>
                <div class="demo-bal">${{ (50823).toLocaleString() }}</div>
                <div class="demo-prog">
                  <div class="demo-prog-bar"><div class="demo-prog-fill" style="width:84%" /></div>
                  <span>84%</span>
                </div>
                <div class="demo-pl pos">{{ fmt(trades[0].pl, true) }}</div>
              </div>

              <div class="demo-row">
                <div class="demo-acct">
                  <div class="demo-acct-name">Apex – Funded 50K</div>
                  <div class="demo-acct-firm">APEX</div>
                </div>
                <div class="demo-bal">${{ (55291).toLocaleString() }}</div>
                <div class="demo-prog">
                  <div class="demo-prog-bar"><div class="demo-prog-fill" style="width:52%" /></div>
                  <span>52%</span>
                </div>
                <div class="demo-pl neg">{{ fmt(trades[1].pl, true) }}</div>
              </div>

              <div class="demo-row">
                <div class="demo-acct">
                  <div class="demo-acct-name">The5ers – Funded</div>
                  <div class="demo-acct-firm">THE5ERS</div>
                </div>
                <div class="demo-bal">${{ (41709).toLocaleString() }}</div>
                <div class="demo-prog">
                  <div class="demo-prog-bar"><div class="demo-prog-fill" style="width:100%;background:var(--green)" /></div>
                  <span style="color:var(--green)">✓</span>
                </div>
                <div class="demo-pl pos">{{ fmt(trades[2].pl, true) }}</div>
              </div>
            </div>

            <!-- Alert toast inside mockup -->
            <Transition name="alert-pop">
              <div v-if="alert" class="demo-alert">
                <span class="demo-alert-dot" />
                {{ alert }}
              </div>
            </Transition>

          </div>

          <!-- Floating decorative elements -->
          <div class="demo-float demo-float-1">DRAWDOWN<br/><strong>-2.1%</strong></div>
          <div class="demo-float demo-float-2">WIN RATE<br/><strong>68%</strong></div>
        </div>

      </div>
    </section>

    <!-- ─── Features ─────────────────────────────────────────────────── -->
    <section class="features">
      <div class="features-inner">
        <div class="section-label">WHAT YOU GET</div>

        <div class="feature-grid">
          <div class="feature-card">
            <div class="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <h3 class="feature-title">Live Portfolio Monitor</h3>
            <p class="feature-body">Real-time balance, equity, and open P&L across every funded account — synced every 60 seconds via MetaCopier.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <h3 class="feature-title">Drawdown Alerts</h3>
            <p class="feature-body">Push notifications before you breach your daily or max drawdown. Never get caught off guard mid-session again.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <h3 class="feature-title">Challenge Analytics</h3>
            <p class="feature-body">Equity curves, win rate, profit factor, and streak tracking. Know exactly how each challenge is performing.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <h3 class="feature-title">Payout Tracker</h3>
            <p class="feature-body">Log every payout from every firm. Track your total extracted capital and see your real return on funded accounts.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/>
              </svg>
            </div>
            <h3 class="feature-title">Firm Comparison <span class="lp-beta">BETA</span></h3>
            <p class="feature-body">Side-by-side table of every major prop firm — drawdown rules, fees, profit splits, and trading restrictions.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h3 class="feature-title">Secure by Design</h3>
            <p class="feature-body">Your MetaCopier API key is encrypted in Supabase Vault — never exposed to the browser. Your data stays yours.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ─── CTA ──────────────────────────────────────────────────────── -->
    <section class="cta-section">
      <div class="cta-glow" aria-hidden="true" />
      <div class="cta-inner">
        <div class="section-label">GET STARTED</div>
        <h2 class="cta-headline">One terminal for<br />all your MetaCopier accounts.</h2>
        <p class="cta-sub">Already using MetaCopier? Connect your API key and see everything in one place.</p>
        <a href="/login" class="btn-primary btn-lg">
          Create free account
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    </section>

    <!-- ─── Footer ───────────────────────────────────────────────────── -->
    <footer class="l-footer">
      <div class="l-footer-inner">
        <div class="l-brand" style="opacity:0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10.3" stroke="#F0B429" stroke-width="1.2"/>
            <path d="M12 9.8L14.2 12L12 14.2L9.8 12Z" fill="#F0B429"/>
          </svg>
          <span class="l-brand-name" style="font-size:11px">SENTINEL</span>
        </div>
        <span class="footer-copy">Built for prop firm traders.</span>
      </div>
    </footer>

  </div>
</template>

<style scoped>

/* ── Root ── */
.landing {
  min-height: 100vh;
  background: #07080c;
  color: #e2e4ee;
  overflow-x: hidden;
}

/* ── Nav ── */
.l-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  backdrop-filter: blur(14px);
  background: rgba(7, 8, 12, 0.8);
  border-bottom: 1px solid rgba(240, 180, 41, 0.08);
}

.l-nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.l-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.l-brand-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #F0B429;
}

.l-mark { display: block; }

.l-nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.l-nav-link {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #6b7280;
  text-decoration: none;
  transition: color 0.15s;
}
.l-nav-link:hover { color: #e2e4ee; }

.l-nav-cta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #07080c;
  background: #F0B429;
  border-radius: 6px;
  padding: 7px 16px;
  text-decoration: none;
  transition: opacity 0.15s;
}
.l-nav-cta:hover { opacity: 0.88; }

/* ── Hero ── */
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 100px 32px 80px;
  overflow: hidden;
}

.hero-grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(240,180,41,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(240,180,41,0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
}

.hero-glow {
  position: absolute;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 400px;
  background: radial-gradient(ellipse, rgba(240,180,41,0.07) 0%, transparent 70%);
  pointer-events: none;
}

.hero-inner {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
}

/* ── Hero copy ── */
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #F0B429;
  border: 1px solid rgba(240,180,41,0.25);
  border-radius: 100px;
  padding: 5px 14px;
  margin-bottom: 28px;
  animation: fadeUp 0.6s ease both;
}

.badge-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #F0B429;
  animation: pulse-gold 2s ease-in-out infinite;
}

@keyframes pulse-gold {
  0%,100% { opacity:1; transform:scale(1); }
  50%      { opacity:0.5; transform:scale(0.7); }
}

.hero-headline {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(36px, 4.8vw, 64px);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: #f0f2fa;
  margin: 0 0 24px;
  animation: fadeUp 0.6s 0.1s ease both;
}

.hero-headline em {
  font-style: normal;
  color: #F0B429;
}

.hero-sub {
  font-size: 16px;
  color: #6b7280;
  line-height: 1.7;
  max-width: 420px;
  margin-bottom: 36px;
  animation: fadeUp 0.6s 0.2s ease both;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 48px;
  animation: fadeUp 0.6s 0.3s ease both;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 24px;
  background: #F0B429;
  color: #07080c;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  border-radius: 8px;
  text-decoration: none;
  transition: opacity 0.15s, transform 0.15s;
}
.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
.btn-lg { padding: 16px 32px; font-size: 13px; }

.hero-note {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #4a5568;
  letter-spacing: 0.05em;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 0;
  animation: fadeUp 0.6s 0.4s ease both;
}

.hs {
  padding: 0 24px 0 0;
}

.hs-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 700;
  color: #F0B429;
  line-height: 1;
  letter-spacing: -0.02em;
}

.hs-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.16em;
  color: #4a5568;
  margin-top: 4px;
}

.hs-sep {
  width: 1px;
  height: 36px;
  background: rgba(255,255,255,0.07);
  margin-right: 24px;
}

/* ── Demo card ── */
.hero-demo {
  position: relative;
  animation: fadeUp 0.7s 0.25s ease both;
}

.demo-card {
  background: #0e1018;
  border: 1px solid rgba(240,180,41,0.15);
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 40px 80px rgba(0,0,0,0.6),
    0 0 0 1px rgba(240,180,41,0.05),
    inset 0 1px 0 rgba(255,255,255,0.04);
  position: relative;
}

.demo-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(0,0,0,0.3);
}

.demo-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #F0B429;
}

.demo-live {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #22c55e;
}

.demo-live-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse-live 1.8s ease-in-out infinite;
}

@keyframes pulse-live {
  0%,100% { opacity:1; box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
  50%      { opacity:0.7; box-shadow: 0 0 0 4px rgba(34,197,94,0); }
}

.demo-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.demo-stat {
  padding: 12px 14px;
  border-right: 1px solid rgba(255,255,255,0.04);
}
.demo-stat:last-child { border-right: none; }

.demo-stat-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  color: #e2e4ee;
  transition: color 0.4s;
}

.demo-stat-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.12em;
  color: #4a5568;
  margin-top: 3px;
}

.demo-table { padding: 8px 0; }

.demo-thead {
  display: grid;
  grid-template-columns: 2fr 1fr 1.4fr 1fr;
  padding: 5px 14px 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.1em;
  color: #374151;
  font-weight: 600;
}

.demo-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1.4fr 1fr;
  padding: 9px 14px;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  transition: background 0.15s;
}
.demo-row:last-child { border-bottom: none; }
.demo-row:hover { background: rgba(255,255,255,0.02); }

.demo-acct-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: #c9cdd9;
}

.demo-acct-firm {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: #4a5568;
  letter-spacing: 0.08em;
  margin-top: 2px;
}

.demo-bal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #9ca3af;
}

.demo-prog {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #6b7280;
}

.demo-prog-bar {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.07);
  border-radius: 2px;
  overflow: hidden;
}

.demo-prog-fill {
  height: 100%;
  background: #F0B429;
  border-radius: 2px;
  transition: width 0.8s ease;
}

.demo-pl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
  transition: color 0.4s;
}

.pos { color: #22c55e; }
.neg { color: #ef4444; }

/* ── Demo alert ── */
.demo-alert {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(14, 16, 24, 0.95);
  border: 1px solid rgba(240,180,41,0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #e2e4ee;
  backdrop-filter: blur(8px);
}

.demo-alert-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #F0B429;
  flex-shrink: 0;
  animation: pulse-gold 1.5s ease-in-out infinite;
}

.alert-pop-enter-active { transition: opacity 0.25s, transform 0.25s; }
.alert-pop-leave-active { transition: opacity 0.2s, transform 0.2s; }
.alert-pop-enter-from   { opacity: 0; transform: translateY(6px); }
.alert-pop-leave-to     { opacity: 0; transform: translateY(-4px); }

/* ── Floating badges ── */
.demo-float {
  position: absolute;
  background: #0e1018;
  border: 1px solid rgba(240,180,41,0.15);
  border-radius: 8px;
  padding: 10px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  color: #4a5568;
  line-height: 1.5;
  pointer-events: none;
}

.demo-float strong {
  display: block;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0;
  color: #e2e4ee;
  margin-top: 2px;
}

.demo-float-1 {
  top: -18px;
  right: -24px;
  animation: float1 4s ease-in-out infinite;
}

.demo-float-2 {
  bottom: 40px;
  right: -28px;
  animation: float2 4s 1.5s ease-in-out infinite;
}

@keyframes float1 { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-6px)} }
@keyframes float2 { 0%,100%{transform:translateY(0)}  50%{transform:translateY(5px)} }

/* ── Features ── */
.features {
  padding: 120px 32px;
  position: relative;
}

.features-inner {
  max-width: 1200px;
  margin: 0 auto;
}

.section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: #F0B429;
  opacity: 0.7;
  margin-bottom: 48px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  overflow: hidden;
}

.feature-card {
  background: #07080c;
  padding: 36px 32px;
  transition: background 0.2s;
}
.feature-card:hover { background: #0c0e14; }

.feature-icon {
  width: 44px;
  height: 44px;
  border: 1px solid rgba(240,180,41,0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #F0B429;
  margin-bottom: 20px;
  background: rgba(240,180,41,0.05);
}

.feature-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 700;
  color: #e2e4ee;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.lp-beta {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #F0B429;
  background: rgba(240, 180, 41, 0.1);
  border: 1px solid rgba(240, 180, 41, 0.25);
  border-radius: 3px;
  padding: 2px 6px;
  line-height: 1.5;
}

.feature-body {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.7;
  margin: 0;
}

/* ── CTA ── */
.cta-section {
  position: relative;
  padding: 120px 32px;
  text-align: center;
  overflow: hidden;
}

.cta-glow {
  position: absolute;
  bottom: -60px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 300px;
  background: radial-gradient(ellipse, rgba(240,180,41,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.cta-inner {
  position: relative;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.cta-headline {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(28px, 4vw, 46px);
  font-weight: 700;
  color: #f0f2fa;
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin: 8px 0;
}

.cta-sub {
  font-size: 16px;
  color: #6b7280;
  margin-bottom: 8px;
}

/* ── Footer ── */
.l-footer {
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 24px 32px;
}

.l-footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-copy {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #374151;
}

/* ── Animations ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .hero-inner { grid-template-columns: 1fr; gap: 48px; }
  .hero { padding-top: 80px; }
  .demo-float { display: none; }
  .feature-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .hero-headline { font-size: 40px; }
  .l-nav-inner { padding: 0 20px; }
  .demo-stats { grid-template-columns: repeat(2, 1fr); }
  .demo-thead, .demo-row { grid-template-columns: 2fr 1fr; }
  .demo-thead span:nth-child(3),
  .demo-thead span:nth-child(4),
  .demo-row > *:nth-child(3),
  .demo-row > *:nth-child(4) { display: none; }
}
</style>
