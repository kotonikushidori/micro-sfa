// lp-manager.js: マネージャー向けランディングページ
export function renderLpManager(root) {
  root.innerHTML = `
    <div class="lp-wrapper">
      <a href="#lp" class="lp-back">← 戻る</a>

      <div class="lp-hero">
        <p class="lp-tagline">マネージャー・チームリーダー向け</p>
        <h1 class="lp-headline">マネジメントの時間を、半分に。</h1>
        <p class="lp-hero-body">チーム全員の状況がリアルタイムで見える。<br>会議も面談も、必要なときだけ。</p>
      </div>

      <div class="lp-section">
        <h2 class="lp-section-title">こんな悩み、ありませんか？</h2>
        <div class="lp-cards">
          <div class="lp-card">
            <div class="lp-card-icon">😶</div>
            <h3>「言いたいけど、言えない」</h3>
            <p>対面でも、飯の席でも、メールでも、チャットでも。ちょっと指摘すると角が立つ。辞められても困る。でも黙っていたら自分が詰められる。</p>
          </div>
          <div class="lp-card">
            <div class="lp-card-icon">⏱️</div>
            <h3>「ヨミ会の準備で週が終わる」</h3>
            <p>担当者ごとの進捗確認、資料の集約、数字の整合確認。その時間を、チームのために使いたい。</p>
          </div>
          <div class="lp-card">
            <div class="lp-card-icon">🌫️</div>
            <h3>「誰が詰まっているか、言われるまでわからない」</h3>
            <p>担当者は「大丈夫です」と言う。でも数字は動いていない。実態をリアルタイムで把握できていない。</p>
          </div>
        </div>
      </div>

      <div class="lp-section lp-section-alt">
        <h2 class="lp-section-title">データが言うから、あなたが言わなくていい</h2>
        <ul class="lp-feature-list">
          <li>
            <span class="lp-feature-icon">📊</span>
            <span><strong>担当者自身がBANTスコアを見て気づく</strong> — 弱点はシステムが数値で示す。「あなたがダメ」ではなく「この数字が足りない」という事実の確認になる</span>
          </li>
          <li>
            <span class="lp-feature-icon">🎓</span>
            <span><strong>指導ダッシュボードで全員の課題を一覧</strong> — 誰がどのフェーズで止まっているか、どのBANT項目が弱いか。マネージャーが見るべき数字がすぐわかる</span>
          </li>
          <li>
            <span class="lp-feature-icon">🗂️</span>
            <span><strong>カンバンで進捗がリアルタイムに見える</strong> — 週次報告を待たなくていい。いつでも全案件のフェーズが確認できる</span>
          </li>
          <li>
            <span class="lp-feature-icon">📈</span>
            <span><strong>ヨミ会ビューで会議ゼロ準備</strong> — 月別・担当者別の受注予測が自動集計。資料作成の時間を、個別支援に使える</span>
          </li>
        </ul>
      </div>

      <div class="lp-section">
        <h2 class="lp-section-title">関係を壊さずに、チームを動かす</h2>
        <p class="lp-body-text">指摘が「感情」ではなく「データ」になる。マネージャーが言いにくいことは、ツールが先に可視化する。<br>あなたは関係を守ることに集中できる。</p>
      </div>

    </div>
  `
}
