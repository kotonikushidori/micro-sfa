// lp-startup.js: 起業家・スタートアップ向けランディングページ（コンタクト管理訴求）
export function renderLpStartup(root) {
  root.innerHTML = `
    <div class="lp-wrapper">
      <a href="#lp" class="lp-back">← 戻る</a>

      <div class="lp-hero">
        <p class="lp-tagline">起業家・スタートアップ向け</p>
        <h1 class="lp-headline">会うのは得意。<br>フォローが続かない。</h1>
        <p class="lp-hero-body">人脈は、出会いの瞬間に生まれるのではない。<br>その後のフォローで、育つ。</p>
      </div>

      <div class="lp-section">
        <h2 class="lp-section-title">こんなこと、ありませんか？</h2>
        <div class="lp-cards">
          <div class="lp-card">
            <div class="lp-card-icon">😅</div>
            <h3>「名刺が溜まるけど、活かせていない」</h3>
            <p>展示会、交流会、紹介。山ほど名刺をもらう。でも後で見返しても、顔も会話も浮かばない。</p>
          </div>
          <div class="lp-card">
            <div class="lp-card-icon">🫠</div>
            <h3>「フォローしようと思って、タイミングを逃した」</h3>
            <p>「あとでメールしよう」。でもその「あとで」は来なかった。縁が切れるのはいつも、こうして静かに起きる。</p>
          </div>
          <div class="lp-card">
            <div class="lp-card-icon">🌀</div>
            <h3>「誰に何をすべきか、頭の中で管理している」</h3>
            <p>メモ、名刺入れ、スマホの写真。バラバラに保存して、動こうとしたときに探せない。</p>
          </div>
        </div>
      </div>

      <div class="lp-section lp-section-alt">
        <h2 class="lp-section-title">その場10秒。あとはツールが教えてくれる。</h2>
        <ul class="lp-feature-list">
          <li>
            <span class="lp-feature-icon">📷</span>
            <span><strong>その場で撮って、ラベルを選ぶだけ</strong> — 「有望・フォロー・とりあえず」の3択を押すだけで完了。名前も会社名も後回しでいい</span>
          </li>
          <li>
            <span class="lp-feature-icon">🤖</span>
            <span><strong>AIが名刺を読み取って自動入力</strong> — あとで詳細画面を開いてボタンを押すだけ。氏名・会社名・連絡先が一瞬でフォームに入る</span>
          </li>
          <li>
            <span class="lp-feature-icon">📋</span>
            <span><strong>フェーズごとに次の一手がわかる</strong> — お礼メール → MTG打診 → 継続フォロー。何をすべきかリストが出るので、考えなくていい</span>
          </li>
          <li>
            <span class="lp-feature-icon">💼</span>
            <span><strong>縁が実ったら、そのまま案件化</strong> — 「そろそろ相談したい」と言われたら、ボタン1つで案件登録へ。名刺から受注まで一本の線でつながる</span>
          </li>
        </ul>
      </div>

      <div class="lp-section">
        <h2 class="lp-section-title">記録に時間をかけなくていい</h2>
        <p class="lp-body-text">動けるのに、管理が苦手。それはあなたの弱点ではなく、動く量が多いからです。<br>10秒だけ残す。あとはツールが次の行動を教えてくれる。あなたは動くことだけに集中してください。</p>
      </div>

      <div class="lp-cta-section">
        <a href="#login" class="btn-lp-link">ログインはこちら</a>
      </div>
    </div>
  `
}
