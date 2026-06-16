// repo.go: データベース CRUD 実装。
// PostgreSQL 移行時は ? を $1,$2... に rebind するだけでほぼ動く。
package repo

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// DB は *sql.DB のラッパー。テスト時はインメモリ SQLite を渡す。
type DB struct{ db *sql.DB }

func New(db *sql.DB) *DB { return &DB{db} }

// ---------- Users ----------

func (r *DB) ListUsers() ([]User, error) {
	rows, err := r.db.Query(
		`SELECT id,name,dept_id,role,email,is_active,created_at FROM users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		var active int
		var email sql.NullString
		if err := rows.Scan(&u.ID, &u.Name, &u.DeptID, &u.Role, &email, &active, &u.CreatedAt); err != nil {
			return nil, err
		}
		u.IsActive = active == 1
		u.Email = email.String
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *DB) GetUserByName(name string) (*User, error) {
	var u User
	var active int
	var email sql.NullString
	err := r.db.QueryRow(
		`SELECT id,name,dept_id,role,password,email,is_active,created_at FROM users WHERE name=?`, name,
	).Scan(&u.ID, &u.Name, &u.DeptID, &u.Role, &u.Password, &email, &active, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.IsActive = active == 1
	u.Email = email.String
	return &u, nil
}

func (r *DB) GetUser(id string) (*User, error) {
	var u User
	var active int
	var email sql.NullString
	err := r.db.QueryRow(
		`SELECT id,name,dept_id,role,email,is_active,created_at FROM users WHERE id=?`, id,
	).Scan(&u.ID, &u.Name, &u.DeptID, &u.Role, &email, &active, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.IsActive = active == 1
	u.Email = email.String
	return &u, nil
}

func (r *DB) GetUserByGoogleID(googleID string) (*User, error) {
	var u User
	var active int
	var email sql.NullString
	err := r.db.QueryRow(
		`SELECT id,name,dept_id,role,email,is_active,created_at FROM users WHERE google_id=?`, googleID,
	).Scan(&u.ID, &u.Name, &u.DeptID, &u.Role, &email, &active, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.IsActive = active == 1
	u.Email = email.String
	return &u, nil
}

func (r *DB) GetUserByEmail(email string) (*User, error) {
	var u User
	var active int
	var emailNull sql.NullString
	err := r.db.QueryRow(
		`SELECT id,name,dept_id,role,email,is_active,created_at FROM users WHERE email=?`, email,
	).Scan(&u.ID, &u.Name, &u.DeptID, &u.Role, &emailNull, &active, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.IsActive = active == 1
	u.Email = emailNull.String
	return &u, nil
}

func (r *DB) LinkGoogleID(userID, googleID string) error {
	_, err := r.db.Exec(`UPDATE users SET google_id=? WHERE id=?`, googleID, userID)
	return err
}

func (r *DB) CreateUser(u *User) error {
	_, err := r.db.Exec(
		`INSERT INTO users(id,name,dept_id,role,password,email,is_active,created_at) VALUES(?,?,?,?,?,?,?,?)`,
		u.ID, u.Name, u.DeptID, u.Role, u.Password, nullString(u.Email), boolInt(u.IsActive), u.CreatedAt,
	)
	return err
}

func (r *DB) UpdateUser(u *User) error {
	res, err := r.db.Exec(
		`UPDATE users SET name=?,dept_id=?,role=?,email=?,is_active=? WHERE id=?`,
		u.Name, u.DeptID, u.Role, nullString(u.Email), boolInt(u.IsActive), u.ID,
	)
	if err != nil {
		return err
	}
	return expectOne(res)
}

// UpdateUserPassword はパスワードのみ更新する。
func (r *DB) UpdateUserPassword(id, hashedPassword string) error {
	_, err := r.db.Exec(`UPDATE users SET password=? WHERE id=?`, hashedPassword, id)
	return err
}

// ---------- Depts ----------

func (r *DB) ListDepts() ([]Dept, error) {
	rows, err := r.db.Query(
		`SELECT id,name,is_active,created_at FROM depts ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var depts []Dept
	for rows.Next() {
		var d Dept
		var active int
		if err := rows.Scan(&d.ID, &d.Name, &active, &d.CreatedAt); err != nil {
			return nil, err
		}
		d.IsActive = active == 1
		depts = append(depts, d)
	}
	return depts, rows.Err()
}

func (r *DB) CreateDept(d *Dept) error {
	_, err := r.db.Exec(
		`INSERT INTO depts(id,name,is_active,created_at) VALUES(?,?,?,?)`,
		d.ID, d.Name, boolInt(d.IsActive), d.CreatedAt,
	)
	return err
}

func (r *DB) UpdateDept(d *Dept) error {
	res, err := r.db.Exec(
		`UPDATE depts SET name=?,is_active=? WHERE id=?`,
		d.Name, boolInt(d.IsActive), d.ID,
	)
	if err != nil {
		return err
	}
	return expectOne(res)
}

// ---------- Deals ----------

func (r *DB) ListDeals() ([]Deal, error) {
	rows, err := r.db.Query(
		`SELECT id,name,amount,cost_amount,close_date,assignee_id,dept_id,
		        assignee_name,dept_name,phases,bant,amount_history,
		        ball_owner,ball_detail,is_won,is_lost,created_at,updated_at
		 FROM deals ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var deals []Deal
	for rows.Next() {
		d, err := scanDeal(rows)
		if err != nil {
			return nil, err
		}
		deals = append(deals, d)
	}
	return deals, rows.Err()
}

func (r *DB) GetDeal(id string) (*Deal, error) {
	row := r.db.QueryRow(
		`SELECT id,name,amount,cost_amount,close_date,assignee_id,dept_id,
		        assignee_name,dept_name,phases,bant,amount_history,
		        ball_owner,ball_detail,is_won,is_lost,created_at,updated_at
		 FROM deals WHERE id=?`, id)
	d, err := scanDeal(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *DB) CreateDeal(d *Deal) error {
	phasesJSON, bantJSON, histJSON, err := marshalDealJSON(d)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(
		`INSERT INTO deals(id,name,amount,cost_amount,close_date,assignee_id,dept_id,
		  assignee_name,dept_name,phases,bant,amount_history,
		  ball_owner,ball_detail,is_won,is_lost,created_at,updated_at)
		 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		d.ID, d.Name, d.Amount, nullInt(d.CostAmount), d.CloseDate,
		d.AssigneeID, d.DeptID, d.AssigneeName, d.DeptName,
		phasesJSON, bantJSON, histJSON,
		d.BallOwner, d.BallDetail, boolInt(d.IsWon), boolInt(d.IsLost),
		d.CreatedAt, d.UpdatedAt,
	)
	return err
}

func (r *DB) UpdateDeal(d *Deal) error {
	phasesJSON, bantJSON, histJSON, err := marshalDealJSON(d)
	if err != nil {
		return err
	}
	res, err := r.db.Exec(
		`UPDATE deals SET name=?,amount=?,cost_amount=?,close_date=?,assignee_id=?,dept_id=?,
		  assignee_name=?,dept_name=?,phases=?,bant=?,amount_history=?,
		  ball_owner=?,ball_detail=?,is_won=?,is_lost=?,updated_at=?
		 WHERE id=?`,
		d.Name, d.Amount, nullInt(d.CostAmount), d.CloseDate,
		d.AssigneeID, d.DeptID, d.AssigneeName, d.DeptName,
		phasesJSON, bantJSON, histJSON,
		d.BallOwner, d.BallDetail, boolInt(d.IsWon), boolInt(d.IsLost),
		d.UpdatedAt, d.ID,
	)
	if err != nil {
		return err
	}
	return expectOne(res)
}

// ---------- Activities ----------

func (r *DB) ListActivities() ([]Activity, error) {
	rows, err := r.db.Query(
		`SELECT id,deal_id,type,date,content,author_id,author_name,cost,duration,created_at
		 FROM activities ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanActivities(rows)
}

func (r *DB) ListActivitiesByDeal(dealID string) ([]Activity, error) {
	rows, err := r.db.Query(
		`SELECT id,deal_id,type,date,content,author_id,author_name,cost,duration,created_at
		 FROM activities WHERE deal_id=? ORDER BY created_at DESC`, dealID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanActivities(rows)
}

func (r *DB) CreateActivity(a *Activity) error {
	_, err := r.db.Exec(
		`INSERT INTO activities(id,deal_id,type,date,content,author_id,author_name,cost,duration,created_at)
		 VALUES(?,?,?,?,?,?,?,?,?,?)`,
		a.ID, a.DealID, a.Type, a.Date, a.Content,
		a.AuthorID, a.AuthorName, a.Cost, a.Duration, a.CreatedAt,
	)
	return err
}

// ---------- Targets ----------

func (r *DB) GetTargets() (Targets, error) {
	t := Targets{
		Dept: make(map[string]map[string]int64),
		Rep:  make(map[string]map[string]int64),
	}
	rows, err := r.db.Query(`SELECT target_type,entity_id,quarter_key,amount FROM targets`)
	if err != nil {
		return t, err
	}
	defer rows.Close()
	for rows.Next() {
		var ttype, eid, qk string
		var amount int64
		if err := rows.Scan(&ttype, &eid, &qk, &amount); err != nil {
			return t, err
		}
		switch ttype {
		case "dept":
			if t.Dept[eid] == nil {
				t.Dept[eid] = make(map[string]int64)
			}
			t.Dept[eid][qk] = amount
		case "rep":
			if t.Rep[eid] == nil {
				t.Rep[eid] = make(map[string]int64)
			}
			t.Rep[eid][qk] = amount
		}
	}
	return t, rows.Err()
}

func (r *DB) UpsertTarget(targetType, entityID, quarterKey string, amount int64) error {
	if amount <= 0 {
		_, err := r.db.Exec(
			`DELETE FROM targets WHERE target_type=? AND entity_id=? AND quarter_key=?`,
			targetType, entityID, quarterKey,
		)
		return err
	}
	_, err := r.db.Exec(
		`INSERT INTO targets(target_type,entity_id,quarter_key,amount) VALUES(?,?,?,?)
		 ON CONFLICT(target_type,entity_id,quarter_key) DO UPDATE SET amount=excluded.amount`,
		targetType, entityID, quarterKey, amount,
	)
	return err
}

// ---------- Settings ----------

func (r *DB) GetSettings() (Settings, error) {
	var s Settings
	var lockJSON string
	err := r.db.QueryRow(
		`SELECT fiscal_start_month,bant_preset,phase_preset,lock_config FROM settings WHERE id=1`,
	).Scan(&s.FiscalStartMonth, &s.BANTPreset, &s.PhasePreset, &lockJSON)
	if err != nil {
		return s, err
	}
	if err := json.Unmarshal([]byte(lockJSON), &s.LockConfig); err != nil {
		s.LockConfig = map[string]any{}
	}
	return s, nil
}

func (r *DB) SaveSettings(s Settings) error {
	lockJSON, err := json.Marshal(s.LockConfig)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(
		`UPDATE settings SET fiscal_start_month=?,bant_preset=?,phase_preset=?,lock_config=? WHERE id=1`,
		s.FiscalStartMonth, s.BANTPreset, s.PhasePreset, string(lockJSON),
	)
	return err
}

// ---------- Sessions ----------

func (r *DB) CreateSession(s *Session) error {
	_, err := r.db.Exec(
		`INSERT INTO sessions(id,user_id,created_at,expires_at) VALUES(?,?,?,?)`,
		s.ID, s.UserID, s.CreatedAt, s.ExpiresAt,
	)
	return err
}

func (r *DB) GetSession(id string) (*Session, error) {
	var s Session
	err := r.db.QueryRow(
		`SELECT id,user_id,created_at,expires_at FROM sessions WHERE id=?`, id,
	).Scan(&s.ID, &s.UserID, &s.CreatedAt, &s.ExpiresAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *DB) DeleteSession(id string) error {
	_, err := r.db.Exec(`DELETE FROM sessions WHERE id=?`, id)
	return err
}

func (r *DB) PurgeExpiredSessions() error {
	_, err := r.db.Exec(`DELETE FROM sessions WHERE expires_at < ?`,
		time.Now().UTC().Format(time.RFC3339))
	return err
}

// ---------- ヘルパー ----------

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func nullInt(p *int64) any {
	if p == nil {
		return nil
	}
	return *p
}

func nullString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func expectOne(res sql.Result) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("record not found")
	}
	return nil
}

func marshalDealJSON(d *Deal) (phasesJSON, bantJSON, histJSON string, err error) {
	pb, e := json.Marshal(d.Phases)
	if e != nil {
		return "", "", "", e
	}
	bb, e := json.Marshal(d.BANT)
	if e != nil {
		return "", "", "", e
	}
	hist := d.AmountHistory
	if hist == nil {
		hist = []AmountHistory{}
	}
	hb, e := json.Marshal(hist)
	if e != nil {
		return "", "", "", e
	}
	return string(pb), string(bb), string(hb), nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanDeal(s scanner) (Deal, error) {
	var d Deal
	var phasesJSON, bantJSON, histJSON string
	var isWon, isLost int
	var costAmount sql.NullInt64
	err := s.Scan(
		&d.ID, &d.Name, &d.Amount, &costAmount, &d.CloseDate,
		&d.AssigneeID, &d.DeptID, &d.AssigneeName, &d.DeptName,
		&phasesJSON, &bantJSON, &histJSON,
		&d.BallOwner, &d.BallDetail, &isWon, &isLost,
		&d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return d, err
	}
	d.IsWon = isWon == 1
	d.IsLost = isLost == 1
	if costAmount.Valid {
		v := costAmount.Int64
		d.CostAmount = &v
	}
	if err := json.Unmarshal([]byte(phasesJSON), &d.Phases); err != nil {
		d.Phases = []bool{false, false, false, false}
	}
	if err := json.Unmarshal([]byte(bantJSON), &d.BANT); err != nil {
		d.BANT = map[string]int{"B": 0, "A": 0, "N": 0, "T": 0}
	}
	if err := json.Unmarshal([]byte(histJSON), &d.AmountHistory); err != nil {
		d.AmountHistory = []AmountHistory{}
	}
	return d, nil
}

func scanActivities(rows *sql.Rows) ([]Activity, error) {
	var acts []Activity
	for rows.Next() {
		var a Activity
		var cost, duration sql.NullInt64
		if err := rows.Scan(
			&a.ID, &a.DealID, &a.Type, &a.Date, &a.Content,
			&a.AuthorID, &a.AuthorName, &cost, &duration, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		if cost.Valid {
			v := cost.Int64
			a.Cost = &v
		}
		if duration.Valid {
			v := duration.Int64
			a.Duration = &v
		}
		acts = append(acts, a)
	}
	return acts, rows.Err()
}
