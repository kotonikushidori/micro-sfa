// app.js: アプリケーションの起動・ルーティング・グローバル状態管理
// 各画面モジュールは views/ 以下に分離し、ここでは組み立てのみ行う。

import { loadCurrentUser, saveCurrentUser, clearCurrentUser, loadDeals, loadUsers, loadDepts, loadLockConfig, loadSettings, initDemoData } from '/data.js'
import { DEFAULT_LOCK_CONFIG, getBantItems, getPhaseItems } from '/constants.js'
import { renderLogin } from '/views/login.js'
import { renderMy } from '/views/my.js'
import { renderDeal } from '/views/deal.js'
import { renderKanban } from '/views/kanban.js'
import { renderForecast } from '/views/forecast.js'
import { renderDashboard } from '/views/dashboard.js'
import { renderMaster } from '/views/master.js'
import { renderCoach } from '/views/coach.js'
import { renderLp } from '/views/lp.js'
import { renderLpSales } from '/views/lp-sales.js'
import { renderLpManager } from '/views/lp-manager.js'

// ✅ 状態はすべて AppState に一元管理。各 view は AppState を読み書きする。
export const AppState = {
  currentUser: null,
  currentHash: '',
  deals: [],
  users: [],
  depts: [],
  lockConfig: DEFAULT_LOCK_CONFIG,
  settings: { fiscalStartMonth: 4 },
  bantItems: getBantItems('default'),
  phaseItems: getPhaseItems('default'),
}

// ロールごとのデフォルト画面とナビリンク定義
const ROLE_CONFIG = {
  sales:     { defaultHash: '#my',        nav: ['#my', '#deal', '#kanban'] },
  manager:   { defaultHash: '#kanban',    nav: ['#my', '#deal', '#kanban', '#forecast', '#dashboard', '#coach'] },
  executive: { defaultHash: '#dashboard', nav: ['#my', '#dashboard'] },
  admin:     { defaultHash: '#master',    nav: ['#kanban', '#forecast', '#dashboard', '#master'] },
}

const NAV_LABELS = {
  '#my':        'マイページ',
  '#deal':      '案件登録',
  '#kanban':    'カンバン',
  '#forecast':  'ヨミ会',
  '#dashboard': 'ダッシュボード',
  '#master':    'マスター管理',
  '#coach':     '指導ダッシュボード',
}

// ロールが画面にアクセス可能かを返す
function canAccess(role, hash) {
  const base = hash.split('?')[0]  // クエリ部分を除去
  const config = ROLE_CONFIG[role]
  if (!config) return false
  // #deal は salesが自分の案件のみ、managerは全件 → どちらもアクセス許可
  return config.nav.includes(base)
}

// グローバル状態を最新のlocalStorageから再読み込み
export function refreshState() {
  AppState.deals = loadDeals()
  AppState.users = loadUsers()
  AppState.depts = loadDepts()
  AppState.lockConfig = loadLockConfig() ?? DEFAULT_LOCK_CONFIG
  AppState.settings = loadSettings()
  AppState.bantItems  = getBantItems(AppState.settings.bantPreset)
  AppState.phaseItems = getPhaseItems(AppState.settings.phasePreset)
}

// ログイン処理（login.js から呼ばれる）
export function login(user) {
  AppState.currentUser = user
  saveCurrentUser(user)
  refreshState()
  updateHeader()
  const config = ROLE_CONFIG[user.role]
  navigate(config ? config.defaultHash : '#login')
}

// ログアウト処理
function logout() {
  AppState.currentUser = null
  clearCurrentUser()
  navigate('#login')
}

// ハッシュ変更でルーティング
function route() {
  const hash = location.hash || '#login'
  AppState.currentHash = hash
  const root = document.getElementById('app-root')

  if (hash === '#login') {
    updateHeader()
    root.innerHTML = ''
    renderLogin(root)
    return
  }

  if (hash === '#lp') {
    updateHeader()
    root.innerHTML = ''
    renderLp(root)
    return
  }

  if (hash === '#lp-sales') {
    updateHeader()
    root.innerHTML = ''
    renderLpSales(root)
    return
  }

  if (hash === '#lp-manager') {
    updateHeader()
    root.innerHTML = ''
    renderLpManager(root)
    return
  }

  if (!AppState.currentUser) {
    navigate('#login')
    return
  }

  const base = hash.split('?')[0]
  if (!canAccess(AppState.currentUser.role, base)) {
    const config = ROLE_CONFIG[AppState.currentUser.role]
    navigate(config ? config.defaultHash : '#login')
    return
  }

  refreshState()
  root.innerHTML = ''

  switch (base) {
    case '#my':        renderMy(root);               break
    case '#deal':      renderDeal(root, hash);       break
    case '#kanban':    renderKanban(root);            break
    case '#forecast':  renderForecast(root);          break
    case '#dashboard': renderDashboard(root);         break
    case '#master':    renderMaster(root);            break
    case '#coach':     renderCoach(root);             break
    default: root.innerHTML = '<p class="not-found">ページが見つかりません</p>'
  }
}

function navigate(hash) {
  location.hash = hash
}

function updateHeader() {
  const header = document.getElementById('app-header')
  const navEl   = document.getElementById('app-nav')
  const label   = document.getElementById('current-user-label')

  if (!AppState.currentUser) {
    header.classList.add('hidden')
    return
  }

  header.classList.remove('hidden')
  label.textContent = `${AppState.currentUser.name}（${AppState.currentUser.role}）`

  const config = ROLE_CONFIG[AppState.currentUser.role] || { nav: [] }
  navEl.innerHTML = config.nav
    .map(h => `<a href="${h}" class="nav-link">${NAV_LABELS[h]}</a>`)
    .join('')
}

// 起動
function init() {
  initDemoData()

  AppState.currentUser = loadCurrentUser()
  refreshState()
  updateHeader()

  document.getElementById('logout-btn').addEventListener('click', logout)
  window.addEventListener('hashchange', route)

  route()
}

// navigate をグローバルに公開（各 view から使用）
window._navigate = navigate

init()
