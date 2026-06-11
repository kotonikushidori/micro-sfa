// main.go: HTTP サーバー起動・ルーティング。
// ビジネスロジックは handler/ と repo/ に分離。
package main

import (
	"log"
	"net/http"
	"os"

	"micro-sfa/db"
	"micro-sfa/handler"
	"micro-sfa/repo"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "./sfa.db"
	}

	// DB 接続・マイグレーション・シード
	rawDB, err := db.Open(dsn)
	if err != nil {
		log.Fatalf("db.Open: %v", err)
	}
	defer rawDB.Close()

	if err := db.Migrate(rawDB); err != nil {
		log.Fatalf("db.Migrate: %v", err)
	}
	if err := db.Seed(rawDB); err != nil {
		log.Fatalf("db.Seed: %v", err)
	}

	app := &handler.App{Repo: repo.New(rawDB)}

	mux := http.NewServeMux()

	// /api/* → API ハンドラ（静的ファイルより先に登録）
	mux.Handle("/api/", http.StripPrefix("/api", app.Routes()))

	// それ以外 → static/ 配下の静的ファイル
	mux.Handle("/", http.FileServer(http.Dir("./static")))

	log.Printf("Server starting on :%s  (DB: %s)", port, dsn)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
