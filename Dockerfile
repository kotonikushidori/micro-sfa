# ── development stage ──────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS development
WORKDIR /app
RUN go install github.com/air-verse/air@v1.61.5
COPY go.mod ./
RUN go mod download
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]

# ── builder stage ───────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o server .

# ── production stage ────────────────────────────────────────────────────────────
FROM alpine:3.19 AS production
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/static ./static
EXPOSE 8080
CMD ["./server"]
