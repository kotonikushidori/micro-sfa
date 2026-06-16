// constants.js: ドメイン定数。全ファイルからインポートして使う。
// ここを変更するだけで全画面に反映される。

// 業種別フェーズプリセット。key は settings.phasePreset に保存される。
// 各プリセットは必ず4フェーズ（deal.phases は4要素のbool配列）。
export const PHASE_PRESETS = {
  'default': {
    label: 'IT・SaaS標準',
    phases: [
      { id: 1, label: 'Phase 1: ヒアリング完了',         desc: '議事録共有・課題合意済み' },
      { id: 2, label: 'Phase 2: 提案・見積提示',         desc: '見積書送付・受領確認済み' },
      { id: 3, label: 'Phase 3: 決裁会議日程確定',       desc: '決裁権者出席の会議日時確定' },
      { id: 4, label: 'Phase 4: 内定・リーガルチェック', desc: '発注意思受領・契約書確認中' },
    ],
  },
  'manufacturing': {
    label: '製造業・設備販売',
    phases: [
      { id: 1, label: 'Phase 1: ヒアリング',   desc: '課題・要件のヒアリング済み' },
      { id: 2, label: 'Phase 2: 仕様確定',     desc: '技術仕様・要件を書面で合意済み' },
      { id: 3, label: 'Phase 3: 見積提示',     desc: '見積書提出・金額ライン確認済み' },
      { id: 4, label: 'Phase 4: 社内稟議',     desc: '顧客社内の稟議・発注承認プロセス中' },
    ],
  },
  'agency': {
    label: '代理店・卸売り',
    phases: [
      { id: 1, label: 'Phase 1: 新規開拓',     desc: '初回接触・ニーズ確認済み' },
      { id: 2, label: 'Phase 2: サンプル提供', desc: 'サンプル・試供品を提供済み' },
      { id: 3, label: 'Phase 3: 条件交渉',     desc: '価格・数量・納期条件を交渉中' },
      { id: 4, label: 'Phase 4: 契約',         desc: '契約書・発注書の確認・締結中' },
    ],
  },
  'construction': {
    label: '建設・工事',
    phases: [
      { id: 1, label: 'Phase 1: 引き合い',     desc: '引き合い受付・要件確認済み' },
      { id: 2, label: 'Phase 2: 現地調査',     desc: '現地調査・仕様確認完了' },
      { id: 3, label: 'Phase 3: 見積',         desc: '見積書提出・金額確認済み' },
      { id: 4, label: 'Phase 4: 指名',         desc: '発注先として指名・内示受領済み' },
    ],
  },
}

export function getPhaseItems(presetKey) {
  return (PHASE_PRESETS[presetKey] ?? PHASE_PRESETS['default']).phases
}

export const PHASES = PHASE_PRESETS['default'].phases

// 業種別 BANT ラベルプリセット。key は settings.bantPreset に保存される。
export const BANT_PRESETS = {
  'default': {
    label: '標準（IT / SaaS）',
    items: [
      { key: 'B', label: 'Budget（予算）',      options: ['未確認', '概算予算枠を確認', '確定予算・金額ラインを把握'] },
      { key: 'A', label: 'Authority（決裁）',   options: ['窓口担当者のみ', '起案者・影響者を把握', '最終決裁権者を特定または同席'] },
      { key: 'N', label: 'Needs（課題）',       options: ['ふんわりした興味', '明確なペインをヒアリング済', 'RFP等として要件定義済'] },
      { key: 'T', label: 'Timeframe（時期）',   options: ['時期未定', '大枠の時期が判明', 'デッドライン（日付）が確定'] },
    ],
  },
  'manufacturing': {
    label: '製造業',
    items: [
      { key: 'B', label: 'B: 予算確認済み',         options: ['予算未確認', '概算予算を確認', '確定予算・発注枠を把握'] },
      { key: 'A', label: 'A: 決裁者と面談済み',     options: ['窓口担当者のみ', '購買・起案部門を把握', '最終決裁権者と直接面談済み'] },
      { key: 'N', label: 'N: 課題・仕様を合意',     options: ['ふんわりした改善ニーズ', '生産課題・仕様を深掘り済み', '課題・仕様を書面で合意済み'] },
      { key: 'T', label: 'T: 納期・導入時期確定',   options: ['時期未定', '大枠の導入時期が判明', '納期・稼働日（日付）が確定'] },
    ],
  },
  'realestate': {
    label: '不動産',
    items: [
      { key: 'B', label: 'B: 購入・賃料予算',       options: ['予算未確認', '概算予算範囲を確認', '上限予算・資金計画を確認'] },
      { key: 'A', label: 'A: 意思決定者を特定',     options: ['問い合わせ窓口のみ', '家族・関係者の関与を把握', '最終意思決定者と直接面談'] },
      { key: 'N', label: 'N: 条件・ニーズ合意',     options: ['漠然とした希望', '必須条件を明確化済み', '優先順位・妥協点まで合意'] },
      { key: 'T', label: 'T: 入居・引渡し時期',     options: ['時期未定', '目安の時期が判明', '引渡し日程（日付）を確定'] },
    ],
  },
  'retail': {
    label: '小売・流通',
    items: [
      { key: 'B', label: 'B: 導入予算を確認',       options: ['予算未確認', '概算予算・ROI期待を確認', '確定予算・投資承認を取得'] },
      { key: 'A', label: 'A: 仕入・調達担当者',     options: ['現場担当者のみ', '調達・バイヤーを把握', '本部・決裁者と直接交渉'] },
      { key: 'N', label: 'N: 課題・仕様を合意',     options: ['漠然とした問題意識', '在庫・物流課題を明確化', '導入範囲・仕様を書面合意'] },
      { key: 'T', label: 'T: 導入・切替え時期',     options: ['時期未定', 'シーズンを考慮した時期が判明', 'カットオーバー日を確定'] },
    ],
  },
}

// プリセットキーから BANT アイテム配列を返すヘルパー
export function getBantItems(presetKey) {
  return (BANT_PRESETS[presetKey] ?? BANT_PRESETS['default']).items
}

export const BANT_ITEMS = BANT_PRESETS['default'].items

export const BANT_MAX_SCORE = 8

// ヨミ区分ルール。Phase×BANTで自動決定し、営業の自己申告を一切使わない。
// これがこのSFAの核心。先頭条件が優先される。
export const YOMI_RULES = [
  { label: 'A（確実）', key: 'A', condition: (deal) => calcCurrentPhase(deal) >= 3 && calcBantScore(deal) >= 6, rate: 0.9 },
  { label: 'B（勝負）', key: 'B', condition: (deal) => calcCurrentPhase(deal) >= 2 && calcBantScore(deal) >= 4, rate: 0.5 },
  { label: 'C（観察）', key: 'C', condition: () => true, rate: 0.1 },
]

export const FORECAST_RATES = { A: 0.9, B: 0.5, C: 0.1 }

// 活動ログの種別定義。manual: true はユーザーが手動で記録できる種別。
// phase_change / bant_change は deal.js が保存時に自動生成する。
export const ACTIVITY_TYPES = [
  { key: 'visit',        label: '訪問',           icon: '🚗', manual: true  },
  { key: 'call',         label: '電話',           icon: '📞', manual: true  },
  { key: 'email',        label: 'メール',         icon: '📧', manual: true  },
  { key: 'memo',         label: 'メモ',           icon: '📝', manual: true  },
  { key: 'voice_memo',   label: '音声メモ',       icon: '🎤', manual: false },
  { key: 'phase_change',      label: 'Phase変更',      icon: '🔄', manual: false },
  { key: 'bant_change',       label: 'BANTスコア変更', icon: '📊', manual: false },
  { key: 'close_date_change', label: '期日変更',        icon: '📅', manual: false },
]

// ボール位置：「今誰が動く番か」を表す。Phase（達成事実）とは独立した軸。
// 社内他部署・顧客側に作業があるときは営業がいくら焦っても進まないため、
// ネクストアクションの優先付けに使う。
export const BALL_OWNER_OPTIONS = [
  {
    key: 'sales',
    label: '営業が動く番',
    icon: '🟢',
    desc: 'ネクストアクションが自分（営業）にある',
  },
  {
    key: 'internal',
    label: '社内他部署待ち',
    icon: '🟡',
    desc: 'SE・法務・見積・技術確認など社内対応中',
    details: [
      'SE・技術確認依頼中',
      '見積・バックオフィス依頼中',
      '法務・契約書レビュー依頼中',
      '上長承認待ち',
      'デモ環境・PoC準備中',
      'その他（社内）',
    ],
  },
  {
    key: 'customer',
    label: '顧客側検討中',
    icon: '🔵',
    desc: '顧客社内での稟議・承認・PoC・意思決定プロセス中',
    details: [
      '顧客社内稟議中',
      '顧客予算承認待ち',
      '顧客PoC・検証中',
      '顧客法務レビュー待ち',
      '顧客意思決定待ち',
      'その他（顧客側）',
    ],
  },
]

// ballOwner が未設定の旧データへの後方互換デフォルト値
export const DEFAULT_BALL_OWNER = 'sales'

// ロック条件の定義。admin が ON/OFF を設定し、条件を満たした案件は全フィールド編集不可になる。
// フィールドレベルACLではなく「案件ごと凍結」にすることで、
// 将来APIやエクスポート機能を足しても1箇所（isLocked関数）だけ見れば済む。
export const LOCK_TRIGGER_DEFS = [
  {
    key:     'lockOnWon',
    label:   '受注済みになった案件をロック',
    desc:    '受注後の金額・Phase改ざんを防ぐ。最も推奨。',
    default: true,
    check:   (deal) => deal.isWon === true,
  },
  {
    key:     'lockOnLost',
    label:   '失注済みになった案件をロック',
    desc:    '失注後の遡及編集を防ぐ。',
    default: true,
    check:   (deal) => deal.isLost === true,
  },
  {
    key:     'lockOnPhase',
    label:   '指定 Phase 以降に到達した案件をロック',
    desc:    'Phase 4（内定・リーガル）以降は金額・担当者の変更を凍結するなど。',
    default: false,
    paramLabel: 'ロックする Phase（到達後）',
    paramKey:   'lockOnPhaseValue',
    paramDefault: 4,
    check:   (deal, cfg) => cfg.lockOnPhase && calcCurrentPhase(deal) >= (cfg.lockOnPhaseValue ?? 4),
  },
  {
    key:     'lockOnCloseDatePassed',
    label:   '想定受注日を過ぎた案件をロック',
    desc:    '期日超過案件の遡及修正を防ぐ。',
    default: false,
    check:   (deal) => {
      if (!deal.closeDate) return false
      return new Date(deal.closeDate) < new Date(new Date().toDateString())
    },
  },
]

// ロック設定のデフォルト値
export const DEFAULT_LOCK_CONFIG = Object.fromEntries(
  LOCK_TRIGGER_DEFS.map(t => [
    [t.key, t.default],
    t.paramKey ? [[t.paramKey, t.paramDefault]] : [],
  ].flat())
)

// ---------- 純粋関数（副作用なし）----------

// phases 配列から現在の最高 Phase 番号を算出（保存しない）
export function calcCurrentPhase(deal) {
  const last = deal.phases.lastIndexOf(true)
  return last === -1 ? 0 : last + 1
}

// bant オブジェクトから合計スコアを算出（保存しない）
export function calcBantScore(deal) {
  return Object.values(deal.bant).reduce((a, b) => a + b, 0)
}

// Phase × BANT からヨミ区分オブジェクトを返す
export function calcYomi(deal) {
  return YOMI_RULES.find(r => r.condition(deal)) || YOMI_RULES[YOMI_RULES.length - 1]
}

// ヨミ区分に応じた期待値を返す
export function calcExpectedValue(deal) {
  const yomi = calcYomi(deal)
  return Math.round(deal.amount * yomi.rate)
}

// ロック設定を評価し、案件が編集不可かどうかを返す純粋関数
// cfg が未指定の場合はデフォルト設定を使う
export function isLocked(deal, cfg = DEFAULT_LOCK_CONFIG) {
  return LOCK_TRIGGER_DEFS.some(t => t.check(deal, cfg))
}

// Phase が高いのにBANTスコアが低い「要注意」案件を判定
// Phase3以上でBANT3以下は商談が進んでいるのに情報収集が不足している危険なシグナル
export function isWarning(deal) {
  return calcCurrentPhase(deal) >= 3 && calcBantScore(deal) <= 3
}

// ---------- コーチング分析定数 ----------

// フェーズ別失注が示すスキル課題。UIが自動テキスト生成に使う。
export const LOSS_PHASE_INSIGHTS = [
  { phase: 0, action: '案件化直後の失注 → 初回ヒアリングで課題合意が取れていません。議事録フォーマットと合意プロセスを見直してください' },
  { phase: 1, action: 'Phase 1（ヒアリング後）の失注 → 提案・見積が期待とずれた可能性。提案構成と見積根拠の説明プロセスを強化してください' },
  { phase: 2, action: 'Phase 2（提案後）の失注 → 決裁者に届く前に止まっています。Authorityの早期特定とエスカレーション戦略を訓練してください' },
  { phase: 3, action: 'Phase 3（決裁会議後）の失注 → クロージングに課題あり。競合対策・価格交渉・最終合意プロセスをロールプレイしてください' },
  { phase: 4, action: 'Phase 4（内定後）の失注 → 契約フェーズの離脱。法務・契約交渉への関与体制を確認してください' },
]

export const BANT_WEAKNESS_INSIGHTS = {
  B: '予算確認（Budget）が弱い → 商談初期に予算確認を組み込むスクリプトを整備してください',
  A: '決裁者アクセス（Authority）が弱い → 意思決定構造を早期に把握し、決裁者を商談に巻き込む戦略を訓練してください',
  N: '課題深掘り（Needs）が弱い → ペイン・ゲインを引き出すヒアリング技法を強化してください',
  T: '時期確認（Timeframe）が弱い → 導入時期・デッドラインの確認を商談設計に組み込んでください',
}

// ---------- コーチング分析関数（純粋関数）----------

// Phase変更活動ログから「Phase N に到達した日付」のマップを返す
// 戻り値: { 1: '2026-02-06', 2: '2026-02-20', ... }
export function buildPhaseTimeline(dealId, activities) {
  const timeline = {}
  activities
    .filter(a => a.deal_id === dealId && a.type === 'phase_change')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach(a => {
      const m = a.content.match(/Phase (\d+) → Phase (\d+)/)
      if (m) timeline[parseInt(m[2])] = a.date
    })
  return timeline
}

export function daysBetween(d1, d2) {
  return Math.round((new Date(d2) - new Date(d1)) / 86400000)
}

// 最後にPhaseが変化してから何日経過したか（活動ログがない場合はcreatedAt基準）
export function calcDaysSinceLastPhaseChange(dealId, activities, createdAt) {
  const last = activities
    .filter(a => a.deal_id === dealId && a.type === 'phase_change')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const base = last ? last.date : createdAt.slice(0, 10)
  return daysBetween(base, new Date().toISOString().slice(0, 10))
}

// 担当者ごとのコーチングデータを集計して返す
export function calcRepCoachingData(deals, activities) {
  const repMap = {}
  deals.forEach(deal => {
    if (!repMap[deal.assignee_id]) {
      repMap[deal.assignee_id] = {
        id: deal.assignee_id, name: deal.assignee_name,
        dept: deal.dept_name, dept_id: deal.dept_id,
        active: [], won: [], lost: [],
      }
    }
    const r = repMap[deal.assignee_id]
    if (deal.isWon) r.won.push(deal)
    else if (deal.isLost) r.lost.push(deal)
    else r.active.push(deal)
  })

  return Object.values(repMap).map(rep => {
    const all = [...rep.active, ...rep.won, ...rep.lost]

    // フェーズ別失注集計
    const lossPhases = {}
    rep.lost.forEach(d => {
      const p = calcCurrentPhase(d)
      lossPhases[p] = (lossPhases[p] || 0) + 1
    })
    const dominantLossPhase = rep.lost.length > 0
      ? parseInt(Object.entries(lossPhases).sort((a, b) => b[1] - a[1])[0][0])
      : null

    // BANT平均（アクティブ案件のみ）
    const bantAverages = { B: 0, A: 0, N: 0, T: 0 }
    if (rep.active.length > 0) {
      Object.keys(bantAverages).forEach(k => {
        bantAverages[k] = rep.active.reduce((s, d) => s + (d.bant[k] ?? 0), 0) / rep.active.length
      })
    }
    const bantWeaknesses = rep.active.length > 0
      ? Object.keys(bantAverages).filter(k => bantAverages[k] < 1.0)
      : []

    // フェーズ進行速度（活動ログから計算）
    const velBuckets = { '0_1': [], '1_2': [], '2_3': [], '3_4': [] }
    all.forEach(deal => {
      const tl   = buildPhaseTimeline(deal.id, activities)
      const base = deal.createdAt.slice(0, 10)
      for (let i = 0; i < 4; i++) {
        if (!tl[i + 1]) continue
        const from = i === 0 ? base : tl[i]
        if (!from) continue
        const d = daysBetween(from, tl[i + 1])
        if (d >= 0 && d <= 365) velBuckets[`${i}_${i + 1}`].push(d)
      }
    })

    const avgVelocity = {}
    const velCounts   = {}
    Object.entries(velBuckets).forEach(([k, vals]) => {
      avgVelocity[k] = vals.length > 0
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
      velCounts[k] = vals.length
    })

    return {
      id: rep.id, name: rep.name, dept: rep.dept, dept_id: rep.dept_id,
      activeCount: rep.active.length,
      wonCount:    rep.won.length,
      lostCount:   rep.lost.length,
      wonAmount:   rep.won.reduce((s, d) => s + d.amount, 0),
      lossPhases, dominantLossPhase,
      bantAverages, bantWeaknesses,
      avgVelocity, velCounts,
    }
  })
}

// チーム全体のフェーズ速度平均を返す
export function calcTeamVelocityAvg(repData) {
  const keys = ['0_1', '1_2', '2_3', '3_4']
  const result = {}
  keys.forEach(k => {
    const vals = repData.filter(r => r.avgVelocity[k] !== null).map(r => r.avgVelocity[k])
    result[k] = vals.length > 0
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  })
  return result
}

// 案件の期日後ろ倒し回数を返す（前倒しはカウントしない）
export function calcPushCount(dealId, activities) {
  return activities.filter(a => a.deal_id === dealId && a.type === 'close_date_change').length
}

// 金額を日本円フォーマット（¥1,200,000）に変換
export function formatCurrency(amount) {
  return '¥' + amount.toLocaleString('ja-JP')
}

// ISO日付文字列を yyyy/MM/dd に変換
export function formatDate(isoStr) {
  if (!isoStr) return '-'
  return isoStr.slice(0, 10).replace(/-/g, '/')
}

// ---------- 会計四半期ユーティリティ ----------
// fiscalStartMonth: 1〜12（デフォルト 4 = 4月始まり・3月決算）
// キー形式: FY2026-Q1（FY = 期首が属する年）

export function getFiscalQuarterKey(date = new Date(), fiscalStartMonth = 4) {
  const fsm = fiscalStartMonth - 1  // 0-indexed
  const m   = date.getMonth()
  const y   = date.getFullYear()
  // 期首月より前なら前年度
  const fyYear  = m >= fsm ? y : y - 1
  const fyMonth = (m - fsm + 12) % 12
  const q = Math.floor(fyMonth / 3) + 1
  return `FY${fyYear}-Q${q}`
}

export function getFiscalQuarterRange(quarterKey, fiscalStartMonth = 4) {
  const [fyPart, qPart] = quarterKey.split('-')
  const fyYear = parseInt(fyPart.replace('FY', ''))
  const q      = parseInt(qPart.replace('Q', ''))
  const fsm    = fiscalStartMonth - 1  // 0-indexed
  // Q1の開始月 = fsm、Q2 = fsm+3、Q3 = fsm+6、Q4 = fsm+9（12超えたら翌年）
  const offsetMonths = (q - 1) * 3
  const absMonth = fsm + offsetMonths
  const startYear  = fyYear + Math.floor(absMonth / 12)
  const startMonth = absMonth % 12
  return { start: new Date(startYear, startMonth, 1), end: new Date(startYear, startMonth + 3, 1) }
}

export function getQuarterLabel(quarterKey, fiscalStartMonth = 4) {
  const [fyPart, qPart] = quarterKey.split('-')
  const fyYear = parseInt(fyPart.replace('FY', ''))
  const q      = parseInt(qPart.replace('Q', ''))
  const fsm    = fiscalStartMonth - 1
  const startM = ((fsm + (q - 1) * 3) % 12) + 1  // 1-indexed 月
  const endM   = ((fsm + (q - 1) * 3 + 2) % 12) + 1
  return `${fyYear}年度 ${qPart}（${startM}-${endM}月）`
}

export function getQuarterOptions(fiscalStartMonth = 4, around = 2) {
  const now = new Date()
  const [fyPart, qPart] = getFiscalQuarterKey(now, fiscalStartMonth).split('-')
  let fy = parseInt(fyPart.replace('FY', ''))
  let q  = parseInt(qPart.replace('Q', ''))
  const options = []
  for (let i = -around; i <= around + 1; i++) {
    let tq = q + i, tfy = fy
    while (tq < 1) { tq += 4; tfy-- }
    while (tq > 4) { tq -= 4; tfy++ }
    const key = `FY${tfy}-Q${tq}`
    options.push({ key, label: getQuarterLabel(key, fiscalStartMonth) })
  }
  return options
}

export function isWonInQuarter(deal, quarterKey, fiscalStartMonth = 4) {
  if (!deal.isWon || !deal.updatedAt) return false
  const { start, end } = getFiscalQuarterRange(quarterKey, fiscalStartMonth)
  const dt = new Date(deal.updatedAt)
  return dt >= start && dt < end
}
