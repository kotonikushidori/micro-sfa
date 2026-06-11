// handler.go: HTTP ハンドラ全定義。
// 認証は HTTP-only Cookie のセッション方式。
// すべてのルートは app.Routes() で登録し、main.go からマウントする。
package handler

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"micro-sfa/repo"
)

type App struct {
	Repo *repo.DB
}

type ctxKey string

const ctxUser ctxKey = "user"

// Routes は /api/* を処理する http.Handler を返す。
// main.go で http.Handle("/api/", http.StripPrefix("/api", app.Routes())) とする。
func (app *App) Routes() http.Handler {
	mux := http.NewServeMux()

	// 認証不要
	mux.HandleFunc("POST /auth/login", app.handleLogin)
	mux.HandleFunc("POST /auth/logout", app.handleLogout)

	// 認証必要
	auth := app.authMiddleware
	mux.Handle("GET /me", auth(http.HandlerFunc(app.handleMe)))

	mux.Handle("GET /deals", auth(http.HandlerFunc(app.handleListDeals)))
	mux.Handle("POST /deals", auth(http.HandlerFunc(app.handleCreateDeal)))
	mux.Handle("PUT /deals/{id}", auth(http.HandlerFunc(app.handleUpdateDeal)))

	mux.Handle("GET /users", auth(http.HandlerFunc(app.handleListUsers)))
	mux.Handle("POST /users", auth(http.HandlerFunc(app.handleCreateUser)))
	mux.Handle("PUT /users/{id}", auth(http.HandlerFunc(app.handleUpdateUser)))

	mux.Handle("GET /depts", auth(http.HandlerFunc(app.handleListDepts)))
	mux.Handle("POST /depts", auth(http.HandlerFunc(app.handleCreateDept)))
	mux.Handle("PUT /depts/{id}", auth(http.HandlerFunc(app.handleUpdateDept)))

	mux.Handle("GET /activities", auth(http.HandlerFunc(app.handleListActivities)))
	mux.Handle("POST /activities", auth(http.HandlerFunc(app.handleCreateActivity)))

	mux.Handle("GET /targets", auth(http.HandlerFunc(app.handleGetTargets)))
	mux.Handle("PUT /targets", auth(http.HandlerFunc(app.handleUpsertTarget)))

	mux.Handle("GET /settings", auth(http.HandlerFunc(app.handleGetSettings)))
	mux.Handle("PUT /settings", auth(http.HandlerFunc(app.handleSaveSettings)))

	return mux
}

// ---------- Middleware ----------

func (app *App) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("sfa_session")
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		session, err := app.Repo.GetSession(cookie.Value)
		if err != nil || session == nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		expires, err := time.Parse(time.RFC3339, session.ExpiresAt)
		if err != nil || time.Now().After(expires) {
			writeError(w, http.StatusUnauthorized, "session expired")
			return
		}
		user, err := app.Repo.GetUser(session.UserID)
		if err != nil || user == nil || !user.IsActive {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		ctx := context.WithValue(r.Context(), ctxUser, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func currentUser(r *http.Request) *repo.User {
	u, _ := r.Context().Value(ctxUser).(*repo.User)
	return u
}

// ---------- Auth ----------

func (app *App) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := app.Repo.GetUserByName(req.Name)
	if err != nil || user == nil || !user.IsActive {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	// TODO: bcrypt に移行する（現在は SHA-256 で互換性を保持）
	h := sha256.Sum256([]byte(req.Password))
	if hex.EncodeToString(h[:]) != user.Password {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	sessionID := newToken()
	now := time.Now().UTC()
	session := &repo.Session{
		ID:        sessionID,
		UserID:    user.ID,
		CreatedAt: now.Format(time.RFC3339),
		ExpiresAt: now.Add(30 * 24 * time.Hour).Format(time.RFC3339),
	}
	if err := app.Repo.CreateSession(session); err != nil {
		writeError(w, http.StatusInternalServerError, "session error")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "sfa_session",
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600,
	})

	user.Password = "" // パスワードハッシュはレスポンスに含めない
	writeJSON(w, http.StatusOK, user)
}

func (app *App) handleLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("sfa_session")
	if err == nil {
		app.Repo.DeleteSession(cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:   "sfa_session",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (app *App) handleMe(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	writeJSON(w, http.StatusOK, user)
}

// ---------- Deals ----------

func (app *App) handleListDeals(w http.ResponseWriter, r *http.Request) {
	deals, err := app.Repo.ListDeals()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if deals == nil {
		deals = []repo.Deal{}
	}
	writeJSON(w, http.StatusOK, deals)
}

func (app *App) handleCreateDeal(w http.ResponseWriter, r *http.Request) {
	var d repo.Deal
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := app.Repo.CreateDeal(&d); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

func (app *App) handleUpdateDeal(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var d repo.Deal
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	d.ID = id
	if err := app.Repo.UpdateDeal(&d); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, "deal not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// ---------- Users ----------

func (app *App) handleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := app.Repo.ListUsers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if users == nil {
		users = []repo.User{}
	}
	writeJSON(w, http.StatusOK, users)
}

func (app *App) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var u repo.User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	// パスワードはプレーンテキストで受け取り、サーバーでハッシュ化
	if u.Password != "" {
		h := sha256.Sum256([]byte(u.Password))
		u.Password = hex.EncodeToString(h[:])
	}
	if err := app.Repo.CreateUser(&u); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	u.Password = ""
	writeJSON(w, http.StatusCreated, u)
}

func (app *App) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var u repo.User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	u.ID = id
	if err := app.Repo.UpdateUser(&u); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// ---------- Depts ----------

func (app *App) handleListDepts(w http.ResponseWriter, r *http.Request) {
	depts, err := app.Repo.ListDepts()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if depts == nil {
		depts = []repo.Dept{}
	}
	writeJSON(w, http.StatusOK, depts)
}

func (app *App) handleCreateDept(w http.ResponseWriter, r *http.Request) {
	var d repo.Dept
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := app.Repo.CreateDept(&d); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

func (app *App) handleUpdateDept(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var d repo.Dept
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	d.ID = id
	if err := app.Repo.UpdateDept(&d); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, "dept not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// ---------- Activities ----------

func (app *App) handleListActivities(w http.ResponseWriter, r *http.Request) {
	var (
		acts []repo.Activity
		err  error
	)
	if dealID := r.URL.Query().Get("deal_id"); dealID != "" {
		acts, err = app.Repo.ListActivitiesByDeal(dealID)
	} else {
		acts, err = app.Repo.ListActivities()
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if acts == nil {
		acts = []repo.Activity{}
	}
	writeJSON(w, http.StatusOK, acts)
}

func (app *App) handleCreateActivity(w http.ResponseWriter, r *http.Request) {
	var a repo.Activity
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := app.Repo.CreateActivity(&a); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, a)
}

// ---------- Targets ----------

func (app *App) handleGetTargets(w http.ResponseWriter, r *http.Request) {
	targets, err := app.Repo.GetTargets()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, targets)
}

func (app *App) handleUpsertTarget(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TargetType string `json:"target_type"`
		EntityID   string `json:"entity_id"`
		QuarterKey string `json:"quarter_key"`
		Amount     int64  `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := app.Repo.UpsertTarget(req.TargetType, req.EntityID, req.QuarterKey, req.Amount); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---------- Settings ----------

func (app *App) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	s, err := app.Repo.GetSettings()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (app *App) handleSaveSettings(w http.ResponseWriter, r *http.Request) {
	var s repo.Settings
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := app.Repo.SaveSettings(s); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, s)
}

// ---------- ユーティリティ ----------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func newToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}
