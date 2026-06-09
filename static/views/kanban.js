// kanban.js: Phase別カンバン画面。警告バッジ・部署/担当者フィルター付き。
import { AppState } from '/app.js'
import { BALL_OWNER_OPTIONS, DEFAULT_BALL_OWNER, calcCurrentPhase, calcBantScore, isWarning, formatCurrency, getFiscalQuarterKey } from '/constants.js'
import { loadTargets } from '/data.js'

export function renderKanban(root) {
  const user    = AppState.currentUser
  const isAdmin = user.role === 'admin'
  const isSales = user.role === 'sales'

  // salesは自分の案件のみ表示
  let basDeals = isSales
    ? AppState.deals.filter(d => d.assignee_id === user.id)
    : AppState.deals

  const activeDepts = AppState.depts.filter(d => d.isActive)
  const activeUsers = AppState.users.filter(u => u.isActive)

  root.innerHTML = `
    <div class="page-header">
      <h2>カンバン</h2>
      ${!isSales ? `
        <div class="filter-bar">
          <select id="filter-dept" class="filter-select">
            <option value="">全部署</option>
            ${activeDepts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
          </select>
          <select id="filter-user" class="filter-select">
            <option value="">全担当者</option>
            ${activeUsers.filter(u => u.role === 'sales' || u.role === 'manager').map(u =>
              `<option value="${u.id}">${u.name}</option>`
            ).join('')}
          </select>
        </div>
      ` : ''}
      <a href="#deal" class="btn btn-primary">+ 案件を登録する</a>
    </div>
    <div id="kanban-board" class="kanban-board"></div>
  `

  function applyFilter() {
    const deptId = document.getElementById('filter-dept')?.value ?? ''
    const userId = isSales
      ? user.id
      : (document.getElementById('filter-user')?.value ?? '')
    let filtered = basDeals.filter(d => !d.isLost)

    if (deptId) filtered = filtered.filter(d => d.dept_id === deptId)
    if (!isSales && userId) filtered = filtered.filter(d => d.assignee_id === userId)

    renderBoard(filtered, { deptId, userId })
  }

  if (!isSales) {
    document.getElementById('filter-dept').addEventListener('change', applyFilter)
    document.getElementById('filter-user').addEventListener('change', applyFilter)
  }

  applyFilter()
}

function renderBoard(deals, { deptId = '', userId = '' } = {}) {
  const board = document.getElementById('kanban-board')
  if (!board) return

  // 今期の目標合計（受注済みカラム用）
  const qk      = getFiscalQuarterKey(new Date(), AppState.settings.fiscalStartMonth)
  const targets  = loadTargets()
  let quarterTarget = 0
  if (userId) {
    quarterTarget = targets.rep[userId]?.[qk] ?? 0
  } else if (deptId) {
    quarterTarget = targets.dept[deptId]?.[qk] ?? 0
  } else {
    // 全担当者合計
    quarterTarget = Object.values(targets.rep).reduce((s, qmap) => s + (qmap[qk] ?? 0), 0)
  }

  // カラム定義：Phase 1〜4 + 受注済み
  const wonDeals = deals.filter(d => d.isWon)
  const columns = [
    ...AppState.phaseItems.map(p => ({
      id:     `phase_${p.id}`,
      label:  p.label,
      deals:  deals.filter(d => !d.isWon && calcCurrentPhase(d) === p.id),
      isWon:  false,
    })),
    {
      id:    'won',
      label: '受注済み',
      deals: wonDeals,
      isWon: true,
    },
  ]

  board.innerHTML = columns.map(col => {
    const amtSum = col.deals.reduce((s, d) => s + (d.amount ?? 0), 0)
    const wonHeader = col.isWon && quarterTarget > 0
      ? (() => {
          const pct = Math.round((amtSum / quarterTarget) * 100)
          const cls = pct >= 100 ? 'won-pct--achieved' : pct >= 70 ? 'won-pct--close' : 'won-pct--low'
          return `<div class="col-target-row">
            <span class="col-target-label">目標 ${formatCurrency(quarterTarget)}</span>
            <span class="won-pct ${cls}">${pct}%</span>
          </div>`
        })()
      : ''

    return `
    <div class="kanban-column">
      <div class="kanban-col-header">
        <div class="col-header-top">
          <span class="col-title">${col.label}</span>
          <span class="col-count">${col.deals.length}件</span>
        </div>
        <div class="col-amount-sum">${formatCurrency(amtSum)}</div>
        ${wonHeader}
      </div>
      <div class="kanban-cards">
        ${col.deals.length === 0
          ? '<p class="empty-col">案件なし</p>'
          : col.deals.map(d => renderCard(d)).join('')
        }
      </div>
    </div>
  `}).join('')
}

function renderCard(deal) {
  const score    = calcBantScore(deal)
  const warning  = isWarning(deal)
  const barPct   = Math.round((score / 8) * 100)
  const barColor = score >= 6 ? '#22c55e' : score >= 4 ? '#f59e0b' : '#ef4444'

  const ownerKey = deal.ballOwner ?? DEFAULT_BALL_OWNER
  const owner    = BALL_OWNER_OPTIONS.find(o => o.key === ownerKey)
  const ballBadge = owner
    ? `<span class="ball-badge ball-badge--${ownerKey}" title="${owner.label}${deal.ballDetail ? '：' + deal.ballDetail : ''}">${owner.icon} ${owner.label}</span>`
    : ''

  return `
    <div class="kanban-card ${warning ? 'card-warning' : ''}" data-id="${deal.id}">
      ${warning ? '<div class="warning-badge">⚠ BANT不足</div>' : ''}
      <div class="card-name">${deal.name}</div>
      <div class="card-meta">
        <span>${deal.assignee_name}</span>
        <span class="card-amount">${formatCurrency(deal.amount)}</span>
      </div>
      ${ballBadge}
      ${deal.ballDetail ? `<div class="ball-detail-text">${deal.ballDetail}</div>` : ''}
      <div class="bant-bar-wrapper" title="BANTスコア: ${score}/8">
        <div class="bant-bar-bg">
          <div class="bant-bar-fill" style="width:${barPct}%; background:${barColor}"></div>
        </div>
        <span class="bant-bar-label">BANT ${score}/8</span>
      </div>
      <a href="#deal?id=${deal.id}" class="card-edit-link">編集 →</a>
    </div>
  `
}
