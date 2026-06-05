// data.js: localStorage CRUD のみ。描画コードは一切含まない。
// キー名を定数化することで、将来的なバックエンド移行時の変更箇所を最小化する。

export const STORAGE_KEYS = {
  DEALS:        'sfa_deals',
  USERS:        'sfa_users',
  DEPTS:        'sfa_depts',
  CURRENT_USER: 'sfa_current_user',
  LOCK_CONFIG:  'sfa_lock_config',
  ACTIVITIES:   'sfa_activities',
  TARGETS:      'sfa_targets',
  SETTINGS:     'sfa_settings',
}

// ---------- Deals ----------

export function loadDeals() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.DEALS) || '[]')
}

export function saveDeals(deals) {
  localStorage.setItem(STORAGE_KEYS.DEALS, JSON.stringify(deals))
}

export function createDeal(deal) {
  const deals = loadDeals()
  deals.push(deal)
  saveDeals(deals)
}

export function updateDeal(updated) {
  const deals = loadDeals().map(d => d.id === updated.id ? updated : d)
  saveDeals(deals)
}

// ---------- Users ----------

export function loadUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]')
}

export function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users))
}

export function createUser(user) {
  const users = loadUsers()
  users.push(user)
  saveUsers(users)
}

export function updateUser(updated) {
  const users = loadUsers().map(u => u.id === updated.id ? updated : u)
  saveUsers(users)
}

// ---------- Depts ----------

export function loadDepts() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.DEPTS) || '[]')
}

export function saveDepts(depts) {
  localStorage.setItem(STORAGE_KEYS.DEPTS, JSON.stringify(depts))
}

export function createDept(dept) {
  const depts = loadDepts()
  depts.push(dept)
  saveDepts(depts)
}

export function updateDept(updated) {
  const depts = loadDepts().map(d => d.id === updated.id ? updated : d)
  saveDepts(depts)
}

// ---------- Activities（append-only）----------
// 削除・上書きは行わない。誤記訂正は新しいメモレコードで対応する。

export function loadActivities() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES) || '[]')
}

export function appendActivity(activity) {
  const activities = loadActivities()
  activities.push(activity)
  localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities))
}

export function loadActivitiesByDeal(dealId) {
  return loadActivities()
    .filter(a => a.deal_id === dealId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// initDemoData 専用。通常の書き込みは appendActivity を使う。
function _bulkSaveActivities(activities) {
  localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities))
}

// ---------- Lock Config ----------

export function loadLockConfig() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCK_CONFIG) || 'null')
}

export function saveLockConfig(cfg) {
  localStorage.setItem(STORAGE_KEYS.LOCK_CONFIG, JSON.stringify(cfg))
}

// ---------- Settings ----------
// { fiscalStartMonth: 4 }  ← 1〜12、デフォルト4（4月始まり＝3月決算）

export function loadSettings() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{"fiscalStartMonth":4}')
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
}

// ---------- Targets ----------
// { dept: { dept_id: { 'FY2026-Q1': amount } }, rep: { user_id: { 'FY2026-Q1': amount } } }

export function loadTargets() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.TARGETS) || '{"dept":{},"rep":{}}')
}

export function saveDeptTarget(deptId, quarterKey, amount) {
  const t = loadTargets()
  if (!t.dept[deptId]) t.dept[deptId] = {}
  if (amount > 0) t.dept[deptId][quarterKey] = amount
  else delete t.dept[deptId][quarterKey]
  localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(t))
}

export function saveRepTarget(userId, quarterKey, amount) {
  const t = loadTargets()
  if (!t.rep[userId]) t.rep[userId] = {}
  if (amount > 0) t.rep[userId][quarterKey] = amount
  else delete t.rep[userId][quarterKey]
  localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(t))
}

// ---------- Current User (Session) ----------

export function loadCurrentUser() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'null')
}

export function saveCurrentUser(user) {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user))
}

export function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
}

// ---------- Demo Data ----------

// SHA-256('demo1234') の事前計算値
const DEMO_PASSWORD_HASH = '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d'

export function initDemoData() {
  // ユーザーが独自に追加したデータがある場合はスキップ
  const hasCustomData = loadUsers().some(u => !u.id.startsWith('user_'))
  if (hasCustomData) return

  // デモデータを毎回リセット（常に最新のデモ状態を保証）
  localStorage.removeItem(STORAGE_KEYS.DEALS)
  localStorage.removeItem(STORAGE_KEYS.USERS)
  localStorage.removeItem(STORAGE_KEYS.DEPTS)
  localStorage.removeItem(STORAGE_KEYS.ACTIVITIES)
  localStorage.removeItem(STORAGE_KEYS.TARGETS)

  const now = new Date().toISOString()

  const depts = [
    { id: 'dept_01', name: '東日本営業部', isActive: true, createdAt: now },
    { id: 'dept_02', name: '西日本営業部', isActive: true, createdAt: now },
    { id: 'dept_03', name: '中部営業部',   isActive: true, createdAt: now },
  ]
  saveDepts(depts)

  const users = [
    // 東日本営業部
    { id: 'user_01', name: '田中 一郎', dept_id: 'dept_01', role: 'sales',     password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    { id: 'user_02', name: '鈴木 花子', dept_id: 'dept_01', role: 'sales',     password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    { id: 'user_03', name: '佐藤 次郎', dept_id: 'dept_01', role: 'sales',     password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    { id: 'user_04', name: '山田 部長', dept_id: 'dept_01', role: 'manager',   password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    // 西日本営業部
    { id: 'user_05', name: '伊藤 三郎', dept_id: 'dept_02', role: 'sales',     password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    { id: 'user_06', name: '渡辺 美咲', dept_id: 'dept_02', role: 'sales',     password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    { id: 'user_07', name: '中村 係長', dept_id: 'dept_02', role: 'manager',   password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    // 中部営業部
    { id: 'user_08', name: '小林 四郎', dept_id: 'dept_03', role: 'sales',     password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    { id: 'user_09', name: '加藤 京子', dept_id: 'dept_03', role: 'sales',     password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    { id: 'user_10', name: '吉田 部長', dept_id: 'dept_03', role: 'manager',   password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    // 全社
    { id: 'user_11', name: '社長',      dept_id: 'dept_01', role: 'executive', password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
    { id: 'user_12', name: 'admin',     dept_id: 'dept_01', role: 'admin',     password: DEMO_PASSWORD_HASH, isActive: true, createdAt: now },
  ]
  saveUsers(users)

  const deals = [
    // Phase 1: ヒアリング完了
    {
      id: 'deal_01', name: 'ABC商事 業務効率化システム', amount: 1200000,
      closeDate: '2026-06-30', assignee_id: 'user_01', dept_id: 'dept_01',
      assignee_name: '田中 一郎', dept_name: '東日本営業部',
      phases: [true, false, false, false], bant: { B: 1, A: 0, N: 1, T: 0 },
      createdAt: '2026-04-01T09:00:00Z', updatedAt: '2026-04-10T14:00:00Z', isWon: false, isLost: false,
    },
    {
      id: 'deal_02', name: 'DEF製造 在庫管理導入', amount: 2800000,
      closeDate: '2026-07-31', assignee_id: 'user_02', dept_id: 'dept_01',
      assignee_name: '鈴木 花子', dept_name: '東日本営業部',
      phases: [true, false, false, false], bant: { B: 2, A: 1, N: 2, T: 0 },
      createdAt: '2026-04-05T10:00:00Z', updatedAt: '2026-04-15T11:00:00Z', isWon: false, isLost: false,
    },
    {
      id: 'deal_03', name: 'GHI小売 POSシステム更改', amount: 980000,
      closeDate: '2026-08-31', assignee_id: 'user_05', dept_id: 'dept_02',
      assignee_name: '伊藤 三郎', dept_name: '西日本営業部',
      phases: [true, false, false, false], bant: { B: 0, A: 1, N: 1, T: 0 },
      createdAt: '2026-04-08T09:30:00Z', updatedAt: '2026-04-12T16:00:00Z', isWon: false, isLost: false,
    },
    // Phase 2: 提案・見積提示
    {
      id: 'deal_04', name: 'JKL物流 配車最適化', amount: 4500000,
      closeDate: '2026-06-15', assignee_id: 'user_03', dept_id: 'dept_01',
      assignee_name: '佐藤 次郎', dept_name: '東日本営業部',
      phases: [true, true, false, false], bant: { B: 2, A: 2, N: 2, T: 1 },
      createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-04-20T10:00:00Z', isWon: false, isLost: false,
    },
    {
      id: 'deal_05', name: 'MNO建設 施工管理DX', amount: 3200000,
      closeDate: '2026-07-15', assignee_id: 'user_06', dept_id: 'dept_02',
      assignee_name: '渡辺 美咲', dept_name: '西日本営業部',
      phases: [true, true, false, false], bant: { B: 1, A: 1, N: 2, T: 1 },
      createdAt: '2026-03-20T11:00:00Z', updatedAt: '2026-04-22T09:00:00Z', isWon: false, isLost: false,
    },
    {
      id: 'deal_06', name: 'PQR医療 電子カルテ連携', amount: 5800000,
      closeDate: '2026-09-30', assignee_id: 'user_08', dept_id: 'dept_03',
      assignee_name: '小林 四郎', dept_name: '中部営業部',
      phases: [true, true, false, false], bant: { B: 1, A: 0, N: 1, T: 0 },
      createdAt: '2026-03-10T13:00:00Z', updatedAt: '2026-04-18T15:00:00Z', isWon: false, isLost: false,
    },
    // Phase 3: 決裁会議日程確定
    {
      id: 'deal_07', name: 'STU銀行 融資審査自動化', amount: 12000000,
      closeDate: '2026-05-31', assignee_id: 'user_01', dept_id: 'dept_01',
      assignee_name: '田中 一郎', dept_name: '東日本営業部',
      phases: [true, true, true, false], bant: { B: 2, A: 2, N: 2, T: 2 },
      createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-04-25T10:00:00Z', isWon: false, isLost: false,
    },
    {
      id: 'deal_08', name: 'VWX流通 SCM刷新', amount: 7600000,
      closeDate: '2026-06-30', assignee_id: 'user_09', dept_id: 'dept_03',
      assignee_name: '加藤 京子', dept_name: '中部営業部',
      // Phase3だがBANT低め→警告バッジ対象
      phases: [true, true, true, false], bant: { B: 1, A: 1, N: 1, T: 0 },
      createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-04-28T11:00:00Z', isWon: false, isLost: false,
    },
    // Phase 4: 内定・リーガルチェック
    {
      id: 'deal_09', name: 'YZA食品 需要予測AI', amount: 9800000,
      closeDate: '2026-05-31', assignee_id: 'user_05', dept_id: 'dept_02',
      assignee_name: '伊藤 三郎', dept_name: '西日本営業部',
      phases: [true, true, true, true], bant: { B: 2, A: 2, N: 2, T: 2 },
      createdAt: '2026-01-15T09:00:00Z', updatedAt: '2026-05-01T14:00:00Z', isWon: false, isLost: false,
    },
    // 受注済み
    {
      id: 'deal_10', name: 'BCD製造 ERP導入', amount: 15000000,
      closeDate: '2026-03-31', assignee_id: 'user_02', dept_id: 'dept_01',
      assignee_name: '鈴木 花子', dept_name: '東日本営業部',
      phases: [true, true, true, true], bant: { B: 2, A: 2, N: 2, T: 2 },
      createdAt: '2025-10-01T09:00:00Z', updatedAt: '2026-03-31T17:00:00Z', isWon: true, isLost: false,
    },
    {
      id: 'deal_11', name: 'EFG物流 車両管理', amount: 4200000,
      closeDate: '2026-04-15', assignee_id: 'user_08', dept_id: 'dept_03',
      assignee_name: '小林 四郎', dept_name: '中部営業部',
      phases: [true, true, true, true], bant: { B: 2, A: 2, N: 1, T: 2 },
      createdAt: '2025-12-01T09:00:00Z', updatedAt: '2026-04-15T17:00:00Z', isWon: true, isLost: false,
    },
    {
      id: 'deal_12', name: 'HIJ小売 ECサイト構築', amount: 3800000,
      closeDate: '2026-02-28', assignee_id: 'user_06', dept_id: 'dept_02',
      assignee_name: '渡辺 美咲', dept_name: '西日本営業部',
      phases: [true, true, true, true], bant: { B: 2, A: 2, N: 2, T: 2 },
      createdAt: '2025-11-01T09:00:00Z', updatedAt: '2026-02-28T17:00:00Z', isWon: true, isLost: false,
    },
    // 田中一郎の追加案件（「自分の傾向」のサンプル表示用）
    // deal_18: Phase 1→2 に70日かかった→速度遅いフェーズとして検出される
    {
      id: 'deal_18', name: 'ZAB保険 基幹システム刷新', amount: 5500000,
      closeDate: '2026-08-31', assignee_id: 'user_01', dept_id: 'dept_01',
      assignee_name: '田中 一郎', dept_name: '東日本営業部',
      phases: [true, true, false, false], bant: { B: 1, A: 0, N: 1, T: 0 },
      createdAt: '2025-12-01T09:00:00Z', updatedAt: '2026-02-18T17:00:00Z', isWon: false, isLost: false,
    },
    // deal_19: 失注（Phase 1）→ 田中の失注パターンを2件にして dominantLossPhase=1 を確定させる
    {
      id: 'deal_19', name: 'BCD不動産 物件管理システム', amount: 1900000,
      closeDate: '2026-02-28', assignee_id: 'user_01', dept_id: 'dept_01',
      assignee_name: '田中 一郎', dept_name: '東日本営業部',
      phases: [true, false, false, false], bant: { B: 0, A: 0, N: 0, T: 0 },
      createdAt: '2026-01-05T09:00:00Z', updatedAt: '2026-02-20T17:00:00Z', isWon: false, isLost: true,
    },
    // 田中一郎 追加50案件（ビュー確認用） deal_20〜deal_69
    // Phase 0 active (5)
    { id:'deal_20', name:'フロンティア商事 CRM導入',      amount:  900000, closeDate:'2026-09-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[false,false,false,false], bant:{B:0,A:0,N:0,T:0}, createdAt:'2026-05-10T09:00:00Z', updatedAt:'2026-05-10T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_21', name:'東洋食品 販売管理刷新',          amount: 1500000, closeDate:'2026-10-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[false,false,false,false], bant:{B:1,A:0,N:0,T:0}, createdAt:'2026-05-08T09:00:00Z', updatedAt:'2026-05-08T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_22', name:'サンライズ運輸 GPS管理',          amount:  700000, closeDate:'2026-09-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[false,false,false,false], bant:{B:0,A:0,N:1,T:0}, createdAt:'2026-05-12T09:00:00Z', updatedAt:'2026-05-12T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_23', name:'丸山建設 工程管理DX',            amount: 2200000, closeDate:'2026-11-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[false,false,false,false], bant:{B:0,A:1,N:0,T:0}, createdAt:'2026-05-06T09:00:00Z', updatedAt:'2026-05-06T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_24', name:'青葉商事 電子帳票',              amount:  500000, closeDate:'2026-08-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[false,false,false,false], bant:{B:0,A:0,N:0,T:1}, createdAt:'2026-05-14T09:00:00Z', updatedAt:'2026-05-14T09:00:00Z', isWon:false, isLost:false },
    // Phase 1 active (10)
    { id:'deal_25', name:'三菱電機商事 購買システム',       amount: 3200000, closeDate:'2026-08-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:1,A:0,N:1,T:0}, createdAt:'2026-03-01T09:00:00Z', updatedAt:'2026-03-10T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_26', name:'ホライゾン製造 品質管理',         amount: 1800000, closeDate:'2026-09-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:0,A:1,N:0,T:1}, createdAt:'2026-03-05T09:00:00Z', updatedAt:'2026-03-15T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_27', name:'太陽電機 設備管理',              amount: 2500000, closeDate:'2026-09-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:1,A:1,N:1,T:0}, createdAt:'2026-03-10T09:00:00Z', updatedAt:'2026-03-20T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_28', name:'海星物流 倉庫管理システム',       amount: 1200000, closeDate:'2026-10-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:0,A:0,N:1,T:1}, createdAt:'2026-03-15T09:00:00Z', updatedAt:'2026-03-25T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_29', name:'桜花病院 電子カルテ連携',         amount: 4500000, closeDate:'2026-10-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:1,A:0,N:0,T:1}, createdAt:'2026-03-20T09:00:00Z', updatedAt:'2026-04-01T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_30', name:'富士通商 EDI連携基盤',           amount: 1600000, closeDate:'2026-09-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:2,A:1,N:1,T:0}, createdAt:'2026-03-25T09:00:00Z', updatedAt:'2026-04-05T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_31', name:'北海道食品 在庫管理DX',           amount:  900000, closeDate:'2026-11-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:1,A:1,N:0,T:0}, createdAt:'2026-04-01T09:00:00Z', updatedAt:'2026-04-12T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_32', name:'神奈川建設 安全管理システム',     amount: 1400000, closeDate:'2026-11-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:0,A:1,N:1,T:1}, createdAt:'2026-04-05T09:00:00Z', updatedAt:'2026-04-15T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_33', name:'旭化成商事 経費精算',            amount:  800000, closeDate:'2026-10-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:1,A:0,N:1,T:0}, createdAt:'2026-04-10T09:00:00Z', updatedAt:'2026-04-20T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_34', name:'セントラル流通 WMS導入',          amount: 3800000, closeDate:'2026-11-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:2,A:0,N:1,T:1}, createdAt:'2026-04-15T09:00:00Z', updatedAt:'2026-04-28T09:00:00Z', isWon:false, isLost:false },
    // Phase 2 active (8)
    { id:'deal_35', name:'東京商事 ERP刷新',               amount: 8500000, closeDate:'2026-08-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:2,A:1,N:2,T:1}, createdAt:'2026-01-10T09:00:00Z', updatedAt:'2026-02-25T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_36', name:'大阪製造 MES導入',               amount: 5200000, closeDate:'2026-09-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:1,A:2,N:1,T:1}, createdAt:'2026-01-15T09:00:00Z', updatedAt:'2026-03-05T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_37', name:'中部物流 TMS導入',               amount: 3600000, closeDate:'2026-09-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:2,A:2,N:2,T:0}, createdAt:'2026-01-20T09:00:00Z', updatedAt:'2026-03-10T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_38', name:'九州電力 保全管理',               amount: 4800000, closeDate:'2026-10-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:1,A:1,N:2,T:1}, createdAt:'2026-02-01T09:00:00Z', updatedAt:'2026-03-20T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_39', name:'西日本鉄道 乗務管理',             amount: 6200000, closeDate:'2026-10-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:2,A:1,N:1,T:2}, createdAt:'2026-02-05T09:00:00Z', updatedAt:'2026-03-25T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_40', name:'近鉄商事 顧客管理CRM',            amount: 2800000, closeDate:'2026-11-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:1,A:1,N:1,T:1}, createdAt:'2026-02-10T09:00:00Z', updatedAt:'2026-04-01T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_41', name:'四国製紙 生産管理',               amount: 4100000, closeDate:'2026-09-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:2,A:2,N:1,T:0}, createdAt:'2026-02-15T09:00:00Z', updatedAt:'2026-04-08T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_42', name:'東北農業 農場管理システム',       amount: 1900000, closeDate:'2026-10-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:1,A:1,N:1,T:1}, createdAt:'2026-02-20T09:00:00Z', updatedAt:'2026-04-15T09:00:00Z', isWon:false, isLost:false },
    // Phase 3 active (5)
    { id:'deal_43', name:'首都圏銀行 融資審査システム',     amount:15000000, closeDate:'2026-07-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,false], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-11-01T09:00:00Z', updatedAt:'2026-01-25T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_44', name:'関東保険 保険金管理',             amount: 9800000, closeDate:'2026-07-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,false], bant:{B:2,A:2,N:2,T:1}, createdAt:'2025-11-15T09:00:00Z', updatedAt:'2026-02-15T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_45', name:'中京自動車 ディーラー管理',       amount: 7200000, closeDate:'2026-08-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,false], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-12-01T09:00:00Z', updatedAt:'2026-03-01T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_46', name:'阪神流通 物流最適化',             amount:11000000, closeDate:'2026-07-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,false], bant:{B:2,A:2,N:2,T:1}, createdAt:'2025-12-10T09:00:00Z', updatedAt:'2026-03-15T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_47', name:'名古屋製造 品質DX',               amount: 6500000, closeDate:'2026-08-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,false], bant:{B:2,A:2,N:1,T:2}, createdAt:'2026-01-05T09:00:00Z', updatedAt:'2026-04-01T09:00:00Z', isWon:false, isLost:false },
    // Phase 4 active (2)
    { id:'deal_48', name:'関西電機 ERP全面刷新',            amount:18000000, closeDate:'2026-06-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-09-01T09:00:00Z', updatedAt:'2026-01-05T09:00:00Z', isWon:false, isLost:false },
    { id:'deal_49', name:'北陸商社 グループ統合基盤',       amount:22000000, closeDate:'2026-07-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-09-15T09:00:00Z', updatedAt:'2026-02-01T09:00:00Z', isWon:false, isLost:false },
    // 受注済み (10)
    { id:'deal_50', name:'渋谷IT 社内ポータル構築',         amount: 3200000, closeDate:'2026-01-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-10-01T09:00:00Z', updatedAt:'2026-01-30T09:00:00Z', isWon:true,  isLost:false },
    { id:'deal_51', name:'横浜物流 3PL管理システム',         amount: 5800000, closeDate:'2026-02-28', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-10-15T09:00:00Z', updatedAt:'2026-02-20T09:00:00Z', isWon:true,  isLost:false },
    { id:'deal_52', name:'千葉製造 スマート工場DX',          amount:12000000, closeDate:'2026-03-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-11-01T09:00:00Z', updatedAt:'2026-03-05T09:00:00Z', isWon:true,  isLost:false },
    { id:'deal_53', name:'埼玉建設 原価管理システム',        amount: 4500000, closeDate:'2026-03-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-11-15T09:00:00Z', updatedAt:'2026-03-20T09:00:00Z', isWon:true,  isLost:false },
    { id:'deal_54', name:'栃木食品 トレーサビリティ',        amount: 2800000, closeDate:'2026-04-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-12-01T09:00:00Z', updatedAt:'2026-03-25T09:00:00Z', isWon:true,  isLost:false },
    { id:'deal_55', name:'群馬化学 品質管理システム',        amount: 6200000, closeDate:'2026-04-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-12-10T09:00:00Z', updatedAt:'2026-04-05T09:00:00Z', isWon:true,  isLost:false },
    { id:'deal_56', name:'茨城農産 生産計画システム',        amount: 3500000, closeDate:'2026-04-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2026-01-05T09:00:00Z', updatedAt:'2026-04-30T09:00:00Z', isWon:true,  isLost:false },
    { id:'deal_57', name:'長野精密 生産管理DX',              amount: 4800000, closeDate:'2026-05-10', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2026-01-10T09:00:00Z', updatedAt:'2026-05-01T09:00:00Z', isWon:true,  isLost:false },
    { id:'deal_58', name:'山梨観光 予約管理システム',        amount: 2200000, closeDate:'2026-05-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2026-01-20T09:00:00Z', updatedAt:'2026-05-10T09:00:00Z', isWon:true,  isLost:false },
    { id:'deal_59', name:'静岡製薬 薬品管理システム',        amount: 9500000, closeDate:'2026-01-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,true], bant:{B:2,A:2,N:2,T:2}, createdAt:'2025-09-15T09:00:00Z', updatedAt:'2026-01-15T09:00:00Z', isWon:true,  isLost:false },
    // 失注済み (10)
    { id:'deal_60', name:'沖縄観光 予約DX',                 amount: 1800000, closeDate:'2026-04-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:0,A:0,N:1,T:0}, createdAt:'2026-02-01T09:00:00Z', updatedAt:'2026-03-15T09:00:00Z', isWon:false, isLost:true },
    { id:'deal_61', name:'鹿児島食品 販売管理',              amount: 2200000, closeDate:'2026-04-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:1,A:0,N:0,T:0}, createdAt:'2026-02-05T09:00:00Z', updatedAt:'2026-03-20T09:00:00Z', isWon:false, isLost:true },
    { id:'deal_62', name:'宮崎農業 農場管理',                amount: 1500000, closeDate:'2026-04-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:0,A:1,N:0,T:0}, createdAt:'2026-02-10T09:00:00Z', updatedAt:'2026-03-25T09:00:00Z', isWon:false, isLost:true },
    { id:'deal_63', name:'熊本製造 品質管理',                amount: 3200000, closeDate:'2026-04-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:0,A:0,N:0,T:1}, createdAt:'2026-02-15T09:00:00Z', updatedAt:'2026-04-01T09:00:00Z', isWon:false, isLost:true },
    { id:'deal_64', name:'長崎造船 工程管理',                amount: 4800000, closeDate:'2026-04-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:1,A:0,N:1,T:0}, createdAt:'2025-12-01T09:00:00Z', updatedAt:'2026-02-15T09:00:00Z', isWon:false, isLost:true },
    { id:'deal_65', name:'佐賀電機 設備管理',                amount: 2600000, closeDate:'2026-03-31', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:0,A:1,N:0,T:1}, createdAt:'2025-12-10T09:00:00Z', updatedAt:'2026-02-01T09:00:00Z', isWon:false, isLost:true },
    { id:'deal_66', name:'福岡商事 購買管理',                amount: 3900000, closeDate:'2026-04-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,false,false], bant:{B:1,A:0,N:1,T:1}, createdAt:'2025-12-15T09:00:00Z', updatedAt:'2026-02-20T09:00:00Z', isWon:false, isLost:true },
    { id:'deal_67', name:'大分石油 在庫管理',                amount: 5200000, closeDate:'2026-04-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,false], bant:{B:1,A:1,N:1,T:0}, createdAt:'2025-11-01T09:00:00Z', updatedAt:'2026-02-01T09:00:00Z', isWon:false, isLost:true },
    { id:'deal_68', name:'愛媛製紙 生産管理',                amount: 4100000, closeDate:'2026-04-30', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,true,true,false], bant:{B:2,A:1,N:1,T:1}, createdAt:'2025-11-10T09:00:00Z', updatedAt:'2026-02-15T09:00:00Z', isWon:false, isLost:true },
    { id:'deal_69', name:'香川水産 トレーサビリティ',        amount: 2800000, closeDate:'2026-04-15', assignee_id:'user_01', dept_id:'dept_01', assignee_name:'田中 一郎', dept_name:'東日本営業部', phases:[true,false,false,false], bant:{B:0,A:0,N:1,T:1}, createdAt:'2026-03-01T09:00:00Z', updatedAt:'2026-04-10T09:00:00Z', isWon:false, isLost:true },
    // 失注済み（フェーズ別失注分析のためのデモデータ）
    {
      id: 'deal_13', name: 'KLM製造 生産管理システム', amount: 2200000,
      closeDate: '2026-03-31', assignee_id: 'user_01', dept_id: 'dept_01',
      assignee_name: '田中 一郎', dept_name: '東日本営業部',
      phases: [true, false, false, false], bant: { B: 0, A: 0, N: 1, T: 0 },
      createdAt: '2026-01-20T09:00:00Z', updatedAt: '2026-03-01T17:00:00Z', isWon: false, isLost: true,
    },
    {
      id: 'deal_14', name: 'NOP商社 購買管理DX', amount: 3600000,
      closeDate: '2026-04-30', assignee_id: 'user_03', dept_id: 'dept_01',
      assignee_name: '佐藤 次郎', dept_name: '東日本営業部',
      phases: [true, true, false, false], bant: { B: 1, A: 0, N: 1, T: 0 },
      createdAt: '2025-12-01T09:00:00Z', updatedAt: '2026-03-10T17:00:00Z', isWon: false, isLost: true,
    },
    {
      id: 'deal_15', name: 'QRS運輸 配車システム', amount: 1800000,
      closeDate: '2026-03-31', assignee_id: 'user_05', dept_id: 'dept_02',
      assignee_name: '伊藤 三郎', dept_name: '西日本営業部',
      phases: [true, false, false, false], bant: { B: 1, A: 0, N: 0, T: 0 },
      createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-03-15T17:00:00Z', isWon: false, isLost: true,
    },
    {
      id: 'deal_16', name: 'TUV建設 安全管理導入', amount: 2900000,
      closeDate: '2026-04-30', assignee_id: 'user_06', dept_id: 'dept_02',
      assignee_name: '渡辺 美咲', dept_name: '西日本営業部',
      phases: [true, true, false, false], bant: { B: 1, A: 0, N: 1, T: 0 },
      createdAt: '2025-11-15T09:00:00Z', updatedAt: '2026-03-20T17:00:00Z', isWon: false, isLost: true,
    },
    {
      id: 'deal_17', name: 'WXY医療 予約システム', amount: 1500000,
      closeDate: '2026-03-31', assignee_id: 'user_09', dept_id: 'dept_03',
      assignee_name: '加藤 京子', dept_name: '中部営業部',
      phases: [true, false, false, false], bant: { B: 0, A: 1, N: 0, T: 0 },
      createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-25T17:00:00Z', isWon: false, isLost: true,
    },
  ]
  saveDeals(deals)

  // Phase変更履歴（コーチング分析用）
  // [id, deal_id, type, date, content, author_id, author_name] の短縮形から生成する
  const actRows = [
    // deal_01 (user_01)
    ['act_d01a', 'deal_01', 'phase_change', '2026-04-06', '▲ Phase 0 → Phase 1', 'user_01', '田中 一郎'],
    // deal_02 (user_02)
    ['act_d02a', 'deal_02', 'phase_change', '2026-04-12', '▲ Phase 0 → Phase 1', 'user_02', '鈴木 花子'],
    // deal_03 (user_05)
    ['act_d03a', 'deal_03', 'phase_change', '2026-04-13', '▲ Phase 0 → Phase 1', 'user_05', '伊藤 三郎'],
    // deal_04 (user_03) Phase 1→2
    ['act_d04a', 'deal_04', 'phase_change', '2026-03-20', '▲ Phase 0 → Phase 1', 'user_03', '佐藤 次郎'],
    ['act_d04b', 'deal_04', 'phase_change', '2026-04-09', '▲ Phase 1 → Phase 2', 'user_03', '佐藤 次郎'],
    // deal_05 (user_06)
    ['act_d05a', 'deal_05', 'phase_change', '2026-03-27', '▲ Phase 0 → Phase 1', 'user_06', '渡辺 美咲'],
    ['act_d05b', 'deal_05', 'phase_change', '2026-04-22', '▲ Phase 1 → Phase 2', 'user_06', '渡辺 美咲'],
    // deal_06 (user_08)
    ['act_d06a', 'deal_06', 'phase_change', '2026-03-22', '▲ Phase 0 → Phase 1', 'user_08', '小林 四郎'],
    ['act_d06b', 'deal_06', 'phase_change', '2026-04-20', '▲ Phase 1 → Phase 2', 'user_08', '小林 四郎'],
    // deal_07 (user_01) Phase 1→2→3
    ['act_d07a', 'deal_07', 'phase_change', '2026-02-06', '▲ Phase 0 → Phase 1', 'user_01', '田中 一郎'],
    ['act_d07b', 'deal_07', 'phase_change', '2026-02-20', '▲ Phase 1 → Phase 2', 'user_01', '田中 一郎'],
    ['act_d07c', 'deal_07', 'phase_change', '2026-03-22', '▲ Phase 2 → Phase 3', 'user_01', '田中 一郎'],
    // deal_08 (user_09) Phase 1→2→3（BANT低・警告）
    ['act_d08a', 'deal_08', 'phase_change', '2026-02-25', '▲ Phase 0 → Phase 1', 'user_09', '加藤 京子'],
    ['act_d08b', 'deal_08', 'phase_change', '2026-03-18', '▲ Phase 1 → Phase 2', 'user_09', '加藤 京子'],
    ['act_d08c', 'deal_08', 'phase_change', '2026-04-25', '▲ Phase 2 → Phase 3', 'user_09', '加藤 京子'],
    // deal_09 (user_05) Phase 1→2→3→4
    ['act_d09a', 'deal_09', 'phase_change', '2026-01-20', '▲ Phase 0 → Phase 1', 'user_05', '伊藤 三郎'],
    ['act_d09b', 'deal_09', 'phase_change', '2026-02-03', '▲ Phase 1 → Phase 2', 'user_05', '伊藤 三郎'],
    ['act_d09c', 'deal_09', 'phase_change', '2026-02-26', '▲ Phase 2 → Phase 3', 'user_05', '伊藤 三郎'],
    ['act_d09d', 'deal_09', 'phase_change', '2026-03-24', '▲ Phase 3 → Phase 4', 'user_05', '伊藤 三郎'],
    // deal_10 受注済み (user_02)
    ['act_d10a', 'deal_10', 'phase_change', '2025-10-08', '▲ Phase 0 → Phase 1', 'user_02', '鈴木 花子'],
    ['act_d10b', 'deal_10', 'phase_change', '2025-10-30', '▲ Phase 1 → Phase 2', 'user_02', '鈴木 花子'],
    ['act_d10c', 'deal_10', 'phase_change', '2025-11-27', '▲ Phase 2 → Phase 3', 'user_02', '鈴木 花子'],
    ['act_d10d', 'deal_10', 'phase_change', '2026-01-01', '▲ Phase 3 → Phase 4', 'user_02', '鈴木 花子'],
    // deal_11 受注済み (user_08)
    ['act_d11a', 'deal_11', 'phase_change', '2025-12-07', '▲ Phase 0 → Phase 1', 'user_08', '小林 四郎'],
    ['act_d11b', 'deal_11', 'phase_change', '2025-12-26', '▲ Phase 1 → Phase 2', 'user_08', '小林 四郎'],
    ['act_d11c', 'deal_11', 'phase_change', '2026-01-16', '▲ Phase 2 → Phase 3', 'user_08', '小林 四郎'],
    ['act_d11d', 'deal_11', 'phase_change', '2026-02-13', '▲ Phase 3 → Phase 4', 'user_08', '小林 四郎'],
    // deal_12 受注済み (user_06)
    ['act_d12a', 'deal_12', 'phase_change', '2025-11-08', '▲ Phase 0 → Phase 1', 'user_06', '渡辺 美咲'],
    ['act_d12b', 'deal_12', 'phase_change', '2025-12-01', '▲ Phase 1 → Phase 2', 'user_06', '渡辺 美咲'],
    ['act_d12c', 'deal_12', 'phase_change', '2025-12-22', '▲ Phase 2 → Phase 3', 'user_06', '渡辺 美咲'],
    ['act_d12d', 'deal_12', 'phase_change', '2026-01-21', '▲ Phase 3 → Phase 4', 'user_06', '渡辺 美咲'],
    // 田中一郎 追加案件（deal_18: Phase 1→2 に70日、deal_19: 失注）
    ['act_d18a', 'deal_18', 'phase_change', '2025-12-10', '▲ Phase 0 → Phase 1', 'user_01', '田中 一郎'],
    ['act_d18b', 'deal_18', 'phase_change', '2026-02-18', '▲ Phase 1 → Phase 2', 'user_01', '田中 一郎'],
    ['act_d18m', 'deal_18', 'memo',         '2026-01-20', '保険会社特有の稟議フローで承認に時間がかかっている。担当者も動きづらそう。', 'user_01', '田中 一郎'],
    ['act_d19a', 'deal_19', 'phase_change', '2026-01-12', '▲ Phase 0 → Phase 1', 'user_01', '田中 一郎'],
    // 失注案件
    ['act_d13a', 'deal_13', 'phase_change', '2026-01-26', '▲ Phase 0 → Phase 1', 'user_01', '田中 一郎'],
    ['act_d14a', 'deal_14', 'phase_change', '2025-12-08', '▲ Phase 0 → Phase 1', 'user_03', '佐藤 次郎'],
    ['act_d14b', 'deal_14', 'phase_change', '2025-12-29', '▲ Phase 1 → Phase 2', 'user_03', '佐藤 次郎'],
    ['act_d15a', 'deal_15', 'phase_change', '2026-02-07', '▲ Phase 0 → Phase 1', 'user_05', '伊藤 三郎'],
    ['act_d16a', 'deal_16', 'phase_change', '2025-11-22', '▲ Phase 0 → Phase 1', 'user_06', '渡辺 美咲'],
    ['act_d16b', 'deal_16', 'phase_change', '2025-12-15', '▲ Phase 1 → Phase 2', 'user_06', '渡辺 美咲'],
    ['act_d17a', 'deal_17', 'phase_change', '2026-01-17', '▲ Phase 0 → Phase 1', 'user_09', '加藤 京子'],
    // 田中一郎 追加50案件の Phase 変更ログ
    ['act_d25a','deal_25','phase_change','2026-03-10','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d26a','deal_26','phase_change','2026-03-15','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d27a','deal_27','phase_change','2026-03-20','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d28a','deal_28','phase_change','2026-03-25','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d29a','deal_29','phase_change','2026-04-01','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d30a','deal_30','phase_change','2026-04-05','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d31a','deal_31','phase_change','2026-04-12','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d32a','deal_32','phase_change','2026-04-15','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d33a','deal_33','phase_change','2026-04-20','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d34a','deal_34','phase_change','2026-04-28','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d35a','deal_35','phase_change','2026-01-18','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d35b','deal_35','phase_change','2026-02-25','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d36a','deal_36','phase_change','2026-01-25','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d36b','deal_36','phase_change','2026-03-05','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d37a','deal_37','phase_change','2026-02-01','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d37b','deal_37','phase_change','2026-03-10','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d38a','deal_38','phase_change','2026-02-12','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d38b','deal_38','phase_change','2026-03-20','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d39a','deal_39','phase_change','2026-02-15','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d39b','deal_39','phase_change','2026-03-25','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d40a','deal_40','phase_change','2026-02-22','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d40b','deal_40','phase_change','2026-04-01','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d41a','deal_41','phase_change','2026-02-28','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d41b','deal_41','phase_change','2026-04-08','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d42a','deal_42','phase_change','2026-03-05','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d42b','deal_42','phase_change','2026-04-15','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d43a','deal_43','phase_change','2025-11-10','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d43b','deal_43','phase_change','2025-12-15','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d43c','deal_43','phase_change','2026-01-25','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d44a','deal_44','phase_change','2025-11-25','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d44b','deal_44','phase_change','2026-01-05','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d44c','deal_44','phase_change','2026-02-15','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d45a','deal_45','phase_change','2025-12-12','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d45b','deal_45','phase_change','2026-01-20','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d45c','deal_45','phase_change','2026-03-01','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d46a','deal_46','phase_change','2025-12-22','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d46b','deal_46','phase_change','2026-02-01','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d46c','deal_46','phase_change','2026-03-15','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d47a','deal_47','phase_change','2026-01-15','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d47b','deal_47','phase_change','2026-02-20','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d47c','deal_47','phase_change','2026-04-01','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d48a','deal_48','phase_change','2025-09-10','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d48b','deal_48','phase_change','2025-10-15','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d48c','deal_48','phase_change','2025-11-25','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d48d','deal_48','phase_change','2026-01-05','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d49a','deal_49','phase_change','2025-09-25','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d49b','deal_49','phase_change','2025-11-05','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d49c','deal_49','phase_change','2025-12-20','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d49d','deal_49','phase_change','2026-02-01','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d50a','deal_50','phase_change','2025-10-10','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d50b','deal_50','phase_change','2025-11-15','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d50c','deal_50','phase_change','2025-12-25','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d50d','deal_50','phase_change','2026-01-30','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d51a','deal_51','phase_change','2025-10-25','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d51b','deal_51','phase_change','2025-12-05','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d51c','deal_51','phase_change','2026-01-15','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d51d','deal_51','phase_change','2026-02-20','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d52a','deal_52','phase_change','2025-11-12','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d52b','deal_52','phase_change','2025-12-20','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d52c','deal_52','phase_change','2026-01-30','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d52d','deal_52','phase_change','2026-03-05','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d53a','deal_53','phase_change','2025-11-25','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d53b','deal_53','phase_change','2026-01-05','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d53c','deal_53','phase_change','2026-02-15','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d53d','deal_53','phase_change','2026-03-20','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d54a','deal_54','phase_change','2025-12-10','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d54b','deal_54','phase_change','2026-01-15','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d54c','deal_54','phase_change','2026-02-20','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d54d','deal_54','phase_change','2026-03-25','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d55a','deal_55','phase_change','2025-12-20','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d55b','deal_55','phase_change','2026-01-25','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d55c','deal_55','phase_change','2026-03-01','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d55d','deal_55','phase_change','2026-04-05','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d56a','deal_56','phase_change','2026-01-15','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d56b','deal_56','phase_change','2026-02-20','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d56c','deal_56','phase_change','2026-03-28','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d56d','deal_56','phase_change','2026-04-30','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d57a','deal_57','phase_change','2026-01-20','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d57b','deal_57','phase_change','2026-02-25','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d57c','deal_57','phase_change','2026-04-01','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d57d','deal_57','phase_change','2026-05-01','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d58a','deal_58','phase_change','2026-02-01','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d58b','deal_58','phase_change','2026-03-08','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d58c','deal_58','phase_change','2026-04-12','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d58d','deal_58','phase_change','2026-05-10','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d59a','deal_59','phase_change','2025-09-25','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d59b','deal_59','phase_change','2025-11-01','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d59c','deal_59','phase_change','2025-12-10','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d59d','deal_59','phase_change','2026-01-15','▲ Phase 3 → Phase 4','user_01','田中 一郎'],
    ['act_d60a','deal_60','phase_change','2026-02-10','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d61a','deal_61','phase_change','2026-02-15','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d62a','deal_62','phase_change','2026-02-20','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d63a','deal_63','phase_change','2026-02-25','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d64a','deal_64','phase_change','2025-12-10','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d64b','deal_64','phase_change','2026-01-15','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d65a','deal_65','phase_change','2025-12-20','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d65b','deal_65','phase_change','2026-01-25','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d66a','deal_66','phase_change','2025-12-25','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d66b','deal_66','phase_change','2026-02-01','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d67a','deal_67','phase_change','2025-11-12','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d67b','deal_67','phase_change','2025-12-18','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d67c','deal_67','phase_change','2026-01-28','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d68a','deal_68','phase_change','2025-11-22','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    ['act_d68b','deal_68','phase_change','2025-12-28','▲ Phase 1 → Phase 2','user_01','田中 一郎'],
    ['act_d68c','deal_68','phase_change','2026-02-07','▲ Phase 2 → Phase 3','user_01','田中 一郎'],
    ['act_d69a','deal_69','phase_change','2026-03-10','▲ Phase 0 → Phase 1','user_01','田中 一郎'],
    // 期日後ろ倒しデモデータ（close_date_change）
    // deal_07 は3回期ずれ → 停滞アラートと診断カードで danger バッジ表示
    ['act_push01', 'deal_07', 'close_date_change', '2025-12-31', '📅 想定受注日 2026-01-31 → 2026-03-31', 'user_01', '田中 一郎'],
    ['act_push02', 'deal_07', 'close_date_change', '2026-03-01', '📅 想定受注日 2026-03-31 → 2026-04-30', 'user_01', '田中 一郎'],
    ['act_push03', 'deal_07', 'close_date_change', '2026-04-15', '📅 想定受注日 2026-04-30 → 2026-05-31', 'user_01', '田中 一郎'],
    // deal_18 は2回期ずれ → warn バッジ
    ['act_push04', 'deal_18', 'close_date_change', '2026-03-15', '📅 想定受注日 2026-06-30 → 2026-07-31', 'user_01', '田中 一郎'],
    ['act_push05', 'deal_18', 'close_date_change', '2026-04-30', '📅 想定受注日 2026-07-31 → 2026-08-31', 'user_01', '田中 一郎'],
    // deal_01 は1回期ずれ
    ['act_push06', 'deal_01', 'close_date_change', '2026-04-20', '📅 想定受注日 2026-05-31 → 2026-06-30', 'user_01', '田中 一郎'],
    // deal_43 は1回期ずれ（大型Phase3案件）
    ['act_push07', 'deal_43', 'close_date_change', '2026-04-01', '📅 想定受注日 2026-06-30 → 2026-07-31', 'user_01', '田中 一郎'],
    // 手動活動ログ（リアリティ用）
    ['act_m01', 'deal_07', 'visit',   '2026-03-05', '決裁会議の事前説明。CFO同席。予算確保の確認取れた。', 'user_01', '田中 一郎'],
    ['act_m02', 'deal_07', 'call',    '2026-03-15', '担当者フォローコール。決裁会議は3/22に確定。', 'user_01', '田中 一郎'],
    ['act_m03', 'deal_09', 'visit',   '2026-03-10', '最終条件確認の訪問。契約書ドラフト受領。', 'user_05', '伊藤 三郎'],
    ['act_m04', 'deal_04', 'email',   '2026-04-10', '見積書送付済み。来週中に回答もらう約束。', 'user_03', '佐藤 次郎'],
    ['act_m05', 'deal_08', 'memo',    '2026-04-26', 'Phase 3に進んだが決裁者が誰か不明のまま。次回面談で必ず確認する。', 'user_09', '加藤 京子'],
  ]

  const demoActivities = actRows.map(([id, deal_id, type, date, content, author_id, author_name]) => ({
    id, deal_id, type, date, content, author_id, author_name,
    createdAt: date + 'T09:00:00Z',
  }))
  _bulkSaveActivities(demoActivities)
}
