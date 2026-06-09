// coach.js: マネージャー向け営業指導ダッシュボード。
// 「目標達成率」ではなく「フェーズ進行速度」と「フェーズ別失注タイミング」で指導ポイントを特定する。
// 診断テキストはシステムが自動生成する。マネージャーは数値に基づいて話を始めるだけでよい。
import { AppState } from '/app.js'
import { loadActivities, loadTargets, saveRepTarget } from '/data.js'
import {
  LOSS_PHASE_INSIGHTS, BANT_WEAKNESS_INSIGHTS,
  calcCurrentPhase, calcDaysSinceLastPhaseChange,
  calcRepCoachingData, calcTeamVelocityAvg,
  calcPushCount, formatCurrency,
  getFiscalQuarterKey, getQuarterOptions, getQuarterLabel, getFiscalQuarterRange,
} from '/constants.js'

const VEL_KEYS   = ['0_1', '1_2', '2_3', '3_4']
const VEL_LABELS = ['Phase 0→1', 'Phase 1→2', 'Phase 2→3', 'Phase 3→4']
const STAGNANT_DAYS = 30

export function renderCoach(root) {
  const activeDepts = AppState.depts.filter(d => d.isActive)

  root.innerHTML = `
    <div class="page-header">
      <h2>営業指導ダッシュボード</h2>
      <select id="coach-dept" class="filter-select">
        <option value="">全部署</option>
        ${activeDepts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
      </select>
    </div>
    <div id="coach-content"></div>
  `

  const render = () => {
    const deptId     = document.getElementById('coach-dept').value
    const activities = loadActivities()
    const deals      = deptId ? AppState.deals.filter(d => d.dept_id === deptId) : AppState.deals
    const repData    = calcRepCoachingData(deals, activities)
    const teamAvg    = calcTeamVelocityAvg(repData)

    // 担当者別・期ずれ集計（3回以上の件数をコーチング指標にする）
    const repPushStats = {}
    deals.forEach(d => {
      if (!repPushStats[d.assignee_id]) repPushStats[d.assignee_id] = { maxPush: 0, highPushCount: 0 }
      const pc = calcPushCount(d.id, activities)
      repPushStats[d.assignee_id].maxPush = Math.max(repPushStats[d.assignee_id].maxPush, pc)
      if (pc >= 3) repPushStats[d.assignee_id].highPushCount++
    })

    const currentQk = getFiscalQuarterKey(new Date(), AppState.settings.fiscalStartMonth)
    document.getElementById('coach-content').innerHTML = `
      ${renderRepTargetSection(deals, deptId, currentQk)}
      ${renderFunnel(deals)}
      ${renderDiscountSection(deals)}
      ${renderVelocityMatrix(repData, teamAvg)}
      ${renderDiagnosticCards(repData, teamAvg, repPushStats)}
      ${renderStagnant(deals, activities)}
    `
    bindRepTargetEvents(deals, deptId)
  }

  document.getElementById('coach-dept').addEventListener('change', render)
  render()
}

// ⓪ 担当者別目標配分

function renderRepTargetSection(deals, deptId, currentQk) {
  const quarters = getQuarterOptions(AppState.settings.fiscalStartMonth)
  const targets  = loadTargets()
  const users    = AppState.users.filter(u => u.isActive && (u.role === 'sales' || u.role === 'manager'))
  const deptReps = deptId ? users.filter(u => u.dept_id === deptId) : users

  const deptTarget = deptId ? (targets.dept[deptId]?.[currentQk] ?? 0) : 0
  const repTotal   = deptReps.reduce((s, u) => s + (targets.rep[u.id]?.[currentQk] ?? 0), 0)
  const unallocated = deptTarget > 0 ? deptTarget - repTotal : null

  return `
    <section class="card coach-section" id="rep-target-section">
      <h3>担当者別目標配分
        <span class="coach-meta">
          <select id="rep-target-quarter" class="filter-select filter-select--sm">
            ${quarters.map(q => `<option value="${q.key}" ${q.key === currentQk ? 'selected' : ''}>${q.label}</option>`).join('')}
          </select>
        </span>
      </h3>
      ${deptId && deptTarget > 0 ? `
        <div class="target-allocation-summary">
          <span>部署目標 <strong>${formatCurrency(deptTarget)}</strong></span>
          <span>個人合計 <strong>${formatCurrency(repTotal)}</strong></span>
          <span class="target-unallocated ${unallocated < 0 ? 'target-unallocated--over' : unallocated > 0 ? 'target-unallocated--under' : ''}">
            ${unallocated === 0 ? '✓ 完全配分' : unallocated > 0 ? `未配分 ${formatCurrency(unallocated)}` : `超過 ${formatCurrency(Math.abs(unallocated))}`}
          </span>
        </div>
      ` : deptId ? '<p class="coach-desc">ダッシュボードで部署目標を設定すると未配分額が表示されます。</p>' : ''}
      <div id="rep-target-rows">
        ${renderRepTargetRows(deptReps, currentQk, targets)}
      </div>
    </section>
  `
}

function renderRepTargetRows(reps, quarterKey, targets) {
  const { start, end } = getFiscalQuarterRange(quarterKey, AppState.settings.fiscalStartMonth)

  return `
    <table class="data-table">
      <thead><tr><th>担当者</th><th>部署</th><th>目標額</th><th>受注実績</th><th>達成率</th></tr></thead>
      <tbody>
        ${reps.map(u => {
          const target  = targets.rep[u.id]?.[quarterKey] ?? 0
          const wonAmt  = AppState.deals
            .filter(d => d.assignee_id === u.id && d.isWon && d.updatedAt)
            .filter(d => { const dt = new Date(d.updatedAt); return dt >= start && dt < end })
            .reduce((s, d) => s + d.amount, 0)
          const pct = target > 0 ? Math.round((wonAmt / target) * 100) : null
          const dept = AppState.depts.find(d => d.id === u.dept_id)
          return `
            <tr>
              <td>${u.name}</td>
              <td class="text-muted">${dept?.name ?? '-'}</td>
              <td>
                <input type="number" class="rep-target-input" data-user="${u.id}"
                  min="0" step="100000" value="${target > 0 ? target : ''}" placeholder="未設定" />
              </td>
              <td>${formatCurrency(wonAmt)}</td>
              <td>${pct !== null
                ? `<span class="target-pct ${pct >= 100 ? 'target-pct--achieved' : ''}">${pct}%</span>`
                : '<span class="text-muted">-</span>'
              }</td>
            </tr>
          `
        }).join('')}
      </tbody>
    </table>
    <p class="coach-desc" style="margin-top:8px">目標額を変更すると自動保存されます。</p>
  `
}

function bindRepTargetEvents(deals, deptId) {
  const quarterSel = document.getElementById('rep-target-quarter')
  if (!quarterSel) return

  function refreshRows(qk) {
    const targets = loadTargets()
    const users   = AppState.users.filter(u => u.isActive && (u.role === 'sales' || u.role === 'manager'))
    const deptReps = deptId ? users.filter(u => u.dept_id === deptId) : users
    const rows = document.getElementById('rep-target-rows')
    if (rows) rows.innerHTML = renderRepTargetRows(deptReps, qk, targets)

    // 未配分表示を更新
    const deptTarget   = deptId ? (targets.dept[deptId]?.[qk] ?? 0) : 0
    const repTotal     = deptReps.reduce((s, u) => s + (targets.rep[u.id]?.[qk] ?? 0), 0)
    const unallocated  = deptTarget > 0 ? deptTarget - repTotal : null
    const summaryEl    = document.querySelector('.target-allocation-summary')
    if (summaryEl && deptTarget > 0) {
      summaryEl.querySelector('strong:last-of-type')?.parentElement
      // 簡易的に innerHTML 更新
      summaryEl.innerHTML = `
        <span>部署目標 <strong>${formatCurrency(deptTarget)}</strong></span>
        <span>個人合計 <strong>${formatCurrency(repTotal)}</strong></span>
        <span class="target-unallocated ${unallocated < 0 ? 'target-unallocated--over' : unallocated > 0 ? 'target-unallocated--under' : ''}">
          ${unallocated === 0 ? '✓ 完全配分' : unallocated > 0 ? `未配分 ${formatCurrency(unallocated)}` : `超過 ${formatCurrency(Math.abs(unallocated))}`}
        </span>
      `
    }
    attachRepInputListeners(qk, deals, deptId)
  }

  quarterSel.addEventListener('change', () => refreshRows(quarterSel.value))
  attachRepInputListeners(quarterSel.value, deals, deptId)
}

function attachRepInputListeners(quarterKey, deals, deptId) {
  document.querySelectorAll('.rep-target-input').forEach(input => {
    const fresh = input.cloneNode(true)
    input.replaceWith(fresh)
    fresh.addEventListener('change', () => {
      const userId = fresh.dataset.user
      const amount = Number(fresh.value) || 0
      saveRepTarget(userId, quarterKey, amount)
      const qk = document.getElementById('rep-target-quarter')?.value ?? quarterKey
      const targets  = loadTargets()
      const users    = AppState.users.filter(u => u.isActive && (u.role === 'sales' || u.role === 'manager'))
      const deptReps = deptId ? users.filter(u => u.dept_id === deptId) : users
      const rows = document.getElementById('rep-target-rows')
      if (rows) rows.innerHTML = renderRepTargetRows(deptReps, qk, targets)
      attachRepInputListeners(qk, deals, deptId)
    })
  })
}

// ① 担当者別値引き状況
function renderDiscountSection(deals) {
  const active = deals.filter(d => !d.isWon && !d.isLost)

  const repMap = {}
  active.forEach(d => {
    if (!repMap[d.assignee_id]) {
      repMap[d.assignee_id] = { name: d.assignee_name, dept: d.dept_name, total: 0, discounted: [] }
    }
    repMap[d.assignee_id].total++
    if (d.amountHistory && d.amountHistory.length > 1) {
      repMap[d.assignee_id].discounted.push(d)
    }
  })

  const reps = Object.values(repMap).filter(r => r.total > 0)
  if (!reps.some(r => r.discounted.length > 0)) return ''

  const avgRate = deals => {
    if (!deals.length) return 0
    const sum = deals.reduce((s, d) => {
      const orig = d.amountHistory[0].amount
      return s + (orig > 0 ? (orig - d.amount) / orig * 100 : 0)
    }, 0)
    return Math.round(sum / deals.length)
  }

  const maxRate = deals => {
    if (!deals.length) return 0
    return Math.max(...deals.map(d => {
      const orig = d.amountHistory[0].amount
      return orig > 0 ? Math.round((orig - d.amount) / orig * 100) : 0
    }))
  }

  const sorted = [...reps].sort((a, b) => avgRate(b.discounted) - avgRate(a.discounted))

  return `
    <section class="card coach-section">
      <h3>担当者別値引き状況</h3>
      <p class="coach-desc">当初登録金額から変更があった案件を集計しています。平均値引き率が高い担当者を優先的にフォローしてください。</p>
      <table class="data-table">
        <thead><tr>
          <th>担当者</th><th>部署</th><th>値引き件数</th><th>平均値引き率</th><th>最大値引き率</th>
        </tr></thead>
        <tbody>
          ${sorted.map(r => {
            const avg  = avgRate(r.discounted)
            const max  = maxRate(r.discounted)
            const warn = avg >= 10
            return `
              <tr ${warn ? 'class="row-warning"' : ''}>
                <td>${r.name}</td>
                <td class="text-muted">${r.dept}</td>
                <td>${r.discounted.length} / ${r.total}</td>
                <td>${r.discounted.length > 0 ? `<strong class="${warn ? 'discount-rate--high' : ''}">${avg}%</strong>` : '-'}</td>
                <td class="text-muted">${r.discounted.length > 0 ? `${max}%` : '-'}</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </section>
  `
}

// ② チームファネル
function renderFunnel(deals) {
  const active = deals.filter(d => !d.isWon && !d.isLost)
  const lost   = deals.filter(d => d.isLost)
  const won    = deals.filter(d => d.isWon)

  const rows = [0, 1, 2, 3, 4].map(p => ({
    phase:       p,
    label:       p === 0 ? '未Phase' : `Phase ${p}`,
    activeCount: active.filter(d => calcCurrentPhase(d) === p).length,
    lostCount:   lost.filter(d => calcCurrentPhase(d) === p).length,
  })).filter(r => r.activeCount + r.lostCount > 0)

  const max = Math.max(...rows.map(r => r.activeCount + r.lostCount), 1)

  return `
    <section class="card coach-section">
      <h3>チームファネル
        <span class="coach-meta">受注 ${won.length}件 &nbsp;|&nbsp; 失注 ${lost.length}件 &nbsp;|&nbsp; アクティブ ${active.length}件</span>
      </h3>
      <p class="coach-desc">失注が多いフェーズ = 組織全体のボトルネック。2件以上の失注があるフェーズに改善ヒントを表示します。</p>
      <div class="funnel-chart">
        ${rows.map(r => {
          const total  = r.activeCount + r.lostCount
          const pct    = Math.round((total / max) * 100)
          const actPct = Math.round((r.activeCount / total) * 100)
          const insight = LOSS_PHASE_INSIGHTS.find(i => i.phase === r.phase)
          return `
            <div class="funnel-row">
              <div class="funnel-label">${r.label}</div>
              <div class="funnel-bar-wrap">
                <div class="funnel-bar" style="width:${pct}%">
                  <div class="funnel-bar-active" style="width:${actPct}%"></div>
                  <div class="funnel-bar-lost"   style="width:${100 - actPct}%"></div>
                </div>
              </div>
              <div class="funnel-counts">
                <span class="funnel-active-num">${r.activeCount}件</span>
                ${r.lostCount > 0 ? `<span class="funnel-lost-num">失注 ${r.lostCount}件</span>` : ''}
              </div>
              ${r.lostCount >= 2 && insight
                ? `<div class="funnel-insight">→ ${insight.action}</div>` : ''}
            </div>
          `
        }).join('')}
      </div>
      <div class="funnel-legend">
        <span><span class="legend-dot" style="background:#3b82f6"></span>アクティブ</span>
        <span><span class="legend-dot" style="background:#ef4444"></span>失注</span>
      </div>
    </section>
  `
}

// ② フェーズ進行速度マトリクス
function renderVelocityMatrix(repData, teamAvg) {
  const activeKeys = VEL_KEYS.filter(k => repData.some(r => r.avgVelocity[k] !== null))

  if (activeKeys.length === 0) return `
    <section class="card coach-section">
      <h3>フェーズ進行速度（平均滞在日数）</h3>
      <p class="empty-state">Phase変更ログがまだありません。デモデータをリセットするとサンプルが表示されます。</p>
    </section>
  `

  return `
    <section class="card coach-section">
      <h3>フェーズ進行速度（平均滞在日数）</h3>
      <p class="coach-desc">チーム平均の 1.5倍以上 かかっている箇所を <span class="vel-slow-label">赤</span> で示します。n = サンプル案件数。</p>
      <div class="table-scroll">
        <table class="data-table velocity-table">
          <thead><tr>
            <th>担当者</th><th>部署</th><th>件数</th>
            ${activeKeys.map(k => `<th>${VEL_LABELS[VEL_KEYS.indexOf(k)]}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${repData.map(rep => `
              <tr>
                <td>${rep.name}</td>
                <td class="text-muted">${rep.dept}</td>
                <td class="text-muted">${rep.activeCount + rep.wonCount + rep.lostCount}件</td>
                ${activeKeys.map(k => {
                  const v = rep.avgVelocity[k]
                  const n = rep.velCounts[k]
                  const a = teamAvg[k]
                  if (v === null) return `<td class="text-muted">-</td>`
                  const slow = a !== null && v >= a * 1.5
                  const fast = a !== null && v <= a * 0.7
                  return `<td class="${slow ? 'velocity-slow' : fast ? 'velocity-fast' : ''}">${v}日 <span class="velocity-n">n=${n}</span></td>`
                }).join('')}
              </tr>
            `).join('')}
            <tr class="team-avg-row">
              <td colspan="3"><strong>チーム平均</strong></td>
              ${activeKeys.map(k => `<td>${teamAvg[k] !== null ? teamAvg[k] + '日' : '-'}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `
}

// ③ 担当者別診断カード
function renderDiagnosticCards(repData, teamAvg, repPushStats) {
  if (repData.length === 0) return ''

  return `
    <section class="card coach-section">
      <h3>担当者別診断</h3>
      <p class="coach-desc">数値パターンから自動生成した改善方針です。担当者自身もマイページで同じデータを確認できます。</p>
      <div class="diagnostic-grid">
        ${repData.map(rep => renderOneCard(rep, teamAvg, repPushStats[rep.id] ?? { maxPush: 0, highPushCount: 0 })).join('')}
      </div>
    </section>
  `
}

function renderOneCard(rep, teamAvg, pushStats) {
  const insights = []

  // 失注パターン
  if (rep.dominantLossPhase !== null) {
    const pi = LOSS_PHASE_INSIGHTS.find(i => i.phase === rep.dominantLossPhase)
    if (pi) insights.push({ icon: '📉', text: pi.action, cls: 'loss' })
  }

  // BANT弱点（最大2件）
  rep.bantWeaknesses.slice(0, 2).forEach(k => {
    const wi = BANT_WEAKNESS_INSIGHTS[k]
    if (wi) insights.push({ icon: '📋', text: wi, cls: 'bant' })
  })

  // 速度の遅いフェーズ（n≥2 のみ）
  VEL_KEYS.forEach((k, idx) => {
    const v = rep.avgVelocity[k]
    const a = teamAvg[k]
    if (v !== null && a !== null && v >= a * 1.5 && rep.velCounts[k] >= 2) {
      insights.push({ icon: '⏱', text: `${VEL_LABELS[idx]} が平均 ${v}日（チーム平均 ${a}日）— 進行が遅い傾向があります`, cls: 'velocity' })
    }
  })

  // 期ずれ繰り返し（3回以上の案件がある場合）
  if (pushStats.highPushCount > 0) {
    insights.push({ icon: '📅', text: `想定受注日を3回以上延期した案件が ${pushStats.highPushCount} 件あります（クロージング精度または初期見極めに課題の可能性）`, cls: 'push' })
  }

  const lossRate = (rep.wonCount + rep.lostCount) > 0
    ? Math.round(rep.lostCount / (rep.wonCount + rep.lostCount) * 100) : null

  return `
    <div class="diagnostic-card">
      <div class="diagnostic-header">
        <span class="diagnostic-name">${rep.name}</span>
        <span class="diagnostic-dept">${rep.dept}</span>
      </div>
      <div class="diagnostic-stats">
        <span>アクティブ <strong>${rep.activeCount}</strong></span>
        <span>受注 <strong>${rep.wonCount}</strong></span>
        <span>失注 <strong>${rep.lostCount}</strong>${lossRate !== null ? `<span class="loss-rate-badge"> ${lossRate}%</span>` : ''}</span>
        ${rep.wonAmount > 0 ? `<span class="won-amount">${formatCurrency(rep.wonAmount)}</span>` : ''}
      </div>

      <div class="diagnostic-bant-row">
        ${['B','A','N','T'].map(k => {
          const avg  = rep.bantAverages[k]
          const weak = rep.bantWeaknesses.includes(k)
          const pct  = Math.round((avg / 2) * 100)
          const color = avg >= 1.5 ? '#22c55e' : avg >= 1 ? '#f59e0b' : '#ef4444'
          return `
            <div class="bant-mini-cell ${weak ? 'bant-mini-cell--weak' : ''}">
              <span class="bant-mini-key">${k}</span>
              <div class="bant-mini-bg"><div class="bant-mini-fill" style="width:${pct}%;background:${color}"></div></div>
              <span class="bant-mini-score">${avg.toFixed(1)}</span>
            </div>
          `
        }).join('')}
      </div>

      ${insights.length > 0
        ? `<ul class="diagnostic-insights">
            ${insights.map(i => `<li class="d-insight d-insight--${i.cls}">${i.icon} ${i.text}</li>`).join('')}
           </ul>`
        : `<p class="diagnostic-ok">✓ 目立った課題パターンはありません</p>`
      }
    </div>
  `
}

// ④ 停滞アラート
function renderStagnant(deals, activities) {
  const active   = deals.filter(d => !d.isWon && !d.isLost)
  const stagnant = active
    .map(d => ({
      deal: d,
      days: calcDaysSinceLastPhaseChange(d.id, activities, d.createdAt),
      pushCount: calcPushCount(d.id, activities),
    }))
    .filter(({ days }) => days >= STAGNANT_DAYS)
    .sort((a, b) => b.days - a.days)

  return `
    <section class="card coach-section">
      <h3>停滞アラート <span class="coach-meta">${STAGNANT_DAYS}日以上 Phase 変化なし</span></h3>
      ${stagnant.length === 0
        ? '<p class="empty-state">停滞案件はありません</p>'
        : `<table class="data-table">
            <thead><tr>
              <th>案件名</th><th>担当者</th><th>現Phase</th><th>BANT</th><th>停滞日数</th><th>期ずれ</th><th></th>
            </tr></thead>
            <tbody>
              ${stagnant.map(({ deal, days, pushCount }) => `
                <tr class="${days >= 60 ? 'row-warning' : ''}">
                  <td>${deal.name}</td>
                  <td>${deal.assignee_name}</td>
                  <td>Phase ${calcCurrentPhase(deal)}</td>
                  <td>${Object.values(deal.bant).reduce((a, b) => a + b, 0)}/8</td>
                  <td><strong class="${days >= 60 ? 'text-danger' : ''}">${days}日</strong></td>
                  <td>${pushCount > 0 ? `<span class="push-badge push-badge--${pushCount >= 3 ? 'danger' : 'warn'}">${pushCount}回</span>` : '-'}</td>
                  <td><a href="#deal?id=${deal.id}" class="btn btn-sm">確認</a></td>
                </tr>
              `).join('')}
            </tbody>
          </table>`
      }
    </section>
  `
}
