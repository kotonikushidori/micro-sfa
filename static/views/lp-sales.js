// lp-sales.js: 意識高い系営業担当向けランディングページ
export function renderLpSales(root) {
  root.innerHTML = `
    <div class="lp-wrapper">
      <a href="#lp" class="lp-back">← 戻る</a>

      <div class="lp-hero">
        <p class="lp-tagline">営業担当者向け</p>
        <h1 class="lp-headline">なぜあの人は売れるのか。</h1>
        <p class="lp-hero-body">フェーズとBANTスコアを見れば、<br>自分の何が足りないか一目でわかる。</p>
        <a href="#login" class="btn btn-primary lp-cta">デモを試す（無料）</a>
      </div>

      <div class="lp-section">
        <h2 class="lp-section-title">こんなこと、ありませんか？</h2>
        <div class="lp-cards">
          <div class="lp-card">
            <div class="lp-card-icon">😮‍💨</div>
            <h3>「何が弱いか、言われるまで気づけない」</h3>
            <p>商談の感触は悪くない。でもなぜか受注できない。その理由を自分では分析できていない。</p>
          </div>
          <div class="lp-card">
            <div class="lp-card-icon">🤔</div>
            <h3>「次に何をすべきか、感覚で決めている」</h3>
            <p>勘や経験に頼るのには限界がある。データをもとに次の打ち手を決めたいが、見える化できていない。</p>
          </div>
          <div class="lp-card">
            <div class="lp-card-icon">📝</div>
            <h3>「報告のための報告が多い」</h3>
            <p>週次報告、進捗確認、ヨミ会。動く時間より説明する時間の方が長くなっていないか。</p>
          </div>
        </div>
      </div>

      <div class="lp-section lp-section-alt">
        <h2 class="lp-section-title">Phase × BANT で、自分を客観視する</h2>
        <ul class="lp-feature-list">
          <li>
            <span class="lp-feature-icon">🗂️</span>
            <span><strong>フェーズで「今どこにいるか」がわかる</strong> — 初回接触・課題確認・提案・クロージングの各段階で、何が完了していて何が未完了かを数値で確認できる</span>
          </li>
          <li>
            <span class="lp-feature-icon">📊</span>
            <span><strong>BANTスコアで「何が弱いか」がわかる</strong> — 予算・決裁権・必要性・タイミング。4項目のどれが低いか見れば、次の打ち手は自動的に決まる</span>
          </li>
          <li>
            <span class="lp-feature-icon">👤</span>
            <span><strong>マイページで「自分のパターン」がわかる</strong> — どのフェーズで案件が止まりやすいか、どのBANT項目が弱いか。データが教えてくれる</span>
          </li>
        </ul>
      </div>

      <div class="lp-section">
        <h2 class="lp-section-title">上司を待つ必要はない</h2>
        <p class="lp-body-text">ツールを見れば、自分の現在地と弱点がわかる。次に何をすべきかも、データが示す。<br>指示を待つのではなく、データをもとに自分で動ける。そういう営業担当者のためのツールです。</p>
      </div>

      <div class="lp-cta-section">
        <p class="lp-cta-lead">デモアカウントで今すぐ体験できます</p>
        <a href="#login" class="btn btn-primary lp-cta">ログイン画面へ</a>
      </div>
    </div>
  `
}
