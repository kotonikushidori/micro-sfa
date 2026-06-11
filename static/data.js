// data.js: API クライアント層。localStorage を廃止し、すべてサーバー API と通信する。
// fetch は全て async/await。呼び出し側は await を付けること。

const API = '/api'

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

// ---------- Auth ----------

export async function loginAPI(name, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, password }),
  })
}

export async function logoutAPI() {
  return apiFetch('/auth/logout', { method: 'POST' })
}

export async function loadCurrentUser() {
  try {
    return await apiFetch('/me')
  } catch {
    return null
  }
}

// ---------- 全データ一括取得（refreshState 用）----------

export async function fetchAllData() {
  const [deals, users, depts, activities, targets, settings] = await Promise.all([
    apiFetch('/deals'),
    apiFetch('/users'),
    apiFetch('/depts'),
    apiFetch('/activities'),
    apiFetch('/targets'),
    apiFetch('/settings'),
  ])
  return { deals, users, depts, activities, targets, settings }
}

// ---------- Deals ----------

export async function createDeal(deal) {
  return apiFetch('/deals', { method: 'POST', body: JSON.stringify(deal) })
}

export async function updateDeal(deal) {
  return apiFetch(`/deals/${deal.id}`, { method: 'PUT', body: JSON.stringify(deal) })
}

// ---------- Users ----------

export async function createUser(user) {
  return apiFetch('/users', { method: 'POST', body: JSON.stringify(user) })
}

export async function updateUser(user) {
  return apiFetch(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify(user) })
}

// ---------- Depts ----------

export async function createDept(dept) {
  return apiFetch('/depts', { method: 'POST', body: JSON.stringify(dept) })
}

export async function updateDept(dept) {
  return apiFetch(`/depts/${dept.id}`, { method: 'PUT', body: JSON.stringify(dept) })
}

// ---------- Activities ----------

export async function appendActivity(activity) {
  return apiFetch('/activities', { method: 'POST', body: JSON.stringify(activity) })
}

// deal_id クエリ付きで取得（AppState.activities からフィルタして返すだけでも可）
export function loadActivitiesByDeal(dealId) {
  // AppState はここからはアクセスできないため、呼び出し側で AppState.activities を参照する
  // この関数は後方互換のために残す（deal.js, coach.js が使用）
  throw new Error('loadActivitiesByDeal は廃止。AppState.activities.filter() を使ってください。')
}

// ---------- Targets ----------

export async function saveDeptTarget(deptId, quarterKey, amount) {
  return apiFetch('/targets', {
    method: 'PUT',
    body: JSON.stringify({ target_type: 'dept', entity_id: deptId, quarter_key: quarterKey, amount }),
  })
}

export async function saveRepTarget(userId, quarterKey, amount) {
  return apiFetch('/targets', {
    method: 'PUT',
    body: JSON.stringify({ target_type: 'rep', entity_id: userId, quarter_key: quarterKey, amount }),
  })
}

// ---------- Settings ----------

export async function saveSettings(settings) {
  return apiFetch('/settings', { method: 'PUT', body: JSON.stringify(settings) })
}

export async function saveLockConfig(lockConfig) {
  const current = await apiFetch('/settings')
  return apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify({ ...current, lockConfig }),
  })
}
