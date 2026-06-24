// contact.js: コンタクト詳細・編集画面（基本情報 + フェーズ管理）
import { AppState } from '/app.js'
import { updateContact, triggerContactOCR } from '/data.js'
import { CONTACT_QUICK_LABELS, CONTACT_PHASES, CONTACT_PHASE_CHECKLIST } from '/constants.js'

export function renderContact(root, hash) {
  const params = new URLSearchParams((hash.split('?')[1] || ''))
  const id = params.get('id')
  const contact = AppState.contacts.find(c => c.id === id)

  if (!contact) {
    root.innerHTML = `
      <div class="page-header">
        <h2>コンタクト詳細</h2>
        <a href="#contacts" class="btn btn-ghost">← 一覧</a>
      </div>
      <p class="empty-state">コンタクトが見つかりません</p>
    `
    return
  }

  const phaseKey   = contact.phase || 'card'
  const phaseIndex = CONTACT_PHASES.findIndex(p => p.key === phaseKey)
  const currentPhase = CONTACT_PHASES[Math.max(0, phaseIndex)]
  const checklist    = CONTACT_PHASE_CHECKLIST[currentPhase.key] ?? []
  const nextPhase    = CONTACT_PHASES[phaseIndex + 1] ?? null

  root.innerHTML = `
    <div class="page-header">
      <h2>${contact.name || contact.companyName || '（未整備）'}</h2>
      <a href="#contacts" class="btn btn-ghost">← 一覧</a>
    </div>

    <div class="contact-detail-wrap">

      ${contact.cardImageUrl ? `
        <div class="contact-card-image-wrap">
          <img src="${contact.cardImageUrl}" alt="名刺画像" class="contact-card-image" />
          <button type="button" id="cd-ocr-btn" class="btn btn-secondary btn-sm cd-ocr-btn">
            🔍 OCRでフォームに読み込む
          </button>
          <div id="cd-ocr-feedback" class="cq-feedback hidden"></div>
        </div>
      ` : ''}

      <div class="card">
        <h3 class="cd-section-title">基本情報</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>氏名</label>
            <input type="text" id="cd-name" value="${esc(contact.name)}" placeholder="山田 太郎" />
          </div>
          <div class="form-group">
            <label>会社名</label>
            <input type="text" id="cd-company" value="${esc(contact.companyName)}" placeholder="株式会社〇〇" />
          </div>
          <div class="form-group">
            <label>部署</label>
            <input type="text" id="cd-dept" value="${esc(contact.department)}" placeholder="営業部" />
          </div>
          <div class="form-group">
            <label>役職</label>
            <input type="text" id="cd-title-field" value="${esc(contact.title)}" placeholder="部長" />
          </div>
          <div class="form-group">
            <label>TEL</label>
            <input type="tel" id="cd-tel" value="${esc(contact.tel)}" placeholder="090-0000-0000" />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="cd-email" value="${esc(contact.email)}" placeholder="yamada@example.com" />
          </div>
          <div class="form-group form-group--full">
            <label>住所</label>
            <input type="text" id="cd-address" value="${esc(contact.address)}" placeholder="東京都〇〇区..." />
          </div>
          <div class="form-group form-group--full">
            <label>メモ</label>
            <textarea id="cd-memo" rows="2">${esc(contact.quickMemo)}</textarea>
          </div>
          <div class="form-group form-group--full">
            <label>催事名</label>
            <input type="text" id="cd-event" value="${esc(contact.eventName)}" placeholder="〇〇展示会 2026" />
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="cd-section-title">ラベル</h3>
        <div class="cq-label-buttons" id="cd-label-group">
          ${CONTACT_QUICK_LABELS.map(l => `
            <button type="button" class="cq-label-btn${contact.quickLabel === l.key ? ' selected' : ''}"
              data-key="${l.key}" style="--lc:${l.color};--lb:${l.bg}">
              ${l.label}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <h3 class="cd-section-title">フェーズ</h3>
        <div class="contact-phase-stepper">
          ${CONTACT_PHASES.map((p, i) => `
            <div class="phase-step ${i < phaseIndex ? 'done' : i === phaseIndex ? 'current' : 'future'}">
              <div class="phase-step-dot"></div>
              <div class="phase-step-label">${p.label}</div>
            </div>
          `).join('')}
        </div>

        <div class="contact-checklist">
          <p class="checklist-phase-label">【${currentPhase.label}】 完了チェック</p>
          ${checklist.map(item => `
            <label class="checklist-item">
              <input type="checkbox" class="checklist-cb" />
              <span>${item.text}</span>
            </label>
          `).join('')}
        </div>

        ${nextPhase ? `
          <button type="button" id="cd-next-phase-btn" class="btn btn-secondary btn-block" style="margin-top:12px">
            次のフェーズへ：${nextPhase.label} →
          </button>
        ` : `
          <p class="phase-completed-msg">🎉 最終フェーズに到達しています</p>
        `}
      </div>

      <div class="card">
        <h3 class="cd-section-title">次アクション</h3>
        <div class="form-group">
          <label>予定日</label>
          <input type="date" id="cd-next-date" value="${esc(contact.nextActionDate ?? '')}" />
        </div>
        <div class="form-group">
          <label>内容</label>
          <textarea id="cd-next-memo" rows="2">${esc(contact.nextActionMemo)}</textarea>
        </div>
      </div>

      <div class="contact-detail-actions">
        <button type="button" id="cd-save-btn" class="btn btn-primary btn-block">保存する</button>
        <div id="cd-feedback" class="cq-feedback hidden"></div>
      </div>

    </div>
  `

  let selectedLabel = contact.quickLabel
  let ocrDone = false

  // OCR
  const ocrBtn = document.getElementById('cd-ocr-btn')
  if (ocrBtn) {
    ocrBtn.addEventListener('click', async () => {
      ocrBtn.disabled = true
      ocrBtn.textContent = '読み取り中...'
      const ocrFb = document.getElementById('cd-ocr-feedback')
      try {
        const updated = await triggerContactOCR(id)
        const idx = AppState.contacts.findIndex(c => c.id === id)
        if (idx !== -1) AppState.contacts[idx] = updated

        let fields = null
        try { fields = JSON.parse(updated.ocrRawText) } catch (_) { /* 非JSON時はスキップ */ }

        if (fields) {
          if (fields.name)        document.getElementById('cd-name').value        = fields.name
          if (fields.companyName) document.getElementById('cd-company').value     = fields.companyName
          if (fields.department)  document.getElementById('cd-dept').value        = fields.department
          if (fields.title)       document.getElementById('cd-title-field').value = fields.title
          if (fields.tel)         document.getElementById('cd-tel').value         = fields.tel
          if (fields.email)       document.getElementById('cd-email').value       = fields.email
          if (fields.address)     document.getElementById('cd-address').value     = fields.address
          ocrDone = true
          ocrFb.textContent = '✓ 読み取り完了。内容を確認して保存してください。'
          ocrFb.className = 'cq-feedback cq-feedback--success'
        } else {
          ocrFb.textContent = '読み取り結果をフォームに反映できませんでした。手動で入力してください。'
          ocrFb.className = 'cq-feedback cq-feedback--error'
        }
      } catch (e) {
        const ocrFb2 = document.getElementById('cd-ocr-feedback')
        if (ocrFb2) { ocrFb2.textContent = `OCRエラー: ${e.message}`; ocrFb2.className = 'cq-feedback cq-feedback--error' }
      } finally {
        ocrBtn.disabled = false
        ocrBtn.textContent = '🔍 OCRでフォームに読み込む'
      }
    })
  }

  root.querySelectorAll('.cq-label-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.cq-label-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedLabel = btn.dataset.key
    })
  })

  const nextPhaseBtn = document.getElementById('cd-next-phase-btn')
  if (nextPhaseBtn) {
    nextPhaseBtn.addEventListener('click', async () => {
      nextPhaseBtn.disabled = true
      nextPhaseBtn.textContent = '更新中...'
      try {
        const updated = await save(nextPhase.key)
        const idx = AppState.contacts.findIndex(c => c.id === id)
        if (idx !== -1) AppState.contacts[idx] = updated
        renderContact(root, hash)
      } catch (e) {
        nextPhaseBtn.disabled = false
        nextPhaseBtn.textContent = `次のフェーズへ：${nextPhase.label} →`
        showFeedback(`エラー: ${e.message}`, 'error')
      }
    })
  }

  document.getElementById('cd-save-btn').addEventListener('click', async () => {
    const btn = document.getElementById('cd-save-btn')
    btn.disabled = true
    btn.textContent = '保存中...'
    try {
      const updated = await save(currentPhase.key)
      const idx = AppState.contacts.findIndex(c => c.id === id)
      if (idx !== -1) AppState.contacts[idx] = updated
      showFeedback('✓ 保存しました', 'success')
    } catch (e) {
      showFeedback(`エラー: ${e.message}`, 'error')
    } finally {
      btn.disabled = false
      btn.textContent = '保存する'
    }
  })

  function save(phase) {
    return updateContact({
      ...contact,
      name:           document.getElementById('cd-name').value.trim(),
      companyName:    document.getElementById('cd-company').value.trim(),
      department:     document.getElementById('cd-dept').value.trim(),
      title:          document.getElementById('cd-title-field').value.trim(),
      tel:            document.getElementById('cd-tel').value.trim(),
      email:          document.getElementById('cd-email').value.trim(),
      address:        document.getElementById('cd-address').value.trim(),
      quickMemo:      document.getElementById('cd-memo').value.trim(),
      eventName:      document.getElementById('cd-event').value.trim(),
      quickLabel:     selectedLabel,
      phase,
      nextActionDate: document.getElementById('cd-next-date').value || '',
      nextActionMemo: document.getElementById('cd-next-memo').value.trim(),
      ocrStatus:      ocrDone ? 'confirmed' : contact.ocrStatus,
      updatedAt:      new Date().toISOString(),
    })
  }

  function showFeedback(msg, type) {
    const fb = document.getElementById('cd-feedback')
    if (!fb) return
    fb.textContent = msg
    fb.className = `cq-feedback cq-feedback--${type}`
    setTimeout(() => { if (fb) fb.className = 'cq-feedback hidden' }, 3000)
  }
}

function esc(s) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
