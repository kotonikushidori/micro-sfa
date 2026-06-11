// repo_test.go: インメモリ SQLite でリポジトリ層を検証する。
// PostgreSQL 移行後もこのテストをそのまま走らせれば回帰を防げる。
package repo_test

import (
	"database/sql"
	"testing"
	"time"

	"micro-sfa/db"
	"micro-sfa/repo"
)

// setupDB はテストごとに独立したインメモリ DB を返す。
func setupDB(t *testing.T) *repo.DB {
	t.Helper()
	rawDB, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("db.Open: %v", err)
	}
	if err := db.Migrate(rawDB); err != nil {
		t.Fatalf("db.Migrate: %v", err)
	}
	t.Cleanup(func() { rawDB.Close() })
	return repo.New(rawDB)
}

// ---------- Users ----------

func TestUser_CreateAndGet(t *testing.T) {
	r := setupDB(t)

	u := &repo.User{
		ID: "u1", Name: "テスト太郎", DeptID: "dept1",
		Role: "sales", Password: "hash123",
		IsActive: true, CreatedAt: time.Now().Format(time.RFC3339),
	}
	if err := r.CreateUser(u); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	got, err := r.GetUser("u1")
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if got == nil {
		t.Fatal("GetUser: nil")
	}
	if got.Name != u.Name {
		t.Errorf("Name: got %q, want %q", got.Name, u.Name)
	}
	if got.IsActive != true {
		t.Error("IsActive should be true")
	}
}

func TestUser_ListEmpty(t *testing.T) {
	r := setupDB(t)
	users, err := r.ListUsers()
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if len(users) != 0 {
		t.Errorf("expected 0, got %d", len(users))
	}
}

func TestUser_Update(t *testing.T) {
	r := setupDB(t)
	now := time.Now().Format(time.RFC3339)
	u := &repo.User{ID: "u2", Name: "田中", DeptID: "d1", Role: "sales", Password: "x", IsActive: true, CreatedAt: now}
	if err := r.CreateUser(u); err != nil {
		t.Fatal(err)
	}
	u.Role = "manager"
	if err := r.UpdateUser(u); err != nil {
		t.Fatalf("UpdateUser: %v", err)
	}
	got, _ := r.GetUser("u2")
	if got.Role != "manager" {
		t.Errorf("Role: got %q, want manager", got.Role)
	}
}

func TestUser_GetByName(t *testing.T) {
	r := setupDB(t)
	now := time.Now().Format(time.RFC3339)
	u := &repo.User{ID: "u3", Name: "鈴木", DeptID: "d1", Role: "sales", Password: "pw", IsActive: true, CreatedAt: now}
	r.CreateUser(u)

	got, err := r.GetUserByName("鈴木")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.Password != "pw" {
		t.Error("GetUserByName: password not returned")
	}

	none, _ := r.GetUserByName("存在しない")
	if none != nil {
		t.Error("expected nil for unknown user")
	}
}

// ---------- Depts ----------

func TestDept_CreateListUpdate(t *testing.T) {
	r := setupDB(t)
	now := time.Now().Format(time.RFC3339)
	d := &repo.Dept{ID: "dept1", Name: "東京支社", IsActive: true, CreatedAt: now}
	if err := r.CreateDept(d); err != nil {
		t.Fatalf("CreateDept: %v", err)
	}

	depts, _ := r.ListDepts()
	if len(depts) != 1 || depts[0].Name != "東京支社" {
		t.Errorf("ListDepts: unexpected %+v", depts)
	}

	d.IsActive = false
	if err := r.UpdateDept(d); err != nil {
		t.Fatalf("UpdateDept: %v", err)
	}
	depts, _ = r.ListDepts()
	if depts[0].IsActive {
		t.Error("expected IsActive=false after update")
	}
}

// ---------- Deals ----------

func TestDeal_CreateListUpdate(t *testing.T) {
	r := setupDB(t)
	now := time.Now().Format(time.RFC3339)

	d := &repo.Deal{
		ID: "deal1", Name: "テスト案件", Amount: 1000000,
		CloseDate: "2026-12-31", AssigneeID: "u1", DeptID: "d1",
		AssigneeName: "田中", DeptName: "東京",
		Phases:    []bool{true, false, false, false},
		BANT:      map[string]int{"B": 1, "A": 0, "N": 1, "T": 0},
		BallOwner: "sales", IsWon: false, IsLost: false,
		CreatedAt: now, UpdatedAt: now,
	}
	if err := r.CreateDeal(d); err != nil {
		t.Fatalf("CreateDeal: %v", err)
	}

	deals, err := r.ListDeals()
	if err != nil {
		t.Fatalf("ListDeals: %v", err)
	}
	if len(deals) != 1 {
		t.Fatalf("expected 1 deal, got %d", len(deals))
	}
	if deals[0].BANT["B"] != 1 {
		t.Errorf("BANT.B: got %d, want 1", deals[0].BANT["B"])
	}
	if !deals[0].Phases[0] || deals[0].Phases[1] {
		t.Error("Phases not restored correctly")
	}

	// Update
	d.Amount = 2000000
	d.IsWon = true
	d.UpdatedAt = time.Now().Format(time.RFC3339)
	if err := r.UpdateDeal(d); err != nil {
		t.Fatalf("UpdateDeal: %v", err)
	}
	got, _ := r.GetDeal("deal1")
	if got.Amount != 2000000 || !got.IsWon {
		t.Errorf("UpdateDeal: unexpected %+v", got)
	}
}

func TestDeal_GetDeal_NotFound(t *testing.T) {
	r := setupDB(t)
	got, err := r.GetDeal("nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Error("expected nil for unknown deal")
	}
}

func TestDeal_CostAmount(t *testing.T) {
	r := setupDB(t)
	now := time.Now().Format(time.RFC3339)
	cost := int64(500000)
	d := &repo.Deal{
		ID: "deal2", Name: "粗利テスト", Amount: 1000000, CostAmount: &cost,
		CloseDate: "2026-12-31", AssigneeID: "u1", DeptID: "d1",
		AssigneeName: "x", DeptName: "y",
		Phases: []bool{false, false, false, false}, BANT: map[string]int{"B": 0, "A": 0, "N": 0, "T": 0},
		BallOwner: "sales", CreatedAt: now, UpdatedAt: now,
	}
	r.CreateDeal(d)
	got, _ := r.GetDeal("deal2")
	if got.CostAmount == nil || *got.CostAmount != 500000 {
		t.Error("CostAmount not persisted correctly")
	}
}

// ---------- Activities ----------

func TestActivity_CreateList(t *testing.T) {
	r := setupDB(t)
	now := time.Now().Format(time.RFC3339)
	a := &repo.Activity{
		ID: "act1", DealID: "deal1", Type: "visit", Date: "2026-06-01",
		Content: "初回訪問", AuthorID: "u1", AuthorName: "田中",
		CreatedAt: now,
	}
	if err := r.CreateActivity(a); err != nil {
		t.Fatalf("CreateActivity: %v", err)
	}

	acts, err := r.ListActivitiesByDeal("deal1")
	if err != nil {
		t.Fatalf("ListActivitiesByDeal: %v", err)
	}
	if len(acts) != 1 || acts[0].Content != "初回訪問" {
		t.Errorf("unexpected activities: %+v", acts)
	}

	// 別案件はヒットしない
	others, _ := r.ListActivitiesByDeal("deal_other")
	if len(others) != 0 {
		t.Error("expected no activities for other deal")
	}
}

func TestActivity_CostAndDuration(t *testing.T) {
	r := setupDB(t)
	now := time.Now().Format(time.RFC3339)
	cost := int64(1000)
	dur := int64(60)
	a := &repo.Activity{
		ID: "act2", DealID: "d", Type: "visit", Date: "2026-06-01",
		Content: "交通費あり", AuthorID: "u1", AuthorName: "x",
		Cost: &cost, Duration: &dur, CreatedAt: now,
	}
	r.CreateActivity(a)
	acts, _ := r.ListActivitiesByDeal("d")
	if acts[0].Cost == nil || *acts[0].Cost != 1000 {
		t.Error("Cost not persisted")
	}
}

// ---------- Targets ----------

func TestTargets_UpsertAndGet(t *testing.T) {
	r := setupDB(t)

	if err := r.UpsertTarget("rep", "u1", "FY2026-Q1", 5000000); err != nil {
		t.Fatalf("UpsertTarget: %v", err)
	}
	if err := r.UpsertTarget("dept", "d1", "FY2026-Q1", 10000000); err != nil {
		t.Fatal(err)
	}

	targets, err := r.GetTargets()
	if err != nil {
		t.Fatalf("GetTargets: %v", err)
	}
	if targets.Rep["u1"]["FY2026-Q1"] != 5000000 {
		t.Errorf("rep target: got %d", targets.Rep["u1"]["FY2026-Q1"])
	}
	if targets.Dept["d1"]["FY2026-Q1"] != 10000000 {
		t.Errorf("dept target: got %d", targets.Dept["d1"]["FY2026-Q1"])
	}
}

func TestTargets_DeleteOnZero(t *testing.T) {
	r := setupDB(t)
	r.UpsertTarget("rep", "u1", "FY2026-Q1", 5000000)
	r.UpsertTarget("rep", "u1", "FY2026-Q1", 0) // 0 で削除
	targets, _ := r.GetTargets()
	if _, ok := targets.Rep["u1"]; ok {
		t.Error("expected target to be deleted")
	}
}

// ---------- Settings ----------

func TestSettings_GetAndSave(t *testing.T) {
	r := setupDB(t)

	s, err := r.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings: %v", err)
	}
	if s.FiscalStartMonth != 4 {
		t.Errorf("default FiscalStartMonth: got %d", s.FiscalStartMonth)
	}

	s.FiscalStartMonth = 1
	s.BANTPreset = "manufacturing"
	s.LockConfig = map[string]any{"isWon": true}
	if err := r.SaveSettings(s); err != nil {
		t.Fatalf("SaveSettings: %v", err)
	}

	s2, _ := r.GetSettings()
	if s2.FiscalStartMonth != 1 || s2.BANTPreset != "manufacturing" {
		t.Errorf("SaveSettings not persisted: %+v", s2)
	}
}

// ---------- Sessions ----------

func TestSession_CreateGetDelete(t *testing.T) {
	r := setupDB(t)

	now := time.Now().UTC()
	s := &repo.Session{
		ID:        "sess1",
		UserID:    "u1",
		CreatedAt: now.Format(time.RFC3339),
		ExpiresAt: now.Add(24 * time.Hour).Format(time.RFC3339),
	}
	if err := r.CreateSession(s); err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	got, err := r.GetSession("sess1")
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	if got == nil || got.UserID != "u1" {
		t.Error("GetSession: unexpected result")
	}

	if err := r.DeleteSession("sess1"); err != nil {
		t.Fatalf("DeleteSession: %v", err)
	}
	after, _ := r.GetSession("sess1")
	if after != nil {
		t.Error("session should be deleted")
	}
}

// PurgeExpiredSessions のテスト: 期限切れのみ削除、有効なものは残る
func TestSession_Purge(t *testing.T) {
	r := setupDB(t)
	past := time.Now().Add(-1 * time.Hour).UTC().Format(time.RFC3339)
	future := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	now := time.Now().UTC().Format(time.RFC3339)

	r.CreateSession(&repo.Session{ID: "expired", UserID: "u1", CreatedAt: now, ExpiresAt: past})
	r.CreateSession(&repo.Session{ID: "valid", UserID: "u1", CreatedAt: now, ExpiresAt: future})

	if err := r.PurgeExpiredSessions(); err != nil {
		t.Fatal(err)
	}

	exp, _ := r.GetSession("expired")
	val, _ := r.GetSession("valid")
	if exp != nil {
		t.Error("expired session should be purged")
	}
	if val == nil {
		t.Error("valid session should remain")
	}
}

// UpdateUser on non-existent ID should return error
func TestUser_UpdateNotFound(t *testing.T) {
	r := setupDB(t)
	u := &repo.User{ID: "nonexistent", Name: "x", DeptID: "d", Role: "sales", IsActive: true, CreatedAt: time.Now().Format(time.RFC3339)}
	err := r.UpdateUser(u)
	if err == nil {
		t.Error("expected error for non-existent user")
	}
}

// helper: compile-time check that *sql.DB satisfies no interface (just verify import works)
var _ *sql.DB = nil
