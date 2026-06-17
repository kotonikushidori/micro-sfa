// lp.js: ランディングページ — 対象者セレクター（ログイン不要の公開ページ）
export function renderLp(root) {
  root.innerHTML = `
    <div class="lp-select-wrapper">
      <div class="lp-select-hero">
        <h1 class="lp-logo">micro-SFA</h1>
        <p class="lp-select-lead">あなたはどちらですか？</p>
      </div>
      <div class="lp-select-cards">
        <a href="#lp-sales" class="lp-select-card">
          <div class="lp-select-card-icon">💼</div>
          <h2 class="lp-select-card-title">営業担当者</h2>
          <p class="lp-select-card-desc">自分の弱点を自分で知りたい。上司を待たずに、次の行動を自分で決めたい。</p>
          <span class="lp-select-card-arrow">詳しく見る →</span>
        </a>
        <a href="#lp-manager" class="lp-select-card">
          <div class="lp-select-card-icon">📊</div>
          <h2 class="lp-select-card-title">マネージャー・チームリーダー</h2>
          <p class="lp-select-card-desc">言いたいけど言えない。でも黙ってると詰められる。その悩みをなくしたい。</p>
          <span class="lp-select-card-arrow">詳しく見る →</span>
        </a>
      </div>
      <div class="lp-select-footer">
        <a href="#login" class="btn-lp-link">ログインはこちら</a>
      </div>
    </div>
  `
}
