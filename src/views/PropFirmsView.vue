<script setup lang="ts">
import { propFirms } from '@/lib/propFirms'
</script>

<template>
  <div class="propfirms-view">
    <h1>Prop Firms</h1>
    <p class="page-desc">Pre-configured rules and targets per phase</p>

    <div class="firms-grid">
      <div
        v-for="(firm, i) in propFirms"
        :key="firm.id"
        class="firm-card"
        :style="{ 'animation-delay': `${i * 40}ms` }"
      >
        <div class="firm-header">
          <h3>{{ firm.name }}</h3>
          <span class="firm-phases-count">{{ firm.phases.length }} phases</span>
        </div>
        <table class="phase-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Target</th>
              <th>Daily DD</th>
              <th>Max DD</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="phase in firm.phases" :key="phase.name">
              <td>
                <span class="phase-name">{{ phase.name }}</span>
              </td>
              <td class="mono" :class="{ 'text-accent': phase.target_pct > 0 }">
                {{ phase.target_pct > 0 ? phase.target_pct + '%' : '---' }}
              </td>
              <td class="mono" :class="{ 'text-red': phase.daily_dd_pct > 0 }">
                {{ phase.daily_dd_pct > 0 ? phase.daily_dd_pct + '%' : '---' }}
              </td>
              <td class="mono text-red">{{ phase.max_dd_pct + '%' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.propfirms-view {
  padding: 24px 28px;
  max-width: 1200px;
  margin: 0 auto;
  animation: fadeInUp 0.35s var(--ease-out);
}

.propfirms-view h1 {
  font-family: var(--font-ui);
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.page-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 4px 0 24px;
}

.firms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.firm-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  animation: fadeInUp 0.35s var(--ease-out) both;
  transition: border-color 0.15s;
}

.firm-card:hover {
  border-color: var(--border);
}

.firm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.firm-header h3 {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.firm-phases-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  letter-spacing: 0.04em;
}

.phase-table {
  width: 100%;
  border-collapse: collapse;
}

.phase-table th {
  text-align: left;
  padding: 8px 14px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  border-bottom: 1px solid var(--border-subtle);
}

.phase-table td {
  padding: 9px 14px;
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
}

.phase-table tr:last-child td {
  border-bottom: none;
}

.phase-name {
  font-weight: 500;
  color: var(--text-primary);
}

.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}

.text-accent { color: var(--accent); }
.text-red { color: var(--red); opacity: 0.7; }

@media (max-width: 640px) {
  .propfirms-view {
    padding: 16px 12px;
  }

  .propfirms-view h1 {
    font-size: 18px;
  }

  .firms-grid {
    grid-template-columns: 1fr;
  }
}
</style>
