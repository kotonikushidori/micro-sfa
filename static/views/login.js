// login.js: ログイン画面。パスワード検証はサーバー側で行う。

const AUTH_ERROR_MESSAGES = {
  not_registered:        'このGoogleアカウントは登録されていません。管理者にお問い合わせください。',
  inactive:              'アカウントが無効になっています。管理者にお問い合わせください。',
  google_not_configured: 'Googleログインは現在設定されていません。',
  invalid_state:         '認証フローが無効です。もう一度お試しください。',
  token_exchange_failed: 'Google認証に失敗しました。もう一度お試しください。',
  db_error:              'サーバーエラーが発生しました。',
}

export function renderLogin(root) {
  const authError = new URLSearchParams(location.search).get('auth_error')

  root.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <h1 class="login-title">micro-SFA</h1>
        <p class="login-subtitle">Phase × BANT で案件を客観管理</p>

        ${authError ? `<p class="error-msg google-auth-error">${AUTH_ERROR_MESSAGES[authError] ?? '認証エラーが発生しました。'}</p>` : ''}

        <a href="/api/auth/google" class="btn btn-google">
          <svg width="18" height="18" viewBox="0 0 48 48" style="vertical-align:middle;margin-right:8px">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Googleアカウントでログイン
        </a>

        <a href="#lp" class="btn-lp-link">💡 micro-SFAとは？</a>
      </div>
    </div>
  `

}
