// contact-quick.js: 現地での名刺クイック入力専用画面（スマホ・スピード最優先）
// フェーズ管理・次アクション設定は一切行わない。10秒で入力完了が目標。
import { AppState } from '/app.js'
import { createContact } from '/data.js'
import { CONTACT_QUICK_LABELS } from '/constants.js'

const EVENT_NAME_KEY = 'contact_event_name'

export function renderContactQuick(root) {
  const savedEventName = localStorage.getItem(EVENT_NAME_KEY) ?? ''

  root.innerHTML = `
    <div class="page-header">
      <h2>名刺クイック入力</h2>
      <a href="#contacts" class="btn btn-ghost">← 一覧へ</a>
    </div>

    <div class="contact-quick-wrap">
      <div class="card contact-quick-card">

        <div class="form-group">
          <label for="cq-event-name" class="cq-label">催事名（一度設定すると次回も引き継がれます）</label>
          <input type="text" id="cq-event-name" class="cq-event-input"
            value="${escHtml(savedEventName)}"
            placeholder="例: 〇〇展示会 2026、△△商談会" />
        </div>

        <div class="cq-image-section" id="cq-image-section">
          <input type="file" id="cq-image-input" accept="image/*" capture="camera" class="hidden" />
          <button type="button" id="cq-take-photo-btn" class="btn-photo-capture">
            📷 名刺を撮影する
          </button>
          <div id="cq-preview-wrap" class="cq-preview-wrap hidden">
            <img id="cq-preview" src="" alt="名刺プレビュー" class="cq-preview-img" />
            <button type="button" id="cq-image-clear-btn" class="btn btn-ghost btn-sm cq-clear-btn">
              撮り直す
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="cq-label">ラベル <span class="required">*</span></label>
          <div class="cq-label-buttons" id="cq-label-group">
            ${CONTACT_QUICK_LABELS.map(l => `
              <button type="button" class="cq-label-btn" data-key="${l.key}"
                style="--lc:${l.color};--lb:${l.bg}">
                ${l.label}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label for="cq-memo" class="cq-label">一言メモ（任意）</label>
          <textarea id="cq-memo" class="cq-memo-textarea" rows="2"
            placeholder="例: EC系スタートアップ。来月リプレイス検討中。"></textarea>
        </div>

        <button type="button" id="cq-save-btn" class="btn btn-primary btn-block cq-save-btn" disabled>
          保存する
        </button>

        <div id="cq-feedback" class="cq-feedback hidden"></div>
      </div>

      <div class="cq-saved-count-wrap" id="cq-saved-count-wrap" style="display:none">
        <span id="cq-saved-count" class="cq-saved-count">0 件保存済み</span>
        <a href="#contacts" class="btn btn-ghost btn-sm">一覧で確認する</a>
      </div>
    </div>
  `

  let selectedLabel = null
  let imageBase64   = null
  let savedCount    = 0

  const eventNameInput  = document.getElementById('cq-event-name')
  const imageInput      = document.getElementById('cq-image-input')
  const takePhotoBtn    = document.getElementById('cq-take-photo-btn')
  const previewWrap     = document.getElementById('cq-preview-wrap')
  const previewImg      = document.getElementById('cq-preview')
  const imageClearBtn   = document.getElementById('cq-image-clear-btn')
  const memo            = document.getElementById('cq-memo')
  const saveBtn         = document.getElementById('cq-save-btn')
  const feedback        = document.getElementById('cq-feedback')
  const savedCountWrap  = document.getElementById('cq-saved-count-wrap')
  const savedCountEl    = document.getElementById('cq-saved-count')

  function updateSaveState() {
    saveBtn.disabled = !selectedLabel
  }

  // 催事名をlocalStorageに保存
  eventNameInput.addEventListener('input', () => {
    localStorage.setItem(EVENT_NAME_KEY, eventNameInput.value)
  })

  // 写真撮影
  takePhotoBtn.addEventListener('click', () => imageInput.click())

  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      imageBase64 = dataUrl.split(',')[1]
      previewImg.src = dataUrl
      previewWrap.classList.remove('hidden')
      takePhotoBtn.classList.add('hidden')
    }
    reader.readAsDataURL(file)
  })

  imageClearBtn.addEventListener('click', () => {
    imageBase64 = null
    imageInput.value = ''
    previewImg.src = ''
    previewWrap.classList.add('hidden')
    takePhotoBtn.classList.remove('hidden')
  })

  // ラベル選択
  root.querySelectorAll('.cq-label-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.cq-label-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedLabel = btn.dataset.key
      updateSaveState()
    })
  })

  // 保存
  saveBtn.addEventListener('click', async () => {
    if (!selectedLabel) return

    const now  = new Date().toISOString()
    const id   = `ct_${crypto.randomUUID().slice(0, 8)}`
    const user = AppState.currentUser

    saveBtn.disabled  = true
    saveBtn.textContent = '保存中...'

    try {
      const contact = await createContact({
        id,
        cardImageData: imageBase64 ?? '',
        quickLabel:    selectedLabel,
        quickMemo:     memo.value.trim(),
        eventName:     eventNameInput.value.trim(),
        capturedAt:    now,
        assignee_id:   user.id,
        assignee_name: user.name,
        createdAt:     now,
        updatedAt:     now,
      })

      // AppState にも即時反映（次に一覧を開いたときに見える）
      AppState.contacts.unshift(contact)

      savedCount++
      savedCountEl.textContent = `${savedCount} 件保存済み`
      savedCountWrap.style.display = 'flex'

      showFeedback('✓ 保存しました', 'success')
      resetForm()
    } catch (err) {
      showFeedback(`エラー: ${err.message}`, 'error')
    } finally {
      saveBtn.textContent = '保存する'
      updateSaveState()
    }
  })

  function resetForm() {
    selectedLabel = null
    imageBase64   = null
    imageInput.value = ''
    previewImg.src = ''
    previewWrap.classList.add('hidden')
    takePhotoBtn.classList.remove('hidden')
    memo.value = ''
    root.querySelectorAll('.cq-label-btn').forEach(b => b.classList.remove('selected'))
    updateSaveState()
  }

  function showFeedback(msg, type) {
    feedback.textContent = msg
    feedback.className = `cq-feedback cq-feedback--${type}`
    setTimeout(() => { feedback.className = 'cq-feedback hidden' }, 3000)
  }
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
