# 運用・保守手順

## サーバー接続・移動

SSHでサーバーに接続し、アプリディレクトリに移動する。

```bash
cd ~/micro-sfa
```

---

## アクセス状況をみる

### ログの確認コマンド

```bash
# 直近100行
docker logs micro-sfa-app --tail 100

# 直近24時間
docker logs micro-sfa-app --since 24h

# 直近7日間
docker logs micro-sfa-app --since 168h
```

### ログイン履歴だけ絞り込む

```bash
# ログイン成功のみ
docker logs micro-sfa-app --since 7d 2>&1 | grep LOGIN_SUCCESS

# ログイン拒否（不正アクセス試行）のみ
docker logs micro-sfa-app --since 7d 2>&1 | grep LOGIN_REJECT
```

### ログの読み方

```
2026/06/17 10:23:45 LOGIN_SUCCESS ip=1.2.3.4 email=xxx@gmail.com user=すぎさわ role=admin
2026/06/17 10:24:01 LOGIN_REJECT  ip=5.6.7.8 email=unknown@gmail.com reason=not_registered
2026/06/17 10:25:10 ACCESS ip=1.2.3.4 GET /api/deals
```

| キー | 内容 |
|------|------|
| `LOGIN_SUCCESS` | Googleログイン成功 |
| `LOGIN_REJECT` | 未登録メール・無効アカウントによる拒否 |
| `ACCESS` | 全HTTPリクエスト |
| `ip` | アクセス元IPアドレス |
| `email` | Googleアカウントのメールアドレス |
| `reason` | 拒否理由（`not_registered` / `inactive`） |

---

## DB操作

一時コンテナ経由でsqlite3を起動する：

```bash
docker run --rm -it -v micro-sfa_db-data:/data alpine sh -c "apk add --no-cache sqlite && sqlite3 /data/sfa.db"
```

### ユーザー一覧確認

```sql
SELECT id, name, role, email, google_id FROM users;
```

### 新しいユーザーを追加する（Googleログイン用）

マスター管理画面（adminロール）から追加するのが通常の手順。
DB直接操作が必要な場合：

```sql
INSERT INTO users(id, name, dept_id, role, password, email, is_active, created_at)
VALUES('user_xxx', '名前', '<DEPT_ID>', 'sales', '', '<USER_GMAIL>', 1, datetime('now'));
```

### Googleアカウントを admin にリンクする

```sql
UPDATE users SET email = '<YOUR_GMAIL>' WHERE name = 'admin';
```

### ユーザーを無効化する

```sql
UPDATE users SET is_active = 0 WHERE email = '<USER_GMAIL>';
```

---

## デプロイ（コード更新時）

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

---

## 環境変数（.env）

`.env.example` を参考に `.env` を作成する。`.env` 自体はgit管理外。

| 変数名 | 用途 |
|--------|------|
| `ANTHROPIC_API_KEY` | Claude AI（音声メモ構造化）|
| `GOOGLE_CLIENT_ID` | GoogleログインのクライアントID |
| `GOOGLE_CLIENT_SECRET` | Googleログインのシークレット |
| `GOOGLE_REDIRECT_URI` | OAuthコールバックURL |
