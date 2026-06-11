// login.js: ログイン画面。パスワード検証はサーバー側で行う。
import { loginAPI } from '/data.js'
import { login } from '/app.js'

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

        <a href="#lp" class="btn-lp-link">💡 micro-SFAとは？</a>
      </div>
    </div>
  `

  async function doLogin(name, password) {
    const errorEl = document.getElementById('login-error')
    try {
      const user = await loginAPI(name, password)
      errorEl.classList.add('hidden')
      await login(user)
    } catch {
      errorEl.textContent = 'ユーザー名またはパスワードが正しくありません'
      errorEl.classList.remove('hidden')
    }
  }

  root.querySelectorAll('.btn-demo-account').forEach(btn => {
    btn.addEventListener('click', () => doLogin(btn.dataset.name, 'demo1234'))
  })

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const name     = document.getElementById('username').value.trim()
    const password = document.getElementById('password').value
    await doLogin(name, password)
  })
}
