// handler_test.go: HTTP ハンドラの統合テスト。
// net/http/httptest を使い、実際の HTTP リクエストを投げてレスポンスを検証する。
package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"micro-sfa/db"
	"micro-sfa/handler"
	"micro-sfa/repo"
)

func setupApp(t *testing.T) (*handler.App, *repo.DB) {
	t.Helper()
	rawDB, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("db.Open: %v", err)
	}
	if err := db.Migrate(rawDB); err != nil {
		t.Fatalf("db.Migrate: %v", err)
	}
	if err := db.Seed(rawDB); err != nil {
		t.Fatalf("db.Seed: %v", err)
	}
	t.Cleanup(func() { rawDB.Close() })
	r := repo.New(rawDB)
	return &handler.App{Repo: r}, r
}

func do(t *testing.T, app *handler.App, method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	app.Routes().ServeHTTP(w, req)
	return w
}

// loginAs はデモユーザーとしてログインし、セッション Cookie を返す。
func loginAs(t *testing.T, app *handler.App, name string) *http.Cookie {
	t.Helper()
	w := do(t, app, "POST", "/auth/login", map[string]string{
		"name": name, "password": "demo1234",
	}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", w.Code, w.Body.String())
	}
	for _, c := range w.Result().Cookies() {
		if c.Name == "sfa_session" {
			return c
		}
	}
	t.Fatal("no session cookie")
	return nil
}

// ---------- Auth ----------

func TestLogin_Success(t *testing.T) {
	app, _ := setupApp(t)
	w := do(t, app, "POST", "/auth/login", map[string]string{
		"name": "田中 一郎", "password": "demo1234",
	}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var user repo.User
	json.NewDecoder(w.Body).Decode(&user)
	if user.Name != "田中 一郎" {
		t.Errorf("unexpected user: %+v", user)
	}
	if user.Password != "" {
		t.Error("password should not be in response")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	app, _ := setupApp(t)
	w := do(t, app, "POST", "/auth/login", map[string]string{
		"name": "田中 一郎", "password": "wrong",
	}, nil)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestLogin_UnknownUser(t *testing.T) {
	app, _ := setupApp(t)
	w := do(t, app, "POST", "/auth/login", map[string]string{
		"name": "存在しない", "password": "demo1234",
	}, nil)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestLogout(t *testing.T) {
	app, _ := setupApp(t)
	cookie := loginAs(t, app, "田中 一郎")

	w := do(t, app, "POST", "/auth/logout", nil, cookie)
	if w.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", w.Code)
	}

	// ログアウト後は認証が通らない
	w2 := do(t, app, "GET", "/deals", nil, cookie)
	if w2.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 after logout, got %d", w2.Code)
	}
}

func TestMe(t *testing.T) {
	app, _ := setupApp(t)
	cookie := loginAs(t, app, "田中 一郎")
	w := do(t, app, "GET", "/me", nil, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var u repo.User
	json.NewDecoder(w.Body).Decode(&u)
	if u.Role != "sales" {
		t.Errorf("unexpected role: %s", u.Role)
	}
}

func TestUnauthorizedWithoutCookie(t *testing.T) {
	app, _ := setupApp(t)
	w := do(t, app, "GET", "/deals", nil, nil)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

// ---------- Deals ----------

func TestDeals_ListAndCreate(t *testing.T) {
	app, _ := setupApp(t)
	cookie := loginAs(t, app, "田中 一郎")

	// シードデータが入っている
	w := do(t, app, "GET", "/deals", nil, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var deals []repo.Deal
	json.NewDecoder(w.Body).Decode(&deals)
	if len(deals) == 0 {
		t.Error("expected seed deals")
	}

	// 新規作成
	now := time.Now().Format(time.RFC3339)
	newDeal := repo.Deal{
		ID: "deal_test", Name: "テスト案件", Amount: 500000,
		CloseDate: "2026-12-31", AssigneeID: "user_01", DeptID: "dept_01",
		AssigneeName: "田中 一郎", DeptName: "東日本営業部",
		Phases: []bool{true, false, false, false},
		BANT:   map[string]int{"B": 1, "A": 0, "N": 1, "T": 0},
		BallOwner: "sales", CreatedAt: now, UpdatedAt: now,
	}
	w2 := do(t, app, "POST", "/deals", newDeal, cookie)
	if w2.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w2.Code, w2.Body.String())
	}
}

func TestDeals_Update(t *testing.T) {
	app, r := setupApp(t)
	cookie := loginAs(t, app, "田中 一郎")

	deals, _ := r.ListDeals()
	d := deals[0]
	d.Amount = 9999999
	d.UpdatedAt = time.Now().Format(time.RFC3339)

	w := do(t, app, "PUT", "/deals/"+d.ID, d, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	updated, _ := r.GetDeal(d.ID)
	if updated.Amount != 9999999 {
		t.Errorf("amount not updated: %d", updated.Amount)
	}
}

func TestDeals_UpdateNotFound(t *testing.T) {
	app, _ := setupApp(t)
	cookie := loginAs(t, app, "田中 一郎")
	w := do(t, app, "PUT", "/deals/nonexistent", repo.Deal{
		ID: "nonexistent", Phases: []bool{false, false, false, false},
		BANT: map[string]int{"B": 0, "A": 0, "N": 0, "T": 0},
		UpdatedAt: time.Now().Format(time.RFC3339),
	}, cookie)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

// ---------- Users ----------

func TestUsers_ListAndCreate(t *testing.T) {
	app, _ := setupApp(t)
	cookie := loginAs(t, app, "admin")

	w := do(t, app, "GET", "/users", nil, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var users []repo.User
	json.NewDecoder(w.Body).Decode(&users)
	if len(users) == 0 {
		t.Error("expected seed users")
	}
	// パスワードはレスポンスに含まれない
	for _, u := range users {
		if u.Password != "" {
			t.Errorf("password leaked: %s", u.Name)
		}
	}

	// 新規ユーザー追加
	w2 := do(t, app, "POST", "/users", map[string]any{
		"id": "new_user", "name": "新入社員", "dept_id": "dept_01",
		"role": "sales", "password": "newpass123",
		"isActive": true, "createdAt": time.Now().Format(time.RFC3339),
	}, cookie)
	if w2.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w2.Code, w2.Body.String())
	}
}

// ---------- Activities ----------

func TestActivities_CreateAndList(t *testing.T) {
	app, _ := setupApp(t)
	cookie := loginAs(t, app, "田中 一郎")

	now := time.Now().Format(time.RFC3339)
	act := repo.Activity{
		ID: "act_test", DealID: "deal_07", Type: "visit",
		Date: "2026-06-01", Content: "テスト訪問",
		AuthorID: "user_01", AuthorName: "田中 一郎", CreatedAt: now,
	}
	w := do(t, app, "POST", "/activities", act, cookie)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	w2 := do(t, app, "GET", "/activities?deal_id=deal_07", nil, cookie)
	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w2.Code)
	}
	var acts []repo.Activity
	json.NewDecoder(w2.Body).Decode(&acts)
	found := false
	for _, a := range acts {
		if a.ID == "act_test" {
			found = true
		}
	}
	if !found {
		t.Error("created activity not found in list")
	}
}

// ---------- Targets ----------

func TestTargets_UpsertAndGet(t *testing.T) {
	app, _ := setupApp(t)
	cookie := loginAs(t, app, "山田 部長")

	w := do(t, app, "PUT", "/targets", map[string]any{
		"target_type": "rep", "entity_id": "user_01",
		"quarter_key": "FY2026-Q1", "amount": 5000000,
	}, cookie)
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", w.Code, w.Body.String())
	}

	w2 := do(t, app, "GET", "/targets", nil, cookie)
	var targets repo.Targets
	json.NewDecoder(w2.Body).Decode(&targets)
	if targets.Rep["user_01"]["FY2026-Q1"] != 5000000 {
		t.Errorf("target not saved: %+v", targets)
	}
}

// ---------- Settings ----------

func TestSettings_GetAndSave(t *testing.T) {
	app, _ := setupApp(t)
	cookie := loginAs(t, app, "admin")

	w := do(t, app, "GET", "/settings", nil, cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var s repo.Settings
	json.NewDecoder(w.Body).Decode(&s)
	if s.FiscalStartMonth != 4 {
		t.Errorf("default FiscalStartMonth: %d", s.FiscalStartMonth)
	}

	s.FiscalStartMonth = 1
	w2 := do(t, app, "PUT", "/settings", s, cookie)
	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w2.Code, w2.Body.String())
	}
}
