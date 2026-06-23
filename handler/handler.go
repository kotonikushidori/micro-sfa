// handler.go: HTTP ハンドラ全定義。
// 認証は HTTP-only Cookie のセッション方式。
// すべてのルートは app.Routes() で登録し、main.go からマウントする。
package handler

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
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
	mux.HandleFunc("GET /auth/google", app.handleGoogleLogin)
	mux.HandleFunc("GET /auth/google/callback", app.handleGoogleCallback)

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

	mux.Handle("POST /ai/structure-activity", auth(http.HandlerFunc(app.handleStructureActivity)))

	mux.Handle("GET /contacts",           auth(http.HandlerFunc(app.handleListContacts)))
	mux.Handle("POST /contacts",          auth(http.HandlerFunc(app.handleCreateContact)))
	mux.Handle("GET /contacts/{id}",      auth(http.HandlerFunc(app.handleGetContact)))
	mux.Handle("PUT /contacts/{id}",      auth(http.HandlerFunc(app.handleUpdateContact)))
	mux.Handle("POST /contacts/{id}/ocr", auth(http.HandlerFunc(app.handleContactOCR)))

	return requestLogger(mux)
}

// ---------- Middleware ----------

func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return strings.SplitN(ip, ",", 2)[0]
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}

func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("ACCESS ip=%s %s %s", clientIP(r), r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

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

// ---------- Google OAuth ----------

type googleUserInfo struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func googleConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  os.Getenv("GOOGLE_REDIRECT_URI"),
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
}

func (app *App) handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("GOOGLE_CLIENT_ID") == "" {
		http.Redirect(w, r, "/?auth_error=google_not_configured", http.StatusFound)
		return
	}
	state := newToken()
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})
	http.Redirect(w, r, googleConfig().AuthCodeURL(state, oauth2.AccessTypeOnline), http.StatusFound)
}

func (app *App) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value == "" || stateCookie.Value != r.URL.Query().Get("state") {
		http.Redirect(w, r, "/?auth_error=invalid_state", http.StatusFound)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "oauth_state", Value: "", Path: "/", MaxAge: -1})

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, "/?auth_error=no_code", http.StatusFound)
		return
	}

	token, err := googleConfig().Exchange(r.Context(), code)
	if err != nil {
		log.Printf("google oauth exchange error: %v", err)
		http.Redirect(w, r, "/?auth_error=token_exchange_failed", http.StatusFound)
		return
	}

	resp, err := googleConfig().Client(r.Context(), token).Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		http.Redirect(w, r, "/?auth_error=userinfo_failed", http.StatusFound)
		return
	}
	defer resp.Body.Close()

	var info googleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		http.Redirect(w, r, "/?auth_error=userinfo_parse_failed", http.StatusFound)
		return
	}

	user, err := app.Repo.GetUserByGoogleID(info.Sub)
	if err != nil {
		http.Redirect(w, r, "/?auth_error=db_error", http.StatusFound)
		return
	}
	if user == nil {
		// 初回ログイン: メールで照合してgoogle_idをリンク
		user, err = app.Repo.GetUserByEmail(info.Email)
		if err != nil {
			http.Redirect(w, r, "/?auth_error=db_error", http.StatusFound)
			return
		}
		if user == nil {
			log.Printf("LOGIN_REJECT ip=%s email=%s reason=not_registered", clientIP(r), info.Email)
			http.Redirect(w, r, "/?auth_error=not_registered", http.StatusFound)
			return
		}
		_ = app.Repo.LinkGoogleID(user.ID, info.Sub)
	}

	if !user.IsActive {
		log.Printf("LOGIN_REJECT ip=%s email=%s reason=inactive", clientIP(r), info.Email)
		http.Redirect(w, r, "/?auth_error=inactive", http.StatusFound)
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
		http.Redirect(w, r, "/?auth_error=session_error", http.StatusFound)
		return
	}

	log.Printf("LOGIN_SUCCESS ip=%s email=%s user=%s role=%s", clientIP(r), info.Email, user.Name, user.Role)
	http.SetCookie(w, &http.Cookie{
		Name:     "sfa_session",
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600,
	})
	http.Redirect(w, r, "/", http.StatusFound)
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

// ---------- Contacts ----------

func (app *App) handleListContacts(w http.ResponseWriter, r *http.Request) {
	contacts, err := app.Repo.ListContacts()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if contacts == nil {
		contacts = []repo.Contact{}
	}
	writeJSON(w, http.StatusOK, contacts)
}

func (app *App) handleGetContact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	c, err := app.Repo.GetContact(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if c == nil {
		writeError(w, http.StatusNotFound, "contact not found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (app *App) handleCreateContact(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID            string `json:"id"`
		CardImageData string `json:"cardImageData"`
		QuickLabel    string `json:"quickLabel"`
		QuickMemo     string `json:"quickMemo"`
		EventName     string `json:"eventName"`
		CapturedAt    string `json:"capturedAt"`
		AssigneeID    string `json:"assignee_id"`
		AssigneeName  string `json:"assignee_name"`
		CreatedAt     string `json:"createdAt"`
		UpdatedAt     string `json:"updatedAt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	c := repo.Contact{
		ID:           req.ID,
		QuickLabel:   req.QuickLabel,
		QuickMemo:    req.QuickMemo,
		EventName:    req.EventName,
		CapturedAt:   req.CapturedAt,
		OcrStatus:    "raw",
		AssigneeID:   req.AssigneeID,
		AssigneeName: req.AssigneeName,
		CreatedAt:    req.CreatedAt,
		UpdatedAt:    req.UpdatedAt,
	}

	if req.CardImageData != "" {
		imgData, err := base64.StdEncoding.DecodeString(req.CardImageData)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid image data")
			return
		}
		imgPath := fmt.Sprintf("./uploads/cards/%s.jpg", c.ID)
		if err := os.WriteFile(imgPath, imgData, 0644); err != nil {
			log.Printf("image save error: %v", err)
		} else {
			c.CardImageURL = fmt.Sprintf("/uploads/cards/%s.jpg", c.ID)
		}
	}

	if err := app.Repo.CreateContact(&c); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (app *App) handleUpdateContact(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var c repo.Contact
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	c.ID = id
	if err := app.Repo.UpdateContact(&c); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, "contact not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (app *App) handleContactOCR(w http.ResponseWriter, r *http.Request) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		writeError(w, http.StatusServiceUnavailable, "AI機能は設定されていません（ANTHROPIC_API_KEY 未設定）")
		return
	}

	id := r.PathValue("id")
	c, err := app.Repo.GetContact(id)
	if err != nil || c == nil {
		writeError(w, http.StatusNotFound, "contact not found")
		return
	}
	if c.CardImageURL == "" {
		writeError(w, http.StatusBadRequest, "名刺画像がありません")
		return
	}

	imgPath := "." + c.CardImageURL
	imgData, err := os.ReadFile(imgPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "画像の読み込みに失敗しました")
		return
	}

	rawText, err := callClaudeOCR(base64.StdEncoding.EncodeToString(imgData), apiKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	c.OcrRawText = rawText
	c.OcrStatus = "ocr_done"
	c.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := app.Repo.UpdateContact(c); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func callClaudeOCR(imgBase64, apiKey string) (string, error) {
	reqBody, _ := json.Marshal(map[string]any{
		"model":      "claude-haiku-4-5-20251001",
		"max_tokens": 1024,
		"messages": []map[string]any{
			{
				"role": "user",
				"content": []any{
					map[string]any{
						"type": "image",
						"source": map[string]any{
							"type":       "base64",
							"media_type": "image/jpeg",
							"data":       imgBase64,
						},
					},
					map[string]any{
						"type": "text",
						"text": "この名刺の文字をすべてそのまま読み取ってください。1行1要素で出力してください。テキストのみを返してください。",
					},
				},
			},
		},
	})

	httpReq, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("リクエスト生成に失敗しました: %v", err)
	}
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	httpReq.Header.Set("content-type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("Claude API呼び出しに失敗しました: %v", err)
	}
	defer resp.Body.Close()

	var apiResp struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return "", fmt.Errorf("APIレスポンスの解析に失敗しました")
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Claude APIエラー: %s", apiResp.Error.Message)
	}
	if len(apiResp.Content) == 0 {
		return "", fmt.Errorf("AIからの応答が空でした")
	}
	return apiResp.Content[0].Text, nil
}

// ---------- AI 活動ログ構造化 ----------

func (app *App) handleStructureActivity(w http.ResponseWriter, r *http.Request) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		writeError(w, http.StatusServiceUnavailable, "AI機能は設定されていません（ANTHROPIC_API_KEY 未設定）")
		return
	}

	var req struct {
		Text     string `json:"text"`
		DealName string `json:"deal_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		writeError(w, http.StatusBadRequest, "text is required")
		return
	}

	result, err := callClaudeStructure(req.Text, req.DealName, apiKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

type structuredActivity struct {
	Summary       string   `json:"summary"`
	NextActions   []string `json:"nextActions"`
	MyTasks       []string `json:"myTasks"`
	CustomerTasks []string `json:"customerTasks"`
	Cost          *int     `json:"cost"`     // 交通費（円）、言及なければ null
	Duration      *int     `json:"duration"` // 所要時間（分）、言及なければ null
}

func callClaudeStructure(text, dealName, apiKey string) (*structuredActivity, error) {
	prompt := fmt.Sprintf(`あなたは営業支援AIです。以下は営業担当者が商談後に音声入力した内容です。

案件名: %s

音声テキスト:
%s

以下のJSON形式で整理してください。

{
  "summary": "商談内容の要約（2〜4文で簡潔に）",
  "nextActions": ["営業担当者が次に取るべき具体的なアクション"],
  "myTasks": ["営業担当者自身の持ち帰りタスク・宿題"],
  "customerTasks": ["顧客側に依頼したこと・顧客の宿題"],
  "cost": 交通費が言及されていれば円単位の整数、なければ null,
  "duration": 所要時間・滞在時間が言及されていれば分単位の整数、なければ null
}

該当する内容がない配列項目は [] を、数値項目は null を返してください。JSONのみを返してください。`, dealName, text)

	reqBody, _ := json.Marshal(map[string]any{
		"model":      "claude-haiku-4-5-20251001",
		"max_tokens": 1024,
		"messages": []map[string]any{
			{"role": "user", "content": prompt},
		},
	})

	httpReq, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("リクエスト生成に失敗しました: %v", err)
	}
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	httpReq.Header.Set("content-type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("Claude API呼び出しに失敗しました: %v", err)
	}
	defer resp.Body.Close()

	var apiResp struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("APIレスポンスの解析に失敗しました")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Claude APIエラー: %s", apiResp.Error.Message)
	}
	if len(apiResp.Content) == 0 {
		return nil, fmt.Errorf("AIからの応答が空でした")
	}

	var result structuredActivity
	if err := json.Unmarshal([]byte(apiResp.Content[0].Text), &result); err != nil {
		result.Summary = apiResp.Content[0].Text
	}
	return &result, nil
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
