// app.js: アプリケーションの起動・ルーティング・グローバル状態管理
import { loadCurrentUser, logoutAPI, fetchAllData } from '/data.js'
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
  activities: [],
  targets: { dept: {}, rep: {} },
  lockConfig: DEFAULT_LOCK_CONFIG,
  settings: { fiscalStartMonth: 4, bantPreset: 'default', phasePreset: 'default' },
  bantItems: getBantItems('default'),
  phaseItems: getPhaseItems('default'),
}

const ROLE_CONFIG = {
  sales:     { defaultHash: '#my',        nav: ['#my'],                                                 allow: ['#deal'] },
  manager:   { defaultHash: '#kanban',    nav: ['#my', '#kanban', '#forecast', '#dashboard', '#coach'], allow: ['#deal'] },
  executive: { defaultHash: '#dashboard', nav: ['#my', '#dashboard'],                                   allow: [] },
  admin:     { defaultHash: '#master',    nav: ['#kanban', '#forecast', '#dashboard', '#master'],       allow: ['#deal'] },
}

const NAV_LABELS = {
  '#my':        'マイページ',
  '#kanban':    'カンバン',
  '#forecast':  'ヨミ会',
  '#dashboard': 'ダッシュボード',
  '#master':    'マスター管理',
  '#coach':     '指導ダッシュボード',
}

const NAV_ICONS = {
  '#my':        '👤',
  '#kanban':    '📈',
  '#forecast':  '💬',
  '#dashboard': '📊',
  '#master':    '⚙️',
  '#coach':     '👥',
}

function canAccess(role, hash) {
  const base = hash.split('?')[0]
  const config = ROLE_CONFIG[role]
  if (!config) return false
  return config.nav.includes(base) || (config.allow ?? []).includes(base)
}

// サーバーから全データを取得して AppState を更新する（非同期）
export async function refreshState() {
  try {
    const { deals, users, depts, activities, targets, settings } = await fetchAllData()
    AppState.deals      = deals      ?? []
    AppState.users      = users      ?? []
    AppState.depts      = depts      ?? []
    AppState.activities = activities ?? []
    AppState.targets    = targets    ?? { dept: {}, rep: {} }
    AppState.lockConfig = settings?.lockConfig ?? DEFAULT_LOCK_CONFIG
    AppState.settings   = settings  ?? AppState.settings
    AppState.bantItems  = getBantItems(settings?.bantPreset)
    AppState.phaseItems = getPhaseItems(settings?.phasePreset)
  } catch (e) {
    console.error('refreshState failed:', e)
  }
}

// ログイン後に呼ばれる（login.js から）
export async function login(user) {
  AppState.currentUser = user
  await refreshState()
  updateHeader()
  const config = ROLE_CONFIG[user.role]
  navigate(config ? config.defaultHash : '#login')
}

async function logout() {
  await logoutAPI()
  AppState.currentUser = null
  navigate('#login')
}

async function route() {
  const hash = location.hash || '#login'
  AppState.currentHash = hash
  const root = document.getElementById('app-root')

  if (hash === '#login') {
    if (AppState.currentUser) {
      const config = ROLE_CONFIG[AppState.currentUser.role]
      navigate(config ? config.defaultHash : '#my')
      return
    }
    updateHeader()
    root.innerHTML = ''
    renderLogin(root)
    return
  }

  if (hash === '#lp')         { updateHeader(); root.innerHTML = ''; renderLp(root);        return }
  if (hash === '#lp-sales')   { updateHeader(); root.innerHTML = ''; renderLpSales(root);   return }
  if (hash === '#lp-manager') { updateHeader(); root.innerHTML = ''; renderLpManager(root); return }

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

  await refreshState()
  root.innerHTML = ''

  switch (base) {
    case '#my':        renderMy(root);            break
    case '#deal':      renderDeal(root, hash);     break
    case '#kanban':    renderKanban(root);          break
    case '#forecast':  renderForecast(root);        break
    case '#dashboard': renderDashboard(root);       break
    case '#master':    renderMaster(root);          break
    case '#coach':     renderCoach(root);           break
    default: root.innerHTML = '<p class="not-found">ページが見つかりません</p>'
  }
}

function navigate(hash) {
  location.hash = hash
}

function updateHeader() {
  const header  = document.getElementById('app-header')
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
    .map(h => `<a href="${h}" class="nav-link"><span class="nav-icon">${NAV_ICONS[h]}</span><span class="nav-label">${NAV_LABELS[h]}</span></a>`)
    .join('')

  const introLink = document.getElementById('header-intro-link')
  if (AppState.currentUser.role === 'manager') {
    introLink.classList.remove('hidden')
  } else {
    introLink.classList.add('hidden')
  }
}

async function init() {
  AppState.currentUser = await loadCurrentUser()
  if (AppState.currentUser) {
    await refreshState()
  }
  updateHeader()

  document.getElementById('logout-btn').addEventListener('click', logout)

  const userMenuBtn = document.getElementById('user-menu-btn')
  const userMenuDropdown = document.getElementById('user-menu-dropdown')
  userMenuBtn.addEventListener('click', e => {
    e.stopPropagation()
    const open = userMenuDropdown.classList.toggle('open')
    userMenuBtn.setAttribute('aria-expanded', String(open))
  })
  document.addEventListener('click', () => {
    userMenuDropdown.classList.remove('open')
    userMenuBtn.setAttribute('aria-expanded', 'false')
  })

  window.addEventListener('hashchange', () => route())

  route()
}

window._navigate = navigate

init()
