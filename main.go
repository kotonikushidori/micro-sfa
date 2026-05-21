// main.go: 静的ファイルサーブのみ。ビジネスロジックは一切持たない。
// PORT環境変数はRenderのデプロイ要件に対応するために必須。
package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	log.Printf("Server starting on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
