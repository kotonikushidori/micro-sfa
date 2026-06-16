// deal.js: 案件入力・編集画面。Phase チェックボックスと BANT ラジオボタンで構成。
import { AppState, refreshState } from '/app.js'
import { createDeal, updateDeal, appendActivity } from '/data.js'
import { BALL_OWNER_OPTIONS, DEFAULT_BALL_OWNER, LOCK_TRIGGER_DEFS, ACTIVITY_TYPES, calcBantScore, calcCurrentPhase, calcYomi, isLocked, formatCurrency, calcPushCount } from '/constants.js'

export function renderDeal(root, hash) {
  // URLパラメータから編集対象IDを取得（例: #deal?id=deal_01）
  const params  = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '')
  const editId  = params.get('id')
  const fromMy  = params.get('from') === 'my'
  const backDest = fromMy ? '#my' : '#kanban'
  const backLabel = fromMy ? '← マイページに戻る' : '← カンバンに戻る'
  const isEdit  = !!editId

  let deal = null
  if (isEdit) {
    deal = AppState.deals.find(d => d.id === editId)
    if (!deal) { root.innerHTML = '<p class="not-found">案件が見つかりません</p>'; return }

    // salesは自分の案件のみ編集可
    if (AppState.currentUser.role === 'sales' && deal.assignee_id !== AppState.currentUser.id) {
      root.innerHTML = '<p class="not-found">この案件を編集する権限がありません</p>'; return
    }

    // ロック条件を満たす案件は読み取り専用ビューを表示
    if (isLocked(deal, AppState.lockConfig)) {
      renderLockedView(root, deal, backDest, backLabel)
      return
    }
  }

  const activeUsers = AppState.users.filter(u => u.isActive && (u.role === 'sales' || u.role === 'manager'))
  const activeDepts = AppState.depts.filter(d => d.isActive)

  // salesの場合は担当者を自分に固定
  const isSales = AppState.currentUser.role === 'sales'

  const pushCount = isEdit ? calcPushCount(deal.id, AppState.activities) : 0

  root.innerHTML = `
    <div class="page-header">
      <h2>${isEdit ? '案件編集' : '案件新規作成'}</h2>
      <a href="${backDest}" class="btn btn-ghost">${backLabel}</a>
    </div>
    <form id="deal-form" class="deal-form card">
      <section class="form-section">
        <h3>基本情報</h3>
        <div class="form-row">
          <div class="form-group flex-2">
            <label for="deal-name">案件名 <span class="required">*</span></label>
            <input type="text" id="deal-name" value="${deal?.name ?? ''}" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="deal-amount">売上金額（円） <span class="required">*</span></label>
            <input type="number" id="deal-amount" min="0" step="10000" value="${deal?.amount ?? ''}" required />
          </div>
          <div class="form-group">
            <label for="deal-cost-amount">仕入れ金額（円） <span class="optional-label">任意</span></label>
            <input type="number" id="deal-cost-amount" min="0" value="${deal?.costAmount ?? ''}" placeholder="未入力可" />
          </div>
          <div class="form-group">
            <label for="deal-close-date">想定受注日 <span class="required">*</span>${pushCount > 0 ? `<span class="push-badge push-badge--${pushCount >= 3 ? 'danger' : 'warn'}">${pushCount}回期ずれ</span>` : ''}</label>
            <input type="date" id="deal-close-date" value="${deal?.closeDate ?? ''}" required />
          </div>
        </div>
        <div id="deal-profit-display" class="deal-profit-display hidden"></div>
        <div class="form-row">
          <div class="form-group">
            <label for="deal-dept">部署 <span class="required">*</span></label>
            <select id="deal-dept" ${isSales ? 'disabled' : ''}>
              ${activeDepts.map(d => `
                <option value="${d.id}" ${(deal?.dept_id ?? AppState.currentUser.dept_id) === d.id ? 'selected' : ''}>
                  ${d.name}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="deal-assignee">担当者 <span class="required">*</span></label>
            <select id="deal-assignee" ${isSales ? 'disabled' : ''}>
              ${activeUsers.map(u => `
                <option value="${u.id}" ${(deal?.assignee_id ?? AppState.currentUser.id) === u.id ? 'selected' : ''}>
                  ${u.name}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </section>

      <section class="form-section">
        <h3>Phase（事実チェック）</h3>
        <p class="section-desc">完了した事実のみチェックしてください。自己申告的な「進行中」はチェック不可。Phase と下のBANTスコアを組み合わせて、ヨミ区分（A/B/C）が自動で決まります。</p>
        <div class="phase-list" id="phase-list">
          ${AppState.phaseItems.map((p, i) => `
            <label class="phase-item ${(deal?.phases[i] ?? false) ? 'checked' : ''}">
              <input type="checkbox" name="phase" data-index="${i}"
                ${(deal?.phases[i] ?? false) ? 'checked' : ''} />
              <div class="phase-text">
                <span class="phase-label">${p.label}</span>
                <span class="phase-desc">${p.desc}</span>
              </div>
            </label>
          `).join('')}
        </div>
      </section>

      <section class="form-section">
        <h3>BANTスコア（客観指標）</h3>
        <p class="section-desc">主観を排除し、確認できた事実だけを選択してください。スコアが上がるほどヨミ区分が上がり、マネージャーへの報告数値に直結します。</p>
        <div id="bant-score-display" class="bant-score-display">
          BANTスコア: <strong id="bant-score-value">0</strong> / 8　ヨミ区分: <strong id="yomi-label">-</strong>
        </div>
        <div class="bant-list">
          ${AppState.bantItems.map(item => `
            <div class="bant-item">
              <div class="bant-key-label">${item.label}</div>
              <div class="bant-options">
                ${item.options.map((opt, score) => `
                  <label class="bant-option">
                    <input type="radio" name="bant-${item.key}" value="${score}"
                      ${(deal?.bant[item.key] ?? 0) === score ? 'checked' : ''} required />
                    <span class="score-badge">${score}点</span>
                    <span>${opt}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="form-section">
        <h3>ボール位置（誰が動く番か）</h3>
        <p class="section-desc">今この案件のネクストアクションを持っているのは誰かを選んでください。Phase とは独立した軸です。</p>
        <div class="ball-owner-list" id="ball-owner-list">
          ${BALL_OWNER_OPTIONS.map(opt => {
            const current = deal?.ballOwner ?? DEFAULT_BALL_OWNER
            return `
              <label class="ball-owner-item ${current === opt.key ? 'selected' : ''}" data-key="${opt.key}">
                <input type="radio" name="ball-owner" value="${opt.key}" ${current === opt.key ? 'checked' : ''} />
                <span class="ball-owner-icon">${opt.icon}</span>
                <div class="ball-owner-text">
                  <span class="ball-owner-label">${opt.label}</span>
                  <span class="ball-owner-desc">${opt.desc}</span>
                </div>
              </label>
            `
          }).join('')}
        </div>
        <div id="ball-detail-wrap" class="form-group mt-8">
          <label for="ball-detail">詳細（任意）</label>
          <div id="ball-detail-field"></div>
        </div>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${isEdit ? '更新する' : '作成する'}</button>
        <a href="${backDest}" class="btn btn-ghost">キャンセル</a>
        ${isEdit && !deal.isWon && !deal.isLost ? `
          <button type="button" id="btn-won"  class="btn btn-success ml-auto">受注</button>
          <button type="button" id="btn-lost" class="btn btn-danger">失注</button>
        ` : ''}
      </div>
    </form>
  `

  // BANTスコアのリアルタイム表示更新
  function updateScorePreview() {
    const bant = readBant()
    const phases = readPhases()
    const tempDeal = { phases, bant, amount: Number(document.getElementById('deal-amount').value) || 0 }
    const score = calcBantScore(tempDeal)
    const yomi  = calcYomi(tempDeal)
    document.getElementById('bant-score-value').textContent = score
    document.getElementById('yomi-label').textContent = yomi.label
  }

  function readPhases() {
    return AppState.phaseItems.map((_, i) => {
      const cb = document.querySelector(`input[name="phase"][data-index="${i}"]`)
      return cb ? cb.checked : false
    })
  }

  function readBant() {
    const bant = {}
    AppState.bantItems.forEach(item => {
      const radios = document.querySelectorAll(`input[name="bant-${item.key}"]`)
      let val = 0
      radios.forEach(r => { if (r.checked) val = parseInt(r.value) })
      bant[item.key] = val
    })
    return bant
  }

  // チェックボックスのビジュアル更新
  root.querySelectorAll('input[name="phase"]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.phase-item').classList.toggle('checked', cb.checked)
      updateScorePreview()
    })
  })

  root.querySelectorAll('input[name^="bant-"]').forEach(r => {
    r.addEventListener('change', updateScorePreview)
  })

  updateScorePreview()

  function updateProfitDisplay() {
    const amount     = Number(document.getElementById('deal-amount').value) || 0
    const costAmount = Number(document.getElementById('deal-cost-amount').value) || 0
    const display    = document.getElementById('deal-profit-display')
    if (amount > 0 && costAmount > 0) {
      const profit = amount - costAmount
      const margin = Math.round((profit / amount) * 100)
      const sign   = profit >= 0 ? '' : '▲ '
      display.innerHTML = `粗利　<strong>${sign}${formatCurrency(Math.abs(profit))}</strong>　<span class="profit-margin ${profit < 0 ? 'profit-margin--negative' : ''}">${margin}%</span>`
      display.className = `deal-profit-display ${profit < 0 ? 'deal-profit-display--negative' : ''}`
    } else {
      display.className = 'deal-profit-display hidden'
    }
  }

  document.getElementById('deal-amount').addEventListener('input', () => { updateScorePreview(); updateProfitDisplay() })
  document.getElementById('deal-cost-amount').addEventListener('input', updateProfitDisplay)
  updateProfitDisplay()

  // ボール位置の選択切替とプリセット詳細の動的表示
  function updateBallDetail(ownerKey) {
    const opt   = BALL_OWNER_OPTIONS.find(o => o.key === ownerKey)
    const field = document.getElementById('ball-detail-field')
    const wrap  = document.getElementById('ball-detail-wrap')

    root.querySelectorAll('.ball-owner-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.key === ownerKey)
    })

    if (!opt?.details) {
      // sales の場合は詳細不要
      wrap.classList.add('hidden')
      return
    }

    wrap.classList.remove('hidden')
    const current = deal?.ballDetail ?? ''
    field.innerHTML = `
      <select id="ball-detail" class="form-control-select">
        <option value="">（詳細を選択）</option>
        ${opt.details.map(d => `<option value="${d}" ${current === d ? 'selected' : ''}>${d}</option>`).join('')}
        <option value="__custom__" ${current && !opt.details.includes(current) ? 'selected' : ''}>自由入力...</option>
      </select>
      <input type="text" id="ball-detail-custom" placeholder="詳細を入力"
        class="${current && !opt.details.includes(current) ? '' : 'hidden'}"
        value="${current && !opt.details.includes(current) ? current : ''}" />
    `

    document.getElementById('ball-detail').addEventListener('change', (e) => {
      const custom = document.getElementById('ball-detail-custom')
      custom.classList.toggle('hidden', e.target.value !== '__custom__')
    })
  }

  root.querySelectorAll('input[name="ball-owner"]').forEach(r => {
    r.addEventListener('change', () => updateBallDetail(r.value))
  })

  updateBallDetail(deal?.ballOwner ?? DEFAULT_BALL_OWNER)

  function readBallOwner() {
    const r = root.querySelector('input[name="ball-owner"]:checked')
    return r ? r.value : DEFAULT_BALL_OWNER
  }

  function readBallDetail() {
    const sel = document.getElementById('ball-detail')
    if (!sel) return ''
    if (sel.value === '__custom__') return document.getElementById('ball-detail-custom')?.value ?? ''
    return sel.value
  }

  // フォーム送信
  document.getElementById('deal-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const now = new Date().toISOString()

    const assigneeId = isSales ? AppState.currentUser.id : document.getElementById('deal-assignee').value
    const deptId     = isSales ? AppState.currentUser.dept_id : document.getElementById('deal-dept').value

    const assigneeUser = AppState.users.find(u => u.id === assigneeId)
    const deptObj      = AppState.depts.find(d => d.id === deptId)

    const newAmount = Number(document.getElementById('deal-amount').value)
    const prevHistory = deal?.amountHistory ?? []
    let amountHistory
    if (!isEdit) {
      amountHistory = [{ amount: newAmount, changedAt: now }]
    } else if (newAmount !== deal.amount) {
      const base = prevHistory.length > 0
        ? prevHistory
        : [{ amount: deal.amount, changedAt: deal.createdAt }]
      amountHistory = [...base, { amount: newAmount, changedAt: now }]
    } else {
      amountHistory = prevHistory
    }

    const payload = {
      id:            isEdit ? deal.id : `deal_${crypto.randomUUID().slice(0, 8)}`,
      name:          document.getElementById('deal-name').value.trim(),
      amount:        newAmount,
      costAmount:    Number(document.getElementById('deal-cost-amount').value) || undefined,
      closeDate:     document.getElementById('deal-close-date').value,
      assignee_id:   assigneeId,
      dept_id:       deptId,
      assignee_name: assigneeUser?.name ?? deal?.assignee_name ?? '',
      dept_name:     deptObj?.name ?? deal?.dept_name ?? '',
      phases:        readPhases(),
      bant:          readBant(),
      ballOwner:     readBallOwner(),
      ballDetail:    readBallDetail(),
      amountHistory,
      createdAt:     isEdit ? deal.createdAt : now,
      updatedAt:     now,
      isWon:         deal?.isWon ?? false,
      isLost:        deal?.isLost ?? false,
    }

    if (isEdit) {
      await autoLog(deal, payload)
      await updateDeal(payload)
    } else {
      await createDeal(payload)
    }

    window._navigate(backDest)
  })

  // 受注・失注ボタン
  const btnWon  = document.getElementById('btn-won')
  const btnLost = document.getElementById('btn-lost')
  if (btnWon) {
    btnWon.addEventListener('click', async () => {
      if (!confirm('この案件を受注済みにしますか？')) return
      await updateDeal({ ...deal, isWon: true, updatedAt: new Date().toISOString() })
      window._navigate(backDest)
    })
  }
  if (btnLost) {
    btnLost.addEventListener('click', async () => {
      if (!confirm('この案件を失注済みにしますか？')) return
      await updateDeal({ ...deal, isLost: true, updatedAt: new Date().toISOString() })
      window._navigate(backDest)
    })
  }

  // 編集中の案件にも活動ログ入力を表示する
  if (isEdit) {
    const actSection = document.createElement('div')
    actSection.className = 'card mt-20'
    root.appendChild(actSection)
    renderActivitySection(actSection, deal.id)
  }
}

// ---------- 自動ログ ----------

// 保存前後のdiffを検出し、変化があった場合のみ活動ログを生成する。
// 「いつPhaseが上がったか」「BANTがいつ改善されたか」を事後に追跡できるのがこの機能の価値。
async function autoLog(oldDeal, newDeal) {
  const now    = new Date().toISOString()
  const author = AppState.currentUser
  const base   = { deal_id: oldDeal.id, author_id: author.id, author_name: author.name, date: now.slice(0, 10), createdAt: now }

  const oldPhase = oldDeal.phases.lastIndexOf(true) + 1
  const newPhase = newDeal.phases.lastIndexOf(true) + 1
  if (oldPhase !== newPhase) {
    const dir = newPhase > oldPhase ? '▲' : '▼'
    await appendActivity({
      ...base,
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      type: 'phase_change',
      content: `${dir} Phase ${oldPhase} → Phase ${newPhase}`,
    })
  }

  if (oldDeal.closeDate && newDeal.closeDate && newDeal.closeDate > oldDeal.closeDate) {
    await appendActivity({
      ...base,
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      type: 'close_date_change',
      content: `📅 想定受注日 ${oldDeal.closeDate} → ${newDeal.closeDate}`,
    })
  }

  const oldScore = Object.values(oldDeal.bant).reduce((a, b) => a + b, 0)
  const newScore = Object.values(newDeal.bant).reduce((a, b) => a + b, 0)
  if (oldScore !== newScore) {
    const diffs = AppState.bantItems
      .filter(item => oldDeal.bant[item.key] !== newDeal.bant[item.key])
      .map(item => `${item.key}: ${oldDeal.bant[item.key]}→${newDeal.bant[item.key]}`)
      .join(', ')
    const dir = newScore > oldScore ? '▲' : '▼'
    await appendActivity({
      ...base,
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      type: 'bant_change',
      content: `${dir} BANTスコア ${oldScore} → ${newScore}点（${diffs}）`,
    })
  }
}

// ---------- 手動活動ログ入力セクション ----------

// 活動ログ入力フォームを root 内の #activity-section に描画する。
// 編集フォームとロック済みビューの両方から呼ばれる。
export function renderActivitySection(container, dealId) {
  const activities = AppState.activities
    .filter(a => a.deal_id === dealId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const manualTypes = ACTIVITY_TYPES.filter(t => t.manual)
  const today = new Date().toISOString().slice(0, 10)
  const deal  = AppState.deals.find(d => d.id === dealId)

  const hasSpeechAPI = ('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window)

  container.innerHTML = `
    <div class="activity-section">
      <h3>活動ログ</h3>

      <form id="activity-form" class="activity-form" novalidate>
        <div class="activity-form-row">
          <select id="act-type" class="activity-type-select">
            ${manualTypes.map(t => `<option value="${t.key}">${t.icon} ${t.label}</option>`).join('')}
          </select>
          <input type="date" id="act-date" value="${today}" class="activity-date-input" />
        </div>
        <div id="act-visit-fields" class="activity-visit-fields hidden">
          <div class="activity-form-row">
            <div class="form-group-inline">
              <label for="act-cost">交通費（円）</label>
              <input type="number" id="act-cost" min="0" step="any" placeholder="0" class="activity-number-input" />
            </div>
            <div class="form-group-inline">
              <label for="act-duration">所要時間（分）</label>
              <input type="number" id="act-duration" min="0" step="any" placeholder="0" class="activity-number-input" />
            </div>
          </div>
        </div>

        ${hasSpeechAPI ? `
        <div class="voice-input-row">
          <button type="button" id="act-voice-btn" class="btn-voice">🎤 音声入力</button>
          <span id="act-voice-status" class="voice-status"></span>
        </div>
        ` : ''}

        <textarea id="act-content" class="activity-textarea" placeholder="内容を入力（訪問先、話した内容、次のアクションなど）" rows="3"></textarea>

        <div id="act-ai-bar" class="act-ai-bar hidden">
          <button type="button" id="act-ai-btn" class="btn btn-ghost btn-sm">✨ AI で整理</button>
          <span class="act-ai-hint">商談内容・アクション・宿題を自動分類します</span>
        </div>

        <div id="act-ai-alert" class="act-ai-alert hidden">
          ⚠️ 次のアクションや宿題が見当たりませんでした。内容を確認・追記してから記録してください。
        </div>

        <button type="submit" id="act-submit" class="btn btn-primary btn-act-submit" disabled>記録する</button>
      </form>

      <div id="activity-list" class="activity-list">
        ${renderActivityList(activities)}
      </div>
    </div>
  `

  const actType    = document.getElementById('act-type')
  const visitFields = document.getElementById('act-visit-fields')
  function toggleVisitFields() {
    visitFields.classList.toggle('hidden', actType.value !== 'visit')
  }
  actType.addEventListener('change', toggleVisitFields)
  toggleVisitFields()

  const actContent = document.getElementById('act-content')
  const actSubmit  = document.getElementById('act-submit')
  const aiBar      = document.getElementById('act-ai-bar')
  const aiAlert    = document.getElementById('act-ai-alert')

  // AI で抽出したコスト・時間をクロージャで保持（フォーム経由より確実）
  let aiCost     = null
  let aiDuration = null

  actContent.addEventListener('input', () => {
    const hasText = actContent.value.trim() !== ''
    actSubmit.disabled = !hasText
    if (aiBar) aiBar.classList.toggle('hidden', !hasText)
  })

  // 音声入力
  if (hasSpeechAPI) {
    setupVoiceInput(deal?.name ?? '', actContent, actSubmit, aiBar, aiAlert)
  }

  // AI 整理ボタン
  document.getElementById('act-ai-btn')?.addEventListener('click', async () => {
    const text = actContent.value.trim()
    if (!text) return
    const aiBtn = document.getElementById('act-ai-btn')
    const voiceStatus = document.getElementById('act-voice-status')
    aiBtn.disabled = true
    aiBtn.textContent = '整理中...'
    aiAlert.classList.add('hidden')

    try {
      const resp = await fetch('/api/ai/structure-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, deal_name: deal?.name ?? '' }),
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error ?? 'AI整理に失敗しました')
      }
      const data = await resp.json()

      const lines = []
      if (data.summary) lines.push(data.summary)
      if (data.nextActions?.length) {
        lines.push('\n▶ 次のアクション')
        data.nextActions.forEach(a => lines.push(`• ${a}`))
      }
      if (data.myTasks?.length) {
        lines.push('\n▶ 自分の宿題')
        data.myTasks.forEach(t => lines.push(`• ${t}`))
      }
      if (data.customerTasks?.length) {
        lines.push('\n▶ 顧客の宿題')
        data.customerTasks.forEach(t => lines.push(`• ${t}`))
      }

      actContent.value = lines.join('\n')
      actSubmit.disabled = false

      // 交通費・所要時間をクロージャ変数に保存し、フォームにも反映
      aiCost     = data.cost     ?? null
      aiDuration = data.duration ?? null

      if (aiCost != null || aiDuration != null) {
        actType.value = 'visit'
        toggleVisitFields()
        if (aiCost != null)     document.getElementById('act-cost').value     = aiCost
        if (aiDuration != null) document.getElementById('act-duration').value = aiDuration
      } else {
        actType.value = 'voice_memo'
        toggleVisitFields()
      }

      const hasActions =
        (data.nextActions?.length ?? 0) +
        (data.myTasks?.length ?? 0) +
        (data.customerTasks?.length ?? 0) > 0
      if (!hasActions) aiAlert.classList.remove('hidden')

      if (voiceStatus) {
        const extras = [
          data.cost     != null ? `交通費 ${data.cost.toLocaleString()}円` : '',
          data.duration != null ? `所要時間 ${data.duration}分` : '',
        ].filter(Boolean)
        voiceStatus.textContent = 'AI整理が完了しました。' +
          (extras.length ? `${extras.join('・')}を自動設定しました。` : '') +
          '内容を確認・編集してから記録してください。'
        voiceStatus.className = 'voice-status voice-status--done'
      }
    } catch (err) {
      const voiceStatus = document.getElementById('act-voice-status')
      if (voiceStatus) {
        voiceStatus.textContent = `エラー: ${err.message}`
        voiceStatus.className = 'voice-status voice-status--error'
      }
    } finally {
      aiBtn.disabled = false
      aiBtn.textContent = '✨ AI で整理'
    }
  })

  document.getElementById('activity-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const type    = document.getElementById('act-type').value
    const date    = document.getElementById('act-date').value
    const content = actContent.value.trim()
    if (!content) return

    const costVal     = document.getElementById('act-cost').value
    const durationVal = document.getElementById('act-duration').value

    const author = AppState.currentUser
    const record = {
      id:          `act_${crypto.randomUUID().slice(0, 8)}`,
      deal_id:     dealId,
      type,
      date,
      content,
      author_id:   author.id,
      author_name: author.name,
      createdAt:   new Date().toISOString(),
    }
    // フォーム入力を優先、なければ AI 抽出値を使用
    if (type === 'visit') {
      const cost = costVal ? Number(costVal) : aiCost
      const dur  = durationVal ? Number(durationVal) : aiDuration
      if (cost != null) record.cost     = cost
      if (dur  != null) record.duration = dur
    } else if (aiCost != null || aiDuration != null) {
      // voice_memo でも AI が抽出していれば保存
      if (aiCost     != null) record.cost     = aiCost
      if (aiDuration != null) record.duration = aiDuration
    }
    aiCost = null
    aiDuration = null
    await appendActivity(record)

    AppState.activities.unshift(record)
    actContent.value = ''
    actSubmit.disabled = true
    if (aiBar)   aiBar.classList.add('hidden')
    if (aiAlert) aiAlert.classList.add('hidden')
    const voiceStatus = document.getElementById('act-voice-status')
    if (voiceStatus) voiceStatus.textContent = ''
    document.getElementById('activity-list').innerHTML =
      renderActivityList(AppState.activities.filter(a => a.deal_id === dealId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  })
}

function setupVoiceInput(dealName, actContent, actSubmit, aiBar, aiAlert) {
  const voiceBtn    = document.getElementById('act-voice-btn')
  const voiceStatus = document.getElementById('act-voice-status')
  if (!voiceBtn) return

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  let recognition    = null
  let isRecording    = false
  let finalTranscript = ''

  voiceBtn.addEventListener('click', () => {
    if (isRecording) {
      recognition?.stop()
      return
    }

    finalTranscript = ''
    recognition = new SR()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      isRecording = true
      voiceBtn.textContent = '⏹ 停止'
      voiceBtn.classList.add('btn-voice--recording')
      actContent.disabled = true
      actContent.placeholder = '録音中...'
      voiceStatus.textContent = '録音中… 話し終わったら停止してください'
      voiceStatus.className = 'voice-status voice-status--recording'
      aiAlert.classList.add('hidden')
    }

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
    }

    recognition.onend = () => {
      isRecording = false
      voiceBtn.textContent = '🎤 音声入力'
      voiceBtn.classList.remove('btn-voice--recording')
      actContent.disabled = false
      actContent.placeholder = '内容を入力（訪問先、話した内容、次のアクションなど）'
      actContent.value = finalTranscript
      const hasText = finalTranscript.trim() !== ''
      actSubmit.disabled = !hasText
      if (aiBar) aiBar.classList.toggle('hidden', !hasText)
      if (hasText) {
        voiceStatus.textContent = '録音完了。「AI で整理」を押して構造化できます。'
        voiceStatus.className = 'voice-status voice-status--done'
      } else {
        voiceStatus.textContent = ''
        voiceStatus.className = 'voice-status'
      }
    }

    recognition.onerror = (event) => {
      isRecording = false
      voiceBtn.textContent = '🎤 音声入力'
      voiceBtn.classList.remove('btn-voice--recording')
      actContent.disabled = false
      actContent.placeholder = '内容を入力（訪問先、話した内容、次のアクションなど）'
      voiceStatus.textContent = `録音エラー: ${event.error}`
      voiceStatus.className = 'voice-status voice-status--error'
    }

    recognition.start()
  })
}

function renderActivityList(activities) {
  if (activities.length === 0) {
    return '<p class="activity-empty">まだ活動ログはありません</p>'
  }
  return activities.map(a => {
    const typeDef = ACTIVITY_TYPES.find(t => t.key === a.type)
    const visitMeta = (a.cost || a.duration)
      ? `<span class="activity-visit-meta">${a.cost ? `🚃 ${a.cost.toLocaleString()}円` : ''}${a.cost && a.duration ? '　' : ''}${a.duration ? `⏱ ${a.duration}分` : ''}</span>`
      : ''
    return `
      <div class="activity-item activity-item--${a.type}">
        <div class="activity-item-header">
          <span class="activity-icon">${typeDef?.icon ?? '📌'}</span>
          <span class="activity-type-label">${typeDef?.label ?? a.type}</span>
          <span class="activity-date">${a.date}</span>
          <span class="activity-author">${a.author_name}</span>
          ${visitMeta}
        </div>
        <div class="activity-content">${a.content}</div>
      </div>
    `
  }).join('')
}

// ---------- ロック済み案件の読み取り専用ビュー ----------

// ロック済み案件の読み取り専用ビュー。フォームを一切描画しない。
function renderLockedView(root, deal, backDest = '#kanban', backLabel = '← カンバンに戻る') {
  const phase  = calcCurrentPhase(deal)
  const bant   = calcBantScore(deal)
  const yomi   = calcYomi(deal)
  const owner  = BALL_OWNER_OPTIONS.find(o => o.key === (deal.ballOwner ?? DEFAULT_BALL_OWNER))

  // どのロック条件が該当したか
  const hitTriggers = LOCK_TRIGGER_DEFS
    .filter(t => t.check(deal, AppState.lockConfig))
    .map(t => t.label)

  root.innerHTML = `
    <div class="page-header">
      <h2>案件詳細（参照のみ）</h2>
      <a href="${backDest}" class="btn btn-ghost">${backLabel}</a>
    </div>

    <div class="lock-banner">
      🔒 この案件は編集できません
      <span class="lock-reason">（${hitTriggers.join('・')}）</span>
    </div>

    <div class="card locked-view">
      <div class="locked-grid">
        <div class="locked-field"><span class="locked-label">案件名</span><span class="locked-value">${deal.name}</span></div>
        <div class="locked-field"><span class="locked-label">売上金額</span><span class="locked-value">${formatCurrency(deal.amount)}</span></div>
        ${deal.costAmount ? `<div class="locked-field"><span class="locked-label">仕入れ金額</span><span class="locked-value">${formatCurrency(deal.costAmount)}</span></div>
        <div class="locked-field"><span class="locked-label">粗利</span><span class="locked-value">${formatCurrency(deal.amount - deal.costAmount)} <span class="profit-margin ${(deal.amount - deal.costAmount) < 0 ? 'profit-margin--negative' : ''}">${Math.round((deal.amount - deal.costAmount) / deal.amount * 100)}%</span></span></div>` : ''}
        <div class="locked-field"><span class="locked-label">想定受注日</span><span class="locked-value">${deal.closeDate}</span></div>
        <div class="locked-field"><span class="locked-label">担当者</span><span class="locked-value">${deal.assignee_name}</span></div>
        <div class="locked-field"><span class="locked-label">部署</span><span class="locked-value">${deal.dept_name}</span></div>
        <div class="locked-field"><span class="locked-label">ステータス</span><span class="locked-value">${deal.isWon ? '受注済み' : deal.isLost ? '失注済み' : 'アクティブ'}</span></div>
      </div>

      <hr class="locked-divider" />

      <h3>Phase 進捗</h3>
      <div class="locked-phases">
        ${AppState.phaseItems.map((p, i) => `
          <div class="locked-phase ${deal.phases[i] ? 'done' : ''}">
            <span class="phase-check">${deal.phases[i] ? '✓' : '○'}</span>
            <div>
              <div class="phase-label">${p.label}</div>
              <div class="phase-desc">${p.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <hr class="locked-divider" />

      <h3>BANTスコア <span class="locked-bant-score">${bant} / 8 点　${yomi.label}</span></h3>
      <div class="locked-bant">
        ${AppState.bantItems.map(item => `
          <div class="locked-bant-row">
            <span class="locked-bant-key">${item.label}</span>
            <span class="locked-bant-val">${deal.bant[item.key]}点：${item.options[deal.bant[item.key]]}</span>
          </div>
        `).join('')}
      </div>

      <hr class="locked-divider" />

      <h3>ボール位置</h3>
      <div class="locked-field">
        <span class="locked-value">${owner?.icon ?? ''} ${owner?.label ?? '-'}</span>
        ${deal.ballDetail ? `<span class="locked-sub">${deal.ballDetail}</span>` : ''}
      </div>
    </div>
  `

  // ロック済みでも活動ログは記録・参照できる
  const actSection = document.createElement('div')
  actSection.className = 'card mt-20'
  root.appendChild(actSection)
  renderActivitySection(actSection, deal.id)
}
