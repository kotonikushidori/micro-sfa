// forecast.js: ヨミ会ビュー。部署別・担当者別のパイプライン一覧と期待値集計。
import { AppState } from '/app.js'
import { calcYomi, calcExpectedValue, isWarning, calcBantScore, calcCurrentPhase, formatCurrency, YOMI_RULES } from '/constants.js'

export function renderForecast(root) {
  const activeDepts = AppState.depts.filter(d => d.isActive)
  const activeDeals = AppState.deals.filter(d => !d.isWon && !d.isLost)

  root.innerHTML = `
    <div class="page-header">
      <h2>ヨミ会ビュー</h2>
      <select id="forecast-dept" class="filter-select">
        <option value="">全部署</option>
        ${activeDepts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
      </select>
    </div>
    <div id="forecast-content"></div>
  `

  document.getElementById('forecast-dept').addEventListener('change', () => {
    renderForecastContent(document.getElementById('forecast-dept').value)
  })

  renderForecastContent('')
}

function renderForecastContent(deptId) {
  const content = document.getElementById('forecast-content')
  const deals   = AppState.deals.filter(d => !d.isWon && !d.isLost && (!deptId || d.dept_id === deptId))

  // ヨミ区分ごとの集計
  const yomiSummary = YOMI_RULES.map(rule => {
    const matched = deals.filter(d => calcYomi(d).key === rule.key)
    return {
      ...rule,
      count:    matched.length,
      total:    matched.reduce((s, d) => s + d.amount, 0),
      expected: matched.reduce((s, d) => s + calcExpectedValue(d), 0),
    }
  })

  const totalExpected = deals.reduce((s, d) => s + calcExpectedValue(d), 0)
  const warnings      = deals.filter(isWarning)

  // 担当者別集計
  const userMap = {}
  deals.forEach(d => {
    if (!userMap[d.assignee_id]) {
      userMap[d.assignee_id] = { name: d.assignee_name, dept: d.dept_name, deals: [] }
    }
    userMap[d.assignee_id].deals.push(d)
  })

  content.innerHTML = `
    <div class="forecast-grid">
      <!-- ヨミ区分サマリー -->
      <section class="card forecast-summary">
        <h3>ヨミ区分サマリー</h3>
        <div class="yomi-summary-cards">
          ${yomiSummary.map(y => `
            <div class="yomi-card yomi-${y.key}">
              <div class="yomi-card-label">${y.label}</div>
              <div class="yomi-card-count">${y.count}件</div>
              <div class="yomi-card-total">${formatCurrency(y.total)}</div>
              <div class="yomi-card-rate">× ${y.rate} =</div>
              <div class="yomi-card-expected">${formatCurrency(y.expected)}</div>
            </div>
          `).join('')}
          <div class="yomi-card yomi-total">
            <div class="yomi-card-label">期待値合計</div>
            <div class="yomi-card-count">${deals.length}件</div>
            <div class="yomi-card-expected total-expected">${formatCurrency(totalExpected)}</div>
          </div>
        </div>
      </section>

      <!-- 要注意案件 -->
      <section class="card">
        <h3>要注意案件 <span class="badge-warning">${warnings.length}件</span></h3>
        ${warnings.length === 0
          ? '<p class="empty-state">要注意案件なし</p>'
          : `<table class="data-table">
              <thead><tr>
                <th>案件名</th><th>担当者</th><th>Phase</th><th>BANT</th><th>金額</th><th></th>
              </tr></thead>
              <tbody>
                ${warnings.map(d => `
                  <tr class="row-warning">
                    <td>${d.name}</td>
                    <td>${d.assignee_name}</td>
                    <td>Phase ${calcCurrentPhase(d)}</td>
                    <td>${calcBantScore(d)}/8</td>
                    <td>${formatCurrency(d.amount)}</td>
                    <td><a href="#deal?id=${d.id}" class="btn btn-sm">編集</a></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </section>

      <!-- 担当者別パイプライン -->
      <section class="card forecast-pipeline">
        <h3>担当者別パイプライン</h3>
        <table class="data-table">
          <thead><tr>
            <th>担当者</th><th>部署</th><th>件数</th>
            ${YOMI_RULES.map(r => `<th>${r.label}</th>`).join('')}
            <th>期待値合計</th>
          </tr></thead>
          <tbody>
            ${Object.values(userMap).map(u => {
              const byYomi = YOMI_RULES.map(r =>
                u.deals.filter(d => calcYomi(d).key === r.key)
                       .reduce((s, d) => s + d.amount, 0)
              )
              const expected = u.deals.reduce((s, d) => s + calcExpectedValue(d), 0)
              return `
                <tr>
                  <td>${u.name}</td>
                  <td>${u.dept}</td>
                  <td>${u.deals.length}</td>
                  ${byYomi.map(v => `<td>${formatCurrency(v)}</td>`).join('')}
                  <td><strong>${formatCurrency(expected)}</strong></td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </section>

      <!-- 全案件リスト -->
      <section class="card">
        <h3>パイプライン全件</h3>
        <table class="data-table">
          <thead><tr>
            <th>案件名</th><th>担当者</th><th>部署</th><th>Phase</th>
            <th>ヨミ</th><th>BANT</th><th>金額</th><th>期待値</th><th>想定受注日</th><th></th>
          </tr></thead>
          <tbody>
            ${deals.map(d => {
              const yomi = calcYomi(d)
              return `
                <tr ${isWarning(d) ? 'class="row-warning"' : ''}>
                  <td>${d.name}</td>
                  <td>${d.assignee_name}</td>
                  <td>${d.dept_name}</td>
                  <td>Phase ${calcCurrentPhase(d)}</td>
                  <td><span class="yomi-tag yomi-${yomi.key}">${yomi.label}</span></td>
                  <td>${calcBantScore(d)}/8</td>
                  <td>${formatCurrency(d.amount)}</td>
                  <td>${formatCurrency(calcExpectedValue(d))}</td>
                  <td>${d.closeDate}</td>
                  <td><a href="#deal?id=${d.id}" class="btn btn-sm">編集</a></td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </section>
    </div>
  `
}
