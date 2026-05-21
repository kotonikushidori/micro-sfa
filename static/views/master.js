// master.js: マスター管理画面（admin専用）。部署・ユーザーの追加・論理削除・ロール変更。
// 物理削除は禁止。過去の案件スナップショット（assignee_name/dept_name）は変更しない。
import { AppState, refreshState } from '/app.js'
import { saveUsers, saveDepts, loadUsers, loadDepts, loadLockConfig, saveLockConfig, loadSettings, saveSettings } from '/data.js'
import { LOCK_TRIGGER_DEFS, DEFAULT_LOCK_CONFIG } from '/constants.js'

const ROLES = ['sales', 'manager', 'executive', 'admin']

export function renderMaster(root) {
  root.innerHTML = `
    <div class="page-header"><h2>マスター管理</h2></div>
    <div class="master-tabs">
      <button class="tab-btn active" data-tab="dept">部署管理</button>
      <button class="tab-btn" data-tab="user">ユーザー管理</button>
      <button class="tab-btn" data-tab="lock">ロック条件</button>
      <button class="tab-btn" data-tab="settings">システム設定</button>
    </div>
    <div id="master-content"></div>
  `

  root.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      renderTab(btn.dataset.tab)
    })
  })

  renderTab('dept')
}

function renderTab(tab) {
  const content = document.getElementById('master-content')
  if (tab === 'dept')         renderDeptTab(content)
  else if (tab === 'user')    renderUserTab(content)
  else if (tab === 'lock')    renderLockTab(content)
  else                        renderSettingsTab(content)
}

// ---------- 部署タブ ----------

function renderDeptTab(content) {
  const depts = loadDepts()
  content.innerHTML = `
    <section class="card">
      <div class="section-header">
        <h3>部署一覧</h3>
        <button id="btn-add-dept" class="btn btn-primary">+ 部署追加</button>
      </div>
      <table class="data-table">
        <thead><tr><th>部署名</th><th>状態</th><th>操作</th></tr></thead>
        <tbody>
          ${depts.map(d => `
            <tr ${!d.isActive ? 'class="row-inactive"' : ''}>
              <td>${d.name}</td>
              <td>${d.isActive ? '<span class="badge-active">有効</span>' : '<span class="badge-inactive">無効</span>'}</td>
              <td>
                <button class="btn btn-sm btn-ghost btn-toggle-dept" data-id="${d.id}" data-active="${d.isActive}">
                  ${d.isActive ? '無効化' : '有効化'}
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `

  document.getElementById('btn-add-dept').addEventListener('click', () => {
    const name = prompt('新しい部署名を入力してください')?.trim()
    if (!name) return
    const depts = loadDepts()
    depts.push({ id: `dept_${crypto.randomUUID().slice(0, 8)}`, name, isActive: true, createdAt: new Date().toISOString() })
    saveDepts(depts)
    refreshState()
    renderTab('dept')
  })

  content.querySelectorAll('.btn-toggle-dept').forEach(btn => {
    btn.addEventListener('click', () => {
      const depts = loadDepts()
      const dept  = depts.find(d => d.id === btn.dataset.id)
      if (!dept) return
      if (dept.isActive && !confirm(`「${dept.name}」を無効化します。過去の案件データはそのまま保持されます。`)) return
      dept.isActive = !dept.isActive
      saveDepts(depts)
      refreshState()
      renderTab('dept')
    })
  })
}

// ---------- ユーザータブ ----------

function renderUserTab(content) {
  const users = loadUsers()
  const depts = loadDepts()

  content.innerHTML = `
    <section class="card">
      <div class="section-header">
        <h3>ユーザー一覧</h3>
        <button id="btn-add-user" class="btn btn-primary">+ ユーザー追加</button>
      </div>
      <table class="data-table">
        <thead><tr><th>名前</th><th>部署</th><th>ロール</th><th>状態</th><th>操作</th></tr></thead>
        <tbody>
          ${users.map(u => {
            const dept = depts.find(d => d.id === u.dept_id)
            return `
              <tr ${!u.isActive ? 'class="row-inactive"' : ''}>
                <td>${u.name}</td>
                <td>${dept?.name ?? '-'}</td>
                <td>
                  <select class="role-select" data-id="${u.id}">
                    ${ROLES.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                  </select>
                </td>
                <td>${u.isActive ? '<span class="badge-active">有効</span>' : '<span class="badge-inactive">無効</span>'}</td>
                <td>
                  <button class="btn btn-sm btn-ghost btn-toggle-user" data-id="${u.id}" data-active="${u.isActive}">
                    ${u.isActive ? '無効化' : '有効化'}
                  </button>
                </td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </section>
  `

  // ロール変更
  content.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const users = loadUsers()
      const user  = users.find(u => u.id === sel.dataset.id)
      if (!user) return
      user.role = sel.value
      saveUsers(users)
      refreshState()
    })
  })

  // 有効/無効切替
  content.querySelectorAll('.btn-toggle-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const users = loadUsers()
      const user  = users.find(u => u.id === btn.dataset.id)
      if (!user) return
      if (user.isActive && !confirm(`「${user.name}」を無効化します。過去の案件スナップショットは保持されます。`)) return
      user.isActive = !user.isActive
      saveUsers(users)
      refreshState()
      renderTab('user')
    })
  })

  // ユーザー追加
  document.getElementById('btn-add-user').addEventListener('click', () => showAddUserModal(depts))
}

function showAddUserModal(depts) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>ユーザー追加</h3>
      <form id="add-user-form">
        <div class="form-group">
          <label>名前 <span class="required">*</span></label>
          <input type="text" id="new-user-name" required />
        </div>
        <div class="form-group">
          <label>部署 <span class="required">*</span></label>
          <select id="new-user-dept">
            ${depts.filter(d => d.isActive).map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>ロール</label>
          <select id="new-user-role">
            ${ROLES.map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>パスワード <span class="required">*</span></label>
          <input type="password" id="new-user-password" required />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">追加</button>
          <button type="button" id="btn-cancel-modal" class="btn btn-ghost">キャンセル</button>
        </div>
      </form>
    </div>
  `
  document.body.appendChild(overlay)

  document.getElementById('btn-cancel-modal').addEventListener('click', () => overlay.remove())

  document.getElementById('add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const name     = document.getElementById('new-user-name').value.trim()
    const dept_id  = document.getElementById('new-user-dept').value
    const role     = document.getElementById('new-user-role').value
    const password = document.getElementById('new-user-password').value
    const hash     = await sha256(password)
    const users    = loadUsers()
    users.push({
      id: `user_${crypto.randomUUID().slice(0, 8)}`,
      name, dept_id, role, password: hash,
      isActive: true, createdAt: new Date().toISOString(),
    })
    saveUsers(users)
    refreshState()
    overlay.remove()
    renderTab('user')
  })
}

// ---------- ロック条件タブ ----------

function renderLockTab(content) {
  const cfg = loadLockConfig() ?? { ...DEFAULT_LOCK_CONFIG }

  content.innerHTML = `
    <section class="card">
      <div class="section-header">
        <h3>案件ロック条件</h3>
        <button id="btn-save-lock" class="btn btn-primary">設定を保存</button>
      </div>
      <p class="lock-tab-desc">
        以下の条件を満たした案件は <strong>全フィールドが編集不可（参照のみ）</strong> になります。<br>
        フィールド単位の制御が不要になるため、将来の機能追加時も権限ロジックの追加箇所はここ1箇所です。
      </p>

      <div class="lock-trigger-list" id="lock-trigger-list">
        ${LOCK_TRIGGER_DEFS.map(t => `
          <div class="lock-trigger-item">
            <label class="lock-trigger-main">
              <input type="checkbox" id="lock-chk-${t.key}" ${cfg[t.key] ? 'checked' : ''} />
              <div class="lock-trigger-text">
                <span class="lock-trigger-label">${t.label}</span>
                <span class="lock-trigger-desc">${t.desc}</span>
              </div>
            </label>
            ${t.paramKey ? `
              <div class="lock-trigger-param ${cfg[t.key] ? '' : 'hidden'}" id="param-${t.key}">
                <label>${t.paramLabel}</label>
                <select id="lock-param-${t.paramKey}">
                  ${[1,2,3,4].map(n => `<option value="${n}" ${(cfg[t.paramKey] ?? t.paramDefault) === n ? 'selected' : ''}>Phase ${n} 以降</option>`).join('')}
                </select>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div class="lock-preview" id="lock-preview"></div>
    </section>
  `

  // チェックボックス変更時にパラメータ行の表示切替
  LOCK_TRIGGER_DEFS.filter(t => t.paramKey).forEach(t => {
    document.getElementById(`lock-chk-${t.key}`)?.addEventListener('change', (e) => {
      document.getElementById(`param-${t.key}`)?.classList.toggle('hidden', !e.target.checked)
      updatePreview()
    })
  })

  LOCK_TRIGGER_DEFS.forEach(t => {
    document.getElementById(`lock-chk-${t.key}`)?.addEventListener('change', updatePreview)
  })

  function readConfig() {
    const next = {}
    LOCK_TRIGGER_DEFS.forEach(t => {
      next[t.key] = document.getElementById(`lock-chk-${t.key}`)?.checked ?? false
      if (t.paramKey) {
        const sel = document.getElementById(`lock-param-${t.paramKey}`)
        next[t.paramKey] = sel ? Number(sel.value) : t.paramDefault
      }
    })
    return next
  }

  function updatePreview() {
    const nextCfg  = readConfig()
    const locked   = AppState.deals.filter(d => LOCK_TRIGGER_DEFS.some(t => t.check(d, nextCfg)))
    const preview  = document.getElementById('lock-preview')
    if (!preview) return
    preview.innerHTML = locked.length === 0
      ? '<p class="lock-preview-none">現在の設定でロックされる案件：なし</p>'
      : `<p class="lock-preview-count">この設定でロックされる案件：<strong>${locked.length}件</strong></p>
         <ul class="lock-preview-list">
           ${locked.map(d => `<li>${d.name}（${d.assignee_name}）</li>`).join('')}
         </ul>`
  }

  updatePreview()

  document.getElementById('btn-save-lock').addEventListener('click', () => {
    const nextCfg = readConfig()
    saveLockConfig(nextCfg)
    refreshState()
    updatePreview()
    alert('ロック設定を保存しました。')
  })
}

// ---------- システム設定タブ ----------

function renderSettingsTab(content) {
  const settings = loadSettings()
  const fsm      = settings.fiscalStartMonth ?? 4

  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  content.innerHTML = `
    <section class="card">
      <h3>システム設定</h3>
      <p class="lock-tab-desc">会計年度・四半期の計算に使用する設定です。変更するとダッシュボード・指導ダッシュボード・マイページの四半期表示がすべて更新されます。</p>

      <div class="settings-row">
        <div class="settings-label">
          <strong>決算月（期末月）</strong>
          <span class="settings-desc">例：3月決算 → 4月始まり、12月決算 → 1月始まり</span>
        </div>
        <div class="settings-control">
          <select id="fiscal-end-month" class="form-control-select">
            ${months.map(m => {
              const startMonth = m === 12 ? 1 : m + 1
              return `<option value="${startMonth}" ${startMonth === fsm ? 'selected' : ''}>${m}月決算（${startMonth}月始まり）</option>`
            }).join('')}
          </select>
          <button id="save-settings" class="btn btn-primary btn-sm" style="margin-left:12px">保存</button>
          <span id="settings-saved" class="settings-saved hidden">✓ 保存しました</span>
        </div>
      </div>

      <div class="settings-preview">
        <strong>現在の設定：</strong>${fsm}月始まり（${fsm === 1 ? 12 : fsm - 1}月決算）
        　Q1 = ${fsm}-${((fsm + 1) % 12) || 12}月、Q2 = ${((fsm + 2) % 12) || 12}-${((fsm + 4) % 12) || 12}月、Q3 = ${((fsm + 5) % 12) || 12}-${((fsm + 7) % 12) || 12}月、Q4 = ${((fsm + 8) % 12) || 12}-${((fsm + 10) % 12) || 12}月
      </div>
    </section>
  `

  document.getElementById('save-settings').addEventListener('click', () => {
    const newFsm = Number(document.getElementById('fiscal-end-month').value)
    saveSettings({ ...loadSettings(), fiscalStartMonth: newFsm })
    refreshState()
    const saved = document.getElementById('settings-saved')
    saved.classList.remove('hidden')
    setTimeout(() => saved.classList.add('hidden'), 2000)
    // プレビュー更新のためタブ再描画
    renderSettingsTab(content)
  })
}

async function sha256(message) {
  const buf  = new TextEncoder().encode(message)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
