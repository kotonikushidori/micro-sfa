// my.js: sales 専用マイページ。「自分の案件で今何をすべきか」を一覧表示する。
// Phase × BANT の状態からネクストアクションを自動生成するのがこの画面の核心。
import { AppState } from '/app.js'
import { loadActivities, loadTargets } from '/data.js'
import { BALL_OWNER_OPTIONS, DEFAULT_BALL_OWNER, calcCurrentPhase, calcBantScore, calcExpectedValue, calcYomi, isWarning, formatCurrency, calcRepCoachingData, calcTeamVelocityAvg, LOSS_PHASE_INSIGHTS, BANT_WEAKNESS_INSIGHTS, calcPushCount, getFiscalQuarterKey, getFiscalQuarterRange } from '/constants.js'

// Phase ごとの「次に進むための条件」テキスト
const NEXT_PHASE_ACTION = [
  '議事録を共有し、課題合意を取り付けてください（Phase 1 達成条件）',
  '見積書を送付し、受領確認を得てください（Phase 2 達成条件）',
  '決裁権者が出席する会議の日時を確定してください（Phase 3 達成条件）',
  '発注意思を受領し、契約書のリーガルチェックを開始してください（Phase 4 達成条件）',
  '受注処理を行ってください',
]

// BANT 項目ごとの「スコアが低い場合のアクション」
const BANT_ACTION = {
  B: '予算枠・金額ラインを確認してください（Budget 不足）',
  A: '決裁権者を特定または同席させてください（Authority 不足）',
  N: '明確なペイン・課題をヒアリングしてください（Needs 不足）',
  T: '導入時期・デッドラインを確認してください（Timeframe 不足）',
}

const ACTION_LIMIT = 4

// 案件の優先度スコア（高いほど先にアクションが必要）
function urgencyScore(deal) {
  const daysLeft = Math.ceil((new Date(deal.closeDate) - new Date()) / 86400000)
  const phase    = calcCurrentPhase(deal)
  const bant     = calcBantScore(deal)
  // 期日が近い・Phase が高い・BANT が低い案件を優先
  return (phase * 10) + (8 - bant) * 3 + Math.max(0, 90 - daysLeft)
}

// 案件に対してネクストアクションリストを生成する純粋関数
function generateActions(deal) {
  const actions = []
  const phase   = calcCurrentPhase(deal)
  const bant    = deal.bant

  if (deal.isWon || deal.isLost) return []

  // BANT の弱点を先に表示（主観を持ち込まないための情報収集指示）
  AppState.bantItems.forEach(item => {
    if (bant[item.key] === 0) actions.push({ type: 'bant', text: BANT_ACTION[item.key] })
  })

  // Phase 進捗アクション
  if (phase < 4) {
    actions.push({ type: 'phase', text: NEXT_PHASE_ACTION[phase] })
  } else {
    actions.push({ type: 'phase', text: NEXT_PHASE_ACTION[4] })
  }

  return actions
}

export function renderMy(root) {
  const user  = AppState.currentUser
  const deals = AppState.deals.filter(d => d.assignee_id === user.id)
  const active = deals.filter(d => !d.isWon && !d.isLost)
  const won        = deals.filter(d => d.isWon)
  const lost       = deals.filter(d => d.isLost)
  const activities = loadActivities()

  const totalExpected = active.reduce((s, d) => s + calcExpectedValue(d), 0)
  const warnings      = active.filter(isWarning)

  // 四半期目標
  const fsm        = AppState.settings.fiscalStartMonth
  const currentQk  = getFiscalQuarterKey(new Date(), fsm)
  const targets     = loadTargets()
  const repTarget   = targets.rep[user.id]?.[currentQk] ?? 0
  const { start: qStart, end: qEnd } = getFiscalQuarterRange(currentQk, fsm)
  const qWonAmt = won
    .filter(d => d.updatedAt && new Date(d.updatedAt) >= qStart && new Date(d.updatedAt) < qEnd)
    .reduce((s, d) => s + d.amount, 0)
  const qAchievePct = repTarget > 0 ? Math.round((qWonAmt / repTarget) * 100) : null

  // 期日まで30日以内の案件
  const today     = new Date()
  const soonDeals = active.filter(d => {
    const days = Math.ceil((new Date(d.closeDate) - today) / 86400000)
    return days >= 0 && days <= 30
  })

  // アクション優先順でソート
  const sorted = [...active].sort((a, b) => urgencyScore(b) - urgencyScore(a))

  root.innerHTML = `
    <div class="page-header">
      <h2>マイページ</h2>
      <a href="#deal?from=my" class="btn btn-primary">+ 案件を登録する</a>
    </div>

    <!-- サマリーカード -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-label">担当中の案件</div>
        <div class="summary-value">${active.length}<span class="summary-unit">件</span></div>
        <div class="summary-sub">受注済 ${won.length}件</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">パイプライン期待値</div>
        <div class="summary-value summary-value--md">${formatCurrency(totalExpected)}</div>
        <div class="summary-sub">加重合計（ヨミ換算）</div>
      </div>
      <div class="summary-card ${warnings.length > 0 ? 'summary-card--warn' : ''}">
        <div class="summary-label">要注意案件</div>
        <div class="summary-value">${warnings.length}<span class="summary-unit">件</span></div>
        <div class="summary-sub">Phase≧3 かつ BANT≦3</div>
      </div>
      <div class="summary-card ${soonDeals.length > 0 ? 'summary-card--warn' : ''}">
        <div class="summary-label">期日30日以内</div>
        <div class="summary-value">${soonDeals.length}<span class="summary-unit">件</span></div>
        <div class="summary-sub">想定受注日ベース</div>
      </div>
      ${repTarget > 0 ? `
        <div class="summary-card ${qAchievePct >= 100 ? 'summary-card--success' : ''}">
          <div class="summary-label">今四半期目標</div>
          <div class="summary-value summary-value--md">${qAchievePct}%</div>
          <div class="summary-sub">${formatCurrency(qWonAmt)} / ${formatCurrency(repTarget)}</div>
          <div class="target-bar-bg mt-4">
            <div class="target-bar-won" style="width:${Math.min(qAchievePct, 100)}%"></div>
          </div>
        </div>
      ` : `
        <div class="summary-card summary-card--muted">
          <div class="summary-label">今四半期目標</div>
          <div class="summary-value summary-value--sm">未設定</div>
          <div class="summary-sub">マネージャーが設定します</div>
        </div>
      `}
    </div>

    <div class="my-narrow">
    <!-- 今すぐやること（ボールが自分にある案件） -->
    ${renderActionSection(sorted)}

    <!-- 自分の傾向 -->
    ${renderMyTrend(deals)}

    <!-- 担当案件一覧 -->
    <section class="card">
      <div class="deal-list-header">
        <h3>担当案件一覧</h3>
        <button id="deal-detail-toggle" class="btn-text-toggle">詳細を表示</button>
      </div>
      <div class="deal-tabs">
        <button class="tab-btn active" data-deal-tab="active">アクティブ <span class="tab-count">${active.length}</span></button>
        <button class="tab-btn" data-deal-tab="won">受注済み <span class="tab-count">${won.length}</span></button>
        <button class="tab-btn" data-deal-tab="lost">失注済み <span class="tab-count">${lost.length}</span></button>
        <button class="tab-btn" data-deal-tab="all">すべて <span class="tab-count">${deals.length}</span></button>
      </div>
      <div id="deal-table-wrap">
        ${renderDealRows(active, activities, today, false)}
      </div>
    </section>
    </div>
  `

  // 今すぐやること「他N件表示」
  document.getElementById('action-more-btn')?.addEventListener('click', () => {
    const myTurn = sorted.filter(d => (d.ballOwner ?? DEFAULT_BALL_OWNER) === 'sales')
    document.getElementById('action-more-wrap').innerHTML =
      myTurn.slice(ACTION_LIMIT).map(d => renderActionCard(d)).join('')
    document.getElementById('action-more-btn').remove()
  })

  // 担当案件一覧：詳細トグル
  let detailMode = false
  const toggleBtn = document.getElementById('deal-detail-toggle')
  const getCurrentTabDeals = () => {
    const active = root.querySelector('[data-deal-tab].active')?.dataset.dealTab ?? 'active'
    return active === 'active' ? activeDls : active === 'won' ? wonDls : active === 'lost' ? lostDls : deals
  }
  // active/won/lost/deals をクロージャで参照できるよう名前を変える
  const activeDls = active, wonDls = won, lostDls = lost
  toggleBtn?.addEventListener('click', () => {
    detailMode = !detailMode
    toggleBtn.textContent = detailMode ? '簡易表示' : '詳細を表示'
    document.getElementById('deal-table-wrap').innerHTML =
      renderDealRows(getCurrentTabDeals(), activities, today, detailMode)
  })

  // 担当案件一覧タブ切り替え
  root.querySelectorAll('[data-deal-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-deal-tab]').forEach(b => b.classList.toggle('active', b === btn))
      const tab      = btn.dataset.dealTab
      const filtered = tab === 'active' ? active : tab === 'won' ? won : tab === 'lost' ? lost : deals
      document.getElementById('deal-table-wrap').innerHTML = renderDealRows(filtered, activities, today, detailMode)
    })
  })
}

function renderDealRows(filteredDeals, activities, today, detailed = false) {
  if (filteredDeals.length === 0) return '<p class="empty-state">該当する案件はありません</p>'
  return `
    <table class="data-table">
      <thead><tr>
        <th>案件名</th><th>Phase</th><th>ヨミ</th>
        ${detailed ? '<th>BANT</th><th>金額</th><th>期待値</th>' : ''}
        <th>想定受注日</th>
        ${detailed ? '<th>期ずれ</th>' : ''}
        <th></th>
      </tr></thead>
      <tbody>
        ${filteredDeals.map(d => {
          const yomi      = calcYomi(d)
          const phase     = calcCurrentPhase(d)
          const bant      = calcBantScore(d)
          const days      = Math.ceil((new Date(d.closeDate) - today) / 86400000)
          const closeCls  = days <= 30 && !d.isWon && !d.isLost ? 'text-warn' : ''
          const pushCount = calcPushCount(d.id, activities)
          const status    = d.isWon ? '<span class="badge-won">受注</span>'
                         : d.isLost ? '<span class="badge-lost">失注</span>' : ''
          return `
            <tr ${isWarning(d) ? 'class="row-warning"' : ''}>
              <td>${d.name} ${status}</td>
              <td>${d.isWon || d.isLost ? '-' : `Phase ${phase}`}</td>
              <td><span class="yomi-tag yomi-${yomi.key}">${yomi.label}</span></td>
              ${detailed ? `
              <td>
                <div class="mini-bant-bar">
                  <div class="mini-bant-fill" style="width:${Math.round(bant/8*100)}%;background:${bant>=6?'#22c55e':bant>=4?'#f59e0b':'#ef4444'}"></div>
                </div>
                <span class="bant-num">${bant}/8</span>
              </td>
              <td>${formatCurrency(d.amount)}</td>
              <td>${d.isWon || d.isLost ? '-' : formatCurrency(calcExpectedValue(d))}</td>
              ` : ''}
              <td class="${closeCls}">${d.closeDate}${days >= 0 && days <= 30 && !d.isWon && !d.isLost ? ` <span class="days-left">残${days}日</span>` : ''}</td>
              ${detailed ? `<td>${pushCount > 0 ? `<span class="push-badge push-badge--${pushCount >= 3 ? 'danger' : 'warn'}">${pushCount}回</span>` : '-'}</td>` : ''}
              <td><a href="#deal?id=${d.id}&from=my" class="btn btn-sm">編集</a></td>
            </tr>
          `
        }).join('')}
      </tbody>
    </table>
  `
}

function renderActionSection(deals) {
  const myTurn       = deals.filter(d => (d.ballOwner ?? DEFAULT_BALL_OWNER) === 'sales')
  const internalWait = deals.filter(d => d.ballOwner === 'internal')
  const customerWait = deals.filter(d => d.ballOwner === 'customer')
  const shown        = myTurn.slice(0, ACTION_LIMIT)
  const hiddenCount  = myTurn.length - shown.length

  return `
    <section class="card">
      <h3>今すぐやること <span class="section-count">${myTurn.length}件</span></h3>
      ${myTurn.length === 0
        ? '<p class="empty-state">ボールが自分にある案件はありません</p>'
        : `<div id="action-my-turn">
            ${shown.map(d => renderActionCard(d)).join('')}
          </div>
          ${hiddenCount > 0
            ? `<button id="action-more-btn" class="btn btn-ghost btn-block">▼ 他 ${hiddenCount} 件を表示</button>
               <div id="action-more-wrap"></div>`
            : ''
          }`
      }
    </section>

    ${internalWait.length > 0 ? `
      <section class="card card--waiting">
        <h3>🟡 社内他部署の対応待ち <span class="section-count">${internalWait.length}件</span></h3>
        <p class="section-desc waiting-desc">以下は自分ではなく社内の他チームが動く番です。進捗確認・フォローが必要な場合のみ動いてください。</p>
        ${internalWait.map(d => renderWaitingCard(d)).join('')}
      </section>
    ` : ''}

    ${customerWait.length > 0 ? `
      <section class="card card--waiting">
        <h3>🔵 顧客側の検討待ち <span class="section-count">${customerWait.length}件</span></h3>
        <p class="section-desc waiting-desc">顧客社内で検討・稟議・PoC中です。過度なプッシュは逆効果になる場合があります。</p>
        ${customerWait.map(d => renderWaitingCard(d)).join('')}
      </section>
    ` : ''}
  `
}

function renderMyTrend(myDeals) {
  if (myDeals.length === 0) return ''

  const activities = loadActivities()
  // チーム全体のデータを計算したうえで自分のデータだけ抽出
  const allRepData = calcRepCoachingData(AppState.deals, activities)
  const teamAvg    = calcTeamVelocityAvg(allRepData)
  const me         = allRepData.find(r => r.id === AppState.currentUser.id)
  if (!me) return ''

  const VEL_KEYS   = ['0_1', '1_2', '2_3', '3_4']
  const VEL_LABELS = ['Phase 0→1', 'Phase 1→2', 'Phase 2→3', 'Phase 3→4']

  // 速度比較（自分がチーム平均の1.5倍以上かかっているフェーズ）
  const slowPhases = VEL_KEYS
    .map((k, i) => ({ k, label: VEL_LABELS[i], v: me.avgVelocity[k], a: teamAvg[k], n: me.velCounts[k] }))
    .filter(({ v, a, n }) => v !== null && a !== null && v >= a * 1.5 && n >= 2)

  const lossInsight = me.dominantLossPhase !== null
    ? LOSS_PHASE_INSIGHTS.find(i => i.phase === me.dominantLossPhase) : null

  const bantItems = me.bantWeaknesses.slice(0, 2).map(k => ({ k, text: BANT_WEAKNESS_INSIGHTS[k] }))

  const hasAnyInsight = lossInsight || bantItems.length > 0 || slowPhases.length > 0

  return `
    <details class="card trend-accordion">
      <summary class="trend-summary">
        <h3>自分の傾向</h3>
      </summary>
      <p class="coach-desc" style="margin-top:12px">過去の案件データから自動算出しています。マネージャーも同じデータを参照しています。</p>
      ${!hasAnyInsight
        ? `<p class="my-trend-ok">✓ 目立った傾向パターンはありません</p>`
        : `<div class="diagnostic-insights">
            ${lossInsight ? `<li class="d-insight d-insight--loss">📉 失注傾向: ${lossInsight.action}</li>` : ''}
            ${bantItems.map(({ k, text }) => `<li class="d-insight d-insight--bant">📋 BANT（${k}）: ${text}</li>`).join('')}
            ${slowPhases.map(({ label, v, a }) => `<li class="d-insight d-insight--velocity">⏱ ${label} が平均 ${v}日（チーム平均 ${a}日）— 進行が遅い傾向があります</li>`).join('')}
          </div>`
      }
    </details>
  `
}

function renderWaitingCard(deal) {
  const phase   = calcCurrentPhase(deal)
  const bant    = calcBantScore(deal)
  const yomi    = calcYomi(deal)
  const owner   = BALL_OWNER_OPTIONS.find(o => o.key === (deal.ballOwner ?? DEFAULT_BALL_OWNER))
  const days    = Math.ceil((new Date(deal.closeDate) - new Date()) / 86400000)

  return `
    <div class="action-card action-card--waiting">
      <div class="action-card-header">
        <div class="action-card-title">
          <a href="#deal?id=${deal.id}&from=my" class="action-deal-name">${deal.name}</a>
        </div>
        <div class="action-card-meta">
          <span class="tag-phase">Phase ${phase}</span>
          <span class="yomi-tag yomi-${yomi.key}">${yomi.label}</span>
          <span class="tag-bant">BANT ${bant}/8</span>
          <span class="tag-amount">${formatCurrency(deal.amount)}</span>
          ${days <= 30 ? `<span class="tag-deadline">残${days}日</span>` : ''}
        </div>
      </div>
      ${deal.ballDetail ? `<div class="waiting-detail">${owner?.icon ?? ''} ${deal.ballDetail}</div>` : ''}
    </div>
  `
}

function renderActionCard(deal) {
  const phase   = calcCurrentPhase(deal)
  const bant    = calcBantScore(deal)
  const yomi    = calcYomi(deal)
  const actions = generateActions(deal)
  const days    = Math.ceil((new Date(deal.closeDate) - new Date()) / 86400000)
  const warn    = isWarning(deal)

  return `
    <div class="action-card ${warn ? 'action-card--warn' : ''}">
      <div class="action-card-header">
        <div class="action-card-title">
          ${warn ? '<span class="warn-icon">⚠</span>' : ''}
          <a href="#deal?id=${deal.id}&from=my" class="action-deal-name">${deal.name}</a>
        </div>
        <div class="action-card-meta">
          <span class="tag-phase">Phase ${phase}</span>
          <span class="yomi-tag yomi-${yomi.key}">${yomi.label}</span>
          <span class="tag-bant">BANT ${bant}/8</span>
          <span class="tag-amount">${formatCurrency(deal.amount)}</span>
          ${days <= 30 ? `<span class="tag-deadline">残${days}日</span>` : ''}
        </div>
      </div>
      <ul class="action-list">
        ${actions.map(a => `
          <li class="action-item action-item--${a.type}">
            ${a.type === 'bant' ? '📋' : '→'} ${a.text}
          </li>
        `).join('')}
      </ul>
    </div>
  `
}
