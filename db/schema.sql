-- schema.sql: SQLite DDL。PostgreSQL 移行時は ? を $N に rebind するだけで動く。
-- BOOLEAN は INTEGER(0/1)、JSON フィールドは TEXT で保存し Go 側でマーシャル。

CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    dept_id    TEXT NOT NULL,
    role       TEXT NOT NULL,
    password   TEXT NOT NULL DEFAULT '',
    email      TEXT,
    google_id  TEXT UNIQUE,
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS depts (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deals (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    amount        INTEGER NOT NULL DEFAULT 0,
    cost_amount   INTEGER,
    close_date    TEXT NOT NULL,
    assignee_id   TEXT NOT NULL,
    dept_id       TEXT NOT NULL,
    assignee_name TEXT NOT NULL,
    dept_name     TEXT NOT NULL,
    phases        TEXT NOT NULL DEFAULT '[false,false,false,false]',
    bant          TEXT NOT NULL DEFAULT '{"B":0,"A":0,"N":0,"T":0}',
    amount_history TEXT NOT NULL DEFAULT '[]',
    ball_owner    TEXT NOT NULL DEFAULT 'sales',
    ball_detail   TEXT NOT NULL DEFAULT '',
    is_won        INTEGER NOT NULL DEFAULT 0,
    is_lost       INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_assignee ON deals(assignee_id);
CREATE INDEX IF NOT EXISTS idx_deals_dept     ON deals(dept_id);

CREATE TABLE IF NOT EXISTS activities (
    id          TEXT PRIMARY KEY,
    deal_id     TEXT NOT NULL,
    type        TEXT NOT NULL,
    date        TEXT NOT NULL,
    content     TEXT NOT NULL,
    author_id   TEXT NOT NULL,
    author_name TEXT NOT NULL,
    cost        INTEGER,
    duration    INTEGER,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities(deal_id);

-- targets: (target_type, entity_id, quarter_key) が複合主キー
CREATE TABLE IF NOT EXISTS targets (
    target_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    quarter_key TEXT NOT NULL,
    amount      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (target_type, entity_id, quarter_key)
);

-- settings はシングルトン（id=1 固定）
CREATE TABLE IF NOT EXISTS settings (
    id                 INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
    fiscal_start_month INTEGER NOT NULL DEFAULT 4,
    bant_preset        TEXT NOT NULL DEFAULT 'default',
    phase_preset       TEXT NOT NULL DEFAULT 'default',
    lock_config        TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO settings(id) VALUES(1);

CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS contacts (
    id               TEXT PRIMARY KEY,
    card_image_url   TEXT NOT NULL DEFAULT '',
    quick_label      TEXT NOT NULL DEFAULT 'followup',
    quick_memo       TEXT NOT NULL DEFAULT '',
    event_name       TEXT NOT NULL DEFAULT '',
    captured_at      TEXT NOT NULL,
    ocr_status       TEXT NOT NULL DEFAULT 'raw',
    ocr_raw_text     TEXT NOT NULL DEFAULT '',
    company_name     TEXT NOT NULL DEFAULT '',
    department       TEXT NOT NULL DEFAULT '',
    title            TEXT NOT NULL DEFAULT '',
    name             TEXT NOT NULL DEFAULT '',
    address          TEXT NOT NULL DEFAULT '',
    tel              TEXT NOT NULL DEFAULT '',
    email            TEXT NOT NULL DEFAULT '',
    phase            TEXT NOT NULL DEFAULT '',
    next_action_date TEXT,
    next_action_memo TEXT NOT NULL DEFAULT '',
    deal_id          TEXT,
    referral_count   INTEGER NOT NULL DEFAULT 0,
    assignee_id      TEXT NOT NULL,
    assignee_name    TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_assignee   ON contacts(assignee_id);
CREATE INDEX IF NOT EXISTS idx_contacts_ocr_status ON contacts(ocr_status);
