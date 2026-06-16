// db.go: SQLite 接続・マイグレーション・シードデータ投入。
// PostgreSQL 移行時はドライバ import と dsn だけ変更する。
package db

import (
	"crypto/sha256"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaSQL string

// Open は DSN を受け取り WAL モードで SQLite 接続を返す。
// PostgreSQL 移行時: sql.Open("postgres", dsn) に差し替えるだけ。
func Open(dsn string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// SQLite は同時書き込みが 1 本のみ。MaxOpenConns=1 で SQLITE_BUSY を防ぐ。
	db.SetMaxOpenConns(1)
	if _, err := db.Exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;"); err != nil {
		db.Close()
		return nil, fmt.Errorf("pragma: %w", err)
	}
	return db, nil
}

// Migrate はスキーマを適用する（べき等）。
func Migrate(db *sql.DB) error {
	if _, err := db.Exec(schemaSQL); err != nil {
		return err
	}
	// 既存DBへの列追加（IF NOT EXISTSがSQLiteのALTER TABLEでは使えないためエラーを無視）
	db.Exec(`ALTER TABLE users ADD COLUMN email TEXT`)
	db.Exec(`ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE`)
	return nil
}

// Seed はユーザーテーブルが空のときだけデモデータを投入する。
func Seed(db *sql.DB) error {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return insertDemoData(db)
}

func hashPassword(plain string) string {
	h := sha256.Sum256([]byte(plain))
	return hex.EncodeToString(h[:])
}

func insertDemoData(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().UTC().Format(time.RFC3339)
	hash := hashPassword("demo1234")

	depts := []struct{ id, name string }{
		{"dept_01", "東日本営業部"},
		{"dept_02", "西日本営業部"},
		{"dept_03", "中部営業部"},
	}
	for _, d := range depts {
		if _, err := tx.Exec(
			`INSERT INTO depts(id,name,is_active,created_at) VALUES(?,?,1,?)`,
			d.id, d.name, now,
		); err != nil {
			return err
		}
	}

	users := []struct{ id, name, dept, role string }{
		{"user_01", "田中 一郎", "dept_01", "sales"},
		{"user_02", "鈴木 花子", "dept_01", "sales"},
		{"user_03", "佐藤 次郎", "dept_01", "sales"},
		{"user_04", "山田 部長", "dept_01", "manager"},
		{"user_05", "伊藤 三郎", "dept_02", "sales"},
		{"user_06", "渡辺 美咲", "dept_02", "sales"},
		{"user_07", "中村 係長", "dept_02", "manager"},
		{"user_08", "小林 四郎", "dept_03", "sales"},
		{"user_09", "加藤 京子", "dept_03", "sales"},
		{"user_10", "吉田 部長", "dept_03", "manager"},
		{"user_11", "社長", "dept_01", "executive"},
		{"user_12", "admin", "dept_01", "admin"},
	}
	for _, u := range users {
		if _, err := tx.Exec(
			`INSERT INTO users(id,name,dept_id,role,password,is_active,created_at) VALUES(?,?,?,?,?,1,?)`,
			u.id, u.name, u.dept, u.role, hash, now,
		); err != nil {
			return err
		}
	}

	// 代表的な案件データ（コーチング分析用の phase_change ログ付き）
	deals := []struct {
		id, name, closeDate, assigneeID, deptID, assigneeName, deptName string
		amount                                                           int
		phases, bant                                                     string
		isWon, isLost                                                    int
		createdAt, updatedAt                                             string
	}{
		{"deal_01", "ABC商事 業務効率化システム", "2026-06-30", "user_01", "dept_01", "田中 一郎", "東日本営業部", 1200000, `[true,false,false,false]`, `{"B":1,"A":0,"N":1,"T":0}`, 0, 0, "2026-04-01T09:00:00Z", "2026-04-10T14:00:00Z"},
		{"deal_02", "DEF製造 在庫管理導入", "2026-07-31", "user_02", "dept_01", "鈴木 花子", "東日本営業部", 2800000, `[true,false,false,false]`, `{"B":2,"A":1,"N":2,"T":0}`, 0, 0, "2026-04-05T10:00:00Z", "2026-04-15T11:00:00Z"},
		{"deal_04", "JKL物流 配車最適化", "2026-06-15", "user_03", "dept_01", "佐藤 次郎", "東日本営業部", 4500000, `[true,true,false,false]`, `{"B":2,"A":2,"N":2,"T":1}`, 0, 0, "2026-03-15T09:00:00Z", "2026-04-20T10:00:00Z"},
		{"deal_07", "STU銀行 融資審査自動化", "2026-05-31", "user_01", "dept_01", "田中 一郎", "東日本営業部", 12000000, `[true,true,true,false]`, `{"B":2,"A":2,"N":2,"T":2}`, 0, 0, "2026-02-01T09:00:00Z", "2026-04-25T10:00:00Z"},
		{"deal_08", "VWX流通 SCM刷新", "2026-06-30", "user_09", "dept_03", "加藤 京子", "中部営業部", 7600000, `[true,true,true,false]`, `{"B":1,"A":1,"N":1,"T":0}`, 0, 0, "2026-02-15T10:00:00Z", "2026-04-28T11:00:00Z"},
		{"deal_09", "YZA食品 需要予測AI", "2026-05-31", "user_05", "dept_02", "伊藤 三郎", "西日本営業部", 9800000, `[true,true,true,true]`, `{"B":2,"A":2,"N":2,"T":2}`, 0, 0, "2026-01-15T09:00:00Z", "2026-05-01T14:00:00Z"},
		{"deal_10", "BCD製造 ERP導入", "2026-03-31", "user_02", "dept_01", "鈴木 花子", "東日本営業部", 15000000, `[true,true,true,true]`, `{"B":2,"A":2,"N":2,"T":2}`, 1, 0, "2025-10-01T09:00:00Z", "2026-03-31T17:00:00Z"},
		{"deal_11", "EFG物流 車両管理", "2026-04-15", "user_08", "dept_03", "小林 四郎", "中部営業部", 4200000, `[true,true,true,true]`, `{"B":2,"A":2,"N":1,"T":2}`, 1, 0, "2025-12-01T09:00:00Z", "2026-04-15T17:00:00Z"},
		{"deal_12", "HIJ小売 ECサイト構築", "2026-02-28", "user_06", "dept_02", "渡辺 美咲", "西日本営業部", 3800000, `[true,true,true,true]`, `{"B":2,"A":2,"N":2,"T":2}`, 1, 0, "2025-11-01T09:00:00Z", "2026-02-28T17:00:00Z"},
		{"deal_13", "KLM製造 生産管理システム", "2026-03-31", "user_01", "dept_01", "田中 一郎", "東日本営業部", 2200000, `[true,false,false,false]`, `{"B":0,"A":0,"N":1,"T":0}`, 0, 1, "2026-01-20T09:00:00Z", "2026-03-01T17:00:00Z"},
		{"deal_18", "ZAB保険 基幹システム刷新", "2026-08-31", "user_01", "dept_01", "田中 一郎", "東日本営業部", 5500000, `[true,true,false,false]`, `{"B":1,"A":0,"N":1,"T":0}`, 0, 0, "2025-12-01T09:00:00Z", "2026-02-18T17:00:00Z"},
		{"deal_19", "BCD不動産 物件管理システム", "2026-02-28", "user_01", "dept_01", "田中 一郎", "東日本営業部", 1900000, `[true,false,false,false]`, `{"B":0,"A":0,"N":0,"T":0}`, 0, 1, "2026-01-05T09:00:00Z", "2026-02-20T17:00:00Z"},
		{"deal_48", "関西電機 ERP全面刷新", "2026-06-30", "user_01", "dept_01", "田中 一郎", "東日本営業部", 18000000, `[true,true,true,true]`, `{"B":2,"A":2,"N":2,"T":2}`, 0, 0, "2025-09-01T09:00:00Z", "2026-01-05T09:00:00Z"},
	}
	for _, d := range deals {
		if _, err := tx.Exec(
			`INSERT INTO deals(id,name,amount,close_date,assignee_id,dept_id,assignee_name,dept_name,phases,bant,amount_history,ball_owner,ball_detail,is_won,is_lost,created_at,updated_at)
			 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			d.id, d.name, d.amount, d.closeDate, d.assigneeID, d.deptID,
			d.assigneeName, d.deptName, d.phases, d.bant, "[]",
			"sales", "", d.isWon, d.isLost, d.createdAt, d.updatedAt,
		); err != nil {
			return err
		}
	}

	activities := []struct {
		id, dealID, atype, date, content, authorID, authorName string
	}{
		{"act_d07a", "deal_07", "phase_change", "2026-02-06", "▲ Phase 0 → Phase 1", "user_01", "田中 一郎"},
		{"act_d07b", "deal_07", "phase_change", "2026-02-20", "▲ Phase 1 → Phase 2", "user_01", "田中 一郎"},
		{"act_d07c", "deal_07", "phase_change", "2026-03-22", "▲ Phase 2 → Phase 3", "user_01", "田中 一郎"},
		{"act_d09a", "deal_09", "phase_change", "2026-01-20", "▲ Phase 0 → Phase 1", "user_05", "伊藤 三郎"},
		{"act_d09b", "deal_09", "phase_change", "2026-02-03", "▲ Phase 1 → Phase 2", "user_05", "伊藤 三郎"},
		{"act_d09c", "deal_09", "phase_change", "2026-02-26", "▲ Phase 2 → Phase 3", "user_05", "伊藤 三郎"},
		{"act_d09d", "deal_09", "phase_change", "2026-03-24", "▲ Phase 3 → Phase 4", "user_05", "伊藤 三郎"},
		{"act_d10a", "deal_10", "phase_change", "2025-10-08", "▲ Phase 0 → Phase 1", "user_02", "鈴木 花子"},
		{"act_d10b", "deal_10", "phase_change", "2025-10-30", "▲ Phase 1 → Phase 2", "user_02", "鈴木 花子"},
		{"act_d10c", "deal_10", "phase_change", "2025-11-27", "▲ Phase 2 → Phase 3", "user_02", "鈴木 花子"},
		{"act_d10d", "deal_10", "phase_change", "2026-01-01", "▲ Phase 3 → Phase 4", "user_02", "鈴木 花子"},
		{"act_d13a", "deal_13", "phase_change", "2026-01-26", "▲ Phase 0 → Phase 1", "user_01", "田中 一郎"},
		{"act_d18a", "deal_18", "phase_change", "2025-12-10", "▲ Phase 0 → Phase 1", "user_01", "田中 一郎"},
		{"act_d18b", "deal_18", "phase_change", "2026-02-18", "▲ Phase 1 → Phase 2", "user_01", "田中 一郎"},
		{"act_d19a", "deal_19", "phase_change", "2026-01-12", "▲ Phase 0 → Phase 1", "user_01", "田中 一郎"},
		{"act_push01", "deal_07", "close_date_change", "2025-12-31", "📅 想定受注日 2026-01-31 → 2026-03-31", "user_01", "田中 一郎"},
		{"act_push02", "deal_07", "close_date_change", "2026-03-01", "📅 想定受注日 2026-03-31 → 2026-04-30", "user_01", "田中 一郎"},
		{"act_push03", "deal_07", "close_date_change", "2026-04-15", "📅 想定受注日 2026-04-30 → 2026-05-31", "user_01", "田中 一郎"},
		{"act_m01", "deal_07", "visit", "2026-03-05", "決裁会議の事前説明。CFO同席。予算確保の確認取れた。", "user_01", "田中 一郎"},
		{"act_m02", "deal_07", "call", "2026-03-15", "担当者フォローコール。決裁会議は3/22に確定。", "user_01", "田中 一郎"},
		{"act_m04", "deal_04", "email", "2026-04-10", "見積書送付済み。来週中に回答もらう約束。", "user_03", "佐藤 次郎"},
	}
	for _, a := range activities {
		if _, err := tx.Exec(
			`INSERT INTO activities(id,deal_id,type,date,content,author_id,author_name,created_at)
			 VALUES(?,?,?,?,?,?,?,?)`,
			a.id, a.dealID, a.atype, a.date, a.content, a.authorID, a.authorName,
			a.date+"T09:00:00Z",
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}
