// login.js: ログイン画面。SHA-256ハッシュでlocalStorageのpasswordと照合する。
import { loadUsers } from '/data.js'
import { login } from '/app.js'

// SHA-256はブラウザネイティブのSubtleCryptoで計算する（外部ライブラリ不要）
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const DEMO_ACCOUNTS = [
  { name: '田中 一郎', role: 'sales',     label: '営業（sales）' },
  { name: '山田 部長', role: 'manager',   label: 'マネージャー（manager）' },
  { name: '社長',      role: 'executive', label: '経営幹部（executive）' },
  { name: 'admin',     role: 'admin',     label: '管理者（admin）' },
]

export function renderLogin(root) {
  root.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <h1 class="login-title">micro-SFA</h1>
        <p class="login-subtitle">Phase × BANT で案件を客観管理</p>

        <div class="demo-accounts">
          <p class="demo-title">デモアカウントで試す</p>
          ${DEMO_ACCOUNTS.map(a => `
            <button type="button" class="btn btn-demo-account" data-name="${a.name}">
              ${a.label}
            </button>
          `).join('')}
        </div>

        <div class="login-divider"><span>または手入力</span></div>

        <form id="login-form" class="login-form">
          <div class="form-group">
            <label for="username">ユーザー名</label>
            <input type="text" id="username" name="username" autocomplete="username" required />
          </div>
          <div class="form-group">
            <label for="password">パスワード</label>
            <input type="password" id="password" name="password" autocomplete="current-password" required />
          </div>
          <p id="login-error" class="error-msg hidden"></p>
          <button type="submit" class="btn btn-primary btn-block">ログイン</button>
        </form>

        <button type="button" id="btn-reset-data" class="btn-reset-link">
          デモデータをリセット（ログインできない場合）
        </button>
      </div>
    </div>
  `

  // デモアカウントボタン：ユーザー名を自動入力してそのままログイン
  root.querySelectorAll('.btn-demo-account').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name
      const hash = await sha256('demo1234')
      const users = loadUsers()
      const user  = users.find(u => u.name === name && u.isActive)
      if (!user) {
        alert('デモデータが壊れています。「デモデータをリセット」を押してください。')
        return
      }
      login(user)
    })
  })

  // 手動ログイン
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const username = document.getElementById('username').value.trim()
    const password = document.getElementById('password').value
    const errorEl  = document.getElementById('login-error')

    const hash  = await sha256(password)
    const users = loadUsers()
    const user  = users.find(u => u.name === username && u.password === hash && u.isActive)

    if (!user) {
      errorEl.textContent = 'ユーザー名またはパスワードが正しくありません'
      errorEl.classList.remove('hidden')
      return
    }

    errorEl.classList.add('hidden')
    login(user)
  })

  // LocalStorageを完全リセットして再初期化
  document.getElementById('btn-reset-data').addEventListener('click', () => {
    if (!confirm('LocalStorageのデモデータをリセットします。案件データも消えます。よろしいですか？')) return
    localStorage.clear()
    location.reload()
  })
}
