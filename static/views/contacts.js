// contacts.js: コンタクト（名刺・人脈）管理一覧画面
import { AppState } from '/app.js'
import { CONTACT_QUICK_LABELS, CONTACT_PHASES, CONTACT_OCR_STATUS } from '/constants.js'

export function renderContacts(root) {
  const user     = AppState.currentUser
  const contacts = AppState.contacts
  const myContacts = contacts.filter(c => c.assignee_id === user.id)
  const rawCount   = contacts.filter(c => c.ocrStatus === 'raw').length

  root.innerHTML = `
    <div class="page-header">
      <h2>コンタクト管理</h2>
      <a href="#contact-quick" class="btn btn-primary">+ クイック入力</a>
    </div>

    ${rawCount > 0 ? `
      <div class="contacts-unprocessed-banner">
        <span class="contacts-unprocessed-icon">📬</span>
        <div class="contacts-unprocessed-text">
          <strong>未整備のコンタクトが ${rawCount} 件あります</strong>
          <span class="contacts-unprocessed-hint">名刺情報を整備（OCR・フォーム入力）してください</span>
        </div>
      </div>
    ` : contacts.length > 0 ? `
      <div class="contacts-all-done-banner">
        すべての名刺が整備済みです
      </div>
    ` : ''}

    <div class="contacts-filter-row">
      <button class="tab-btn" data-filter="all">すべて <span class="tab-count">${contacts.length}</span></button>
      <button class="tab-btn active" data-filter="mine">自分のみ <span class="tab-count">${myContacts.length}</span></button>
      <button class="tab-btn" data-filter="raw">未整備 <span class="tab-count">${rawCount}</span></button>
    </div>

    <div id="contacts-list">
      ${renderContactCards(myContacts)}
    </div>

    <a href="#contact-quick" class="fab-register" aria-label="クイック入力">+</a>
  `

  root.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === btn))
      const filter = btn.dataset.filter
      let filtered
      if (filter === 'mine')    filtered = myContacts
      else if (filter === 'raw') filtered = contacts.filter(c => c.ocrStatus === 'raw')
      else                       filtered = contacts
      document.getElementById('contacts-list').innerHTML = renderContactCards(filtered)
    })
  })
}

function renderContactCards(contacts) {
  if (contacts.length === 0) {
    return `
      <div class="empty-state">
        <p>コンタクトはありません</p>
        <a href="#contact-quick" class="btn btn-primary mt-16">クイック入力で名刺を登録する</a>
      </div>
    `
  }
  return contacts.map(c => renderContactCard(c)).join('')
}

function renderContactCard(c) {
  const label      = CONTACT_QUICK_LABELS.find(l => l.key === c.quickLabel)
  const phase      = CONTACT_PHASES.find(p => p.key === c.phase)
  const ocrInfo    = CONTACT_OCR_STATUS[c.ocrStatus] ?? CONTACT_OCR_STATUS.raw
  const displayName = c.name || c.companyName || '（未整備）'
  const sub         = (c.name && c.companyName) ? c.companyName : (c.quickMemo || '')

  return `
    <a class="contact-card card" href="#contact?id=${c.id}">
      <div class="contact-card-header">
        <div class="contact-card-name">
          ${displayName}
          ${sub ? `<span class="contact-card-sub">${sub}</span>` : ''}
        </div>
        <div class="contact-card-badges">
          ${label
            ? `<span class="quick-label-badge" style="color:${label.color};background:${label.bg}">${label.label}</span>`
            : ''}
          <span class="ocr-status-badge ocr-status-badge--${ocrInfo.cls}">${ocrInfo.icon} ${ocrInfo.label}</span>
        </div>
      </div>
      <div class="contact-card-meta">
        ${c.eventName ? `<span class="contact-meta-item">📍 ${c.eventName}</span>` : ''}
        <span class="contact-meta-item">📅 ${c.capturedAt.slice(0, 10)}</span>
        ${phase ? `<span class="contact-meta-item contact-phase-tag">${phase.label}</span>` : ''}
        ${c.cardImageUrl ? `<span class="contact-meta-item">📷</span>` : ''}
      </div>
    </a>
  `
}
