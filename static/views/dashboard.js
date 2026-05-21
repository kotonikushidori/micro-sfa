// dashboard.js: 経営ダッシュボード。受注実績ランキング・月別グラフ・サマリーカード。
// グラフはCanvas APIのみで描画し、外部ライブラリを使わない。
import { AppState } from '/app.js'
import { calcExpectedValue, calcYomi, formatCurrency, getFiscalQuarterKey, getQuarterLabel, getQuarterOptions, getFiscalQuarterRange } from '/constants.js'
import { loadTargets, saveDeptTarget } from '/data.js'

export function renderDashboard(root) {
  const activeDepts = AppState.depts.filter(d => d.isActive)

  root.innerHTML = `
    <div class="page-header">
      <h2>経営ダッシュボード</h2>
      <div class="filter-bar">
        <select id="dash-period" class="filter-select">
          <option value="fy">今期（会計年度）</option>
          <option value="q">今四半期</option>
          <option value="m">今月</option>
        </select>
        <select id="dash-dept" class="filter-select">
          <option value="">全部署</option>
          ${activeDepts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="dashboard-content"></div>
  `

  function update() {
    const period = document.getElementById('dash-period').value
    const deptId = document.getElementById('dash-dept').value
    renderDashboardContent(period, deptId)
  }

  document.getElementById('dash-period').addEventListener('change', update)
  document.getElementById('dash-dept').addEventListener('change', update)
  update()
}

function getPeriodRange(period) {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = now.getMonth() // 0-indexed

  // 会計年度：4月始まり
  if (period === 'fy') {
    const fyStart = m >= 3 ? new Date(y, 3, 1) : new Date(y - 1, 3, 1)
    const fyEnd   = new Date(fyStart.getFullYear() + 1, 3, 1)
    return { start: fyStart, end: fyEnd }
  }
  if (period === 'q') {
    // 現在の四半期（4月始まり基準）
    const fyMonth = (m - 3 + 12) % 12  // 0=4月, 1=5月, ...
    const qIdx    = Math.floor(fyMonth / 3)
    const qStart  = new Date(m >= 3 ? y : y - 1, [3, 6, 9, 0][qIdx], 1)
    if (qIdx === 3) qStart.setFullYear(qStart.getFullYear() + 1)
    const qEnd    = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1)
    return { start: qStart, end: qEnd }
  }
  // 今月
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) }
}

function renderDashboardContent(period, deptId) {
  const content = document.getElementById('dashboard-content')
  const { start, end } = getPeriodRange(period)

  const allDeals = AppState.deals.filter(d => !deptId || d.dept_id === deptId)

  // 受注済み案件（期間フィルター：updatedAt が受注日とみなす）
  const wonDeals = allDeals.filter(d => {
    if (!d.isWon) return false
    const dt = new Date(d.updatedAt)
    return dt >= start && dt < end
  })

  const pipelineDeals = allDeals.filter(d => !d.isWon && !d.isLost)

  const totalWon      = wonDeals.reduce((s, d) => s + d.amount, 0)
  const totalExpected = pipelineDeals.reduce((s, d) => s + calcExpectedValue(d), 0)
  const yomiACount    = pipelineDeals.filter(d => calcYomi(d).key === 'A').length

  // 担当者別受注実績
  const rankMap = {}
  wonDeals.forEach(d => {
    if (!rankMap[d.assignee_id]) rankMap[d.assignee_id] = { name: d.assignee_name, dept: d.dept_name, total: 0, count: 0 }
    rankMap[d.assignee_id].total += d.amount
    rankMap[d.assignee_id].count++
  })
  const ranking = Object.values(rankMap).sort((a, b) => b.total - a.total)

  // 月別データ（直近12ヶ月）
  const months = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    months.push({ year: d.getFullYear(), month: d.getMonth() })
  }

  const monthlyWon = months.map(({ year, month }) =>
    allDeals
      .filter(d => d.isWon && new Date(d.updatedAt).getFullYear() === year && new Date(d.updatedAt).getMonth() === month)
      .reduce((s, d) => s + d.amount, 0)
  )
  const monthlyExpected = months.map(({ year, month }) =>
    allDeals
      .filter(d => !d.isWon && !d.isLost && new Date(d.closeDate).getFullYear() === year && new Date(d.closeDate).getMonth() === month)
      .reduce((s, d) => s + calcExpectedValue(d), 0)
  )

  const monthLabels = months.map(({ year, month }) => `${year}/${String(month + 1).padStart(2, '0')}`)

  content.innerHTML = `
    <!-- サマリーカード -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-label">今期受注合計</div>
        <div class="summary-value">${formatCurrency(totalWon)}</div>
        <div class="summary-sub">${wonDeals.length}件</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">パイプライン期待値</div>
        <div class="summary-value">${formatCurrency(totalExpected)}</div>
        <div class="summary-sub">${pipelineDeals.length}件</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">ヨミA案件数</div>
        <div class="summary-value">${yomiACount}件</div>
        <div class="summary-sub">受注確率 90%</div>
      </div>
    </div>

    <!-- 月別グラフ -->
    <section class="card">
      <h3>月別グラフ（直近12ヶ月）</h3>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background:#3b82f6"></span>確定受注額</span>
        <span class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span>パイプライン期待値</span>
      </div>
      <canvas id="monthly-chart" height="220"></canvas>
    </section>

    <!-- 部署別目標 vs 実績 -->
    ${renderDeptTargetSection(deptId)}

    <!-- 受注実績ランキング -->
    <section class="card">
      <h3>担当者別受注実績ランキング</h3>
      ${ranking.length === 0
        ? '<p class="empty-state">期間内の受注データなし</p>'
        : `
          <div class="ranking-bars" id="ranking-bars"></div>
          <table class="data-table mt-16">
            <thead><tr><th>順位</th><th>担当者</th><th>部署</th><th>件数</th><th>受注合計</th></tr></thead>
            <tbody>
              ${ranking.map((r, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${r.name}</td>
                  <td>${r.dept}</td>
                  <td>${r.count}</td>
                  <td><strong>${formatCurrency(r.total)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
      }
    </section>
  `

  // グラフ描画（Canvas API）
  drawMonthlyChart(monthLabels, monthlyWon, monthlyExpected)

  // 部署目標セクションのイベント
  bindDeptTargetEvents()

  // ランキング棒グラフ
  if (ranking.length > 0) {
    const maxVal = ranking[0].total || 1
    document.getElementById('ranking-bars').innerHTML = ranking.slice(0, 5).map((r, i) => `
      <div class="rank-row">
        <div class="rank-name">${r.name}</div>
        <div class="rank-bar-wrap">
          <div class="rank-bar" style="width:${Math.round((r.total / maxVal) * 100)}%"></div>
        </div>
        <div class="rank-value">${formatCurrency(r.total)}</div>
      </div>
    `).join('')
  }
}

function drawMonthlyChart(labels, wonData, expectedData) {
  const canvas = document.getElementById('monthly-chart')
  if (!canvas) return

  // canvasの幅をコンテナに合わせる
  canvas.width = canvas.parentElement.clientWidth - 32
  const ctx    = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  const padL = 80, padR = 20, padT = 20, padB = 40
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const maxVal = Math.max(...wonData, ...expectedData, 1)
  const barGroupW = chartW / labels.length
  const barW = barGroupW * 0.35

  ctx.clearRect(0, 0, W, H)

  // グリッド線
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke()
    ctx.fillStyle = '#9ca3af'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    const val = maxVal * (1 - i / 4)
    ctx.fillText(formatShort(val), padL - 6, y + 4)
  }

  // 棒グラフ
  labels.forEach((label, i) => {
    const x = padL + barGroupW * i + barGroupW * 0.1
    const wonH    = (wonData[i] / maxVal) * chartH
    const expH    = (expectedData[i] / maxVal) * chartH

    ctx.fillStyle = '#3b82f6'
    ctx.fillRect(x, padT + chartH - wonH, barW, wonH)

    ctx.fillStyle = '#f59e0b'
    ctx.fillRect(x + barW + 2, padT + chartH - expH, barW, expH)

    // ラベル
    ctx.fillStyle = '#6b7280'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(label.slice(5), padL + barGroupW * i + barGroupW / 2, H - 8)
  })
}

function formatShort(val) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `${(val / 1_000).toFixed(0)}K`
  return String(val)
}

// ---------- 部署別目標設定セクション ----------

function renderDeptTargetSection(filterDeptId) {
  const role      = AppState.currentUser.role
  const canEdit   = role === 'executive' || role === 'admin' || role === 'manager'
  const fsm       = AppState.settings.fiscalStartMonth
  const quarters  = getQuarterOptions(fsm)
  const currentQk = getFiscalQuarterKey(new Date(), fsm)
  const targets   = loadTargets()
  const depts     = filterDeptId
    ? AppState.depts.filter(d => d.id === filterDeptId)
    : AppState.depts.filter(d => d.isActive)

  return `
    <section class="card" id="dept-target-section">
      <h3>部署別目標
        <span class="coach-meta">
          <select id="target-quarter" class="filter-select filter-select--sm">
            ${quarters.map(q => `<option value="${q.key}" ${q.key === currentQk ? 'selected' : ''}>${q.label}</option>`).join('')}
          </select>
        </span>
      </h3>
      <p class="coach-desc">部署目標を入力すると達成率・ヨミ込み予測が表示されます。${canEdit ? '目標額を入力して「保存」してください。' : ''}</p>
      <div id="dept-target-rows">
        ${renderDeptTargetRows(depts, currentQk, targets)}
      </div>
    </section>
  `
}

function renderDeptTargetRows(depts, quarterKey, targets) {
  const role    = AppState.currentUser.role
  const canEdit = role === 'executive' || role === 'admin' || role === 'manager'
  const fsm     = AppState.settings.fiscalStartMonth
  const { start, end } = getFiscalQuarterRange(quarterKey, fsm)

  return depts.map(dept => {
    const target  = targets.dept[dept.id]?.[quarterKey] ?? 0
    const wonAmt  = AppState.deals
      .filter(d => d.dept_id === dept.id && d.isWon && d.updatedAt)
      .filter(d => { const dt = new Date(d.updatedAt); return dt >= start && dt < end })
      .reduce((s, d) => s + d.amount, 0)
    const pipelineAmt = AppState.deals
      .filter(d => d.dept_id === dept.id && !d.isWon && !d.isLost)
      .reduce((s, d) => s + (d.amount * ({ A: 0.9, B: 0.5, C: 0.1 }[
        (() => { const sc = Object.values(d.bant).reduce((a,b)=>a+b,0); const ph = d.phases.lastIndexOf(true)+1; return ph>=3&&sc>=6?'A':ph>=2&&sc>=4?'B':'C' })()
      ] ?? 0.1)), 0)
    const achievePct = target > 0 ? Math.round((wonAmt / target) * 100) : null
    const yomiPct    = target > 0 ? Math.round(((wonAmt + pipelineAmt) / target) * 100) : null

    return `
      <div class="target-row">
        <div class="target-dept-name">${dept.name}</div>
        <div class="target-input-wrap">
          ${canEdit
            ? `<input type="number" class="target-amount-input" data-dept="${dept.id}" min="0" step="100000"
                value="${target > 0 ? target : ''}" placeholder="目標額（円）" />`
            : `<span class="target-amount-display">${target > 0 ? formatCurrency(target) : '未設定'}</span>`
          }
        </div>
        ${target > 0 ? `
          <div class="target-progress-wrap">
            <div class="target-progress-labels">
              <span>受注 ${formatCurrency(wonAmt)}</span>
              <span class="target-pct ${achievePct >= 100 ? 'target-pct--achieved' : ''}">${achievePct}%</span>
            </div>
            <div class="target-bar-bg">
              <div class="target-bar-won"   style="width:${Math.min(achievePct, 100)}%"></div>
              <div class="target-bar-yomi"  style="width:${Math.min(Math.max((yomiPct ?? 0) - (achievePct ?? 0), 0), 100 - Math.min(achievePct, 100))}%"></div>
            </div>
            <div class="target-progress-sub">
              <span class="text-muted">ヨミ込 ${formatCurrency(wonAmt + pipelineAmt)}（${yomiPct}%）</span>
              <span class="text-muted">目標 ${formatCurrency(target)}</span>
            </div>
          </div>
        ` : '<div class="target-progress-wrap target-unset">目標未設定</div>'}
      </div>
    `
  }).join('')
}

function bindDeptTargetEvents() {
  const quarterSel = document.getElementById('target-quarter')
  if (!quarterSel) return

  function refreshRows() {
    const qk      = quarterSel.value
    const targets = loadTargets()
    const depts   = AppState.depts.filter(d => d.isActive)
    const rows    = document.getElementById('dept-target-rows')
    if (rows) rows.innerHTML = renderDeptTargetRows(depts, qk, targets)
    bindSaveButtons()
  }

  quarterSel.addEventListener('change', refreshRows)
  bindSaveButtons()
}

function bindSaveButtons() {
  document.querySelectorAll('.target-amount-input').forEach(input => {
    // 既存のリスナーを付け直さないよう clone して置換
    const fresh = input.cloneNode(true)
    input.replaceWith(fresh)
    fresh.addEventListener('change', () => {
      const deptId = fresh.dataset.dept
      const qk     = document.getElementById('target-quarter')?.value
      const amount = Number(fresh.value) || 0
      if (!deptId || !qk) return
      saveDeptTarget(deptId, qk, amount)
      // 保存後に行だけ再描画
      const targets = loadTargets()
      const depts   = AppState.depts.filter(d => d.isActive)
      const rows    = document.getElementById('dept-target-rows')
      if (rows) rows.innerHTML = renderDeptTargetRows(depts, qk, targets)
      bindSaveButtons()
    })
  })
}
