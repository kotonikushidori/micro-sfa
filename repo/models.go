// models.go: ドメインモデル定義。JSON タグはフロントエンドの既存フィールド名に合わせる。
package repo

// User はシステムユーザー。password はレスポンスには含めない（omitempty でなく明示的に除外）。
type User struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	DeptID    string `json:"dept_id"`
	Role      string `json:"role"`
	Password  string `json:"password,omitempty"`
	IsActive  bool   `json:"isActive"`
	CreatedAt string `json:"createdAt"`
}

type Dept struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsActive  bool   `json:"isActive"`
	CreatedAt string `json:"createdAt"`
}

// Deal の phases/bant/amountHistory は SQLite に TEXT(JSON) で保存する。
// Go 側では []bool / map[string]int / []AmountHistory として扱う。
type Deal struct {
	ID            string          `json:"id"`
	Name          string          `json:"name"`
	Amount        int64           `json:"amount"`
	CostAmount    *int64          `json:"costAmount,omitempty"`
	CloseDate     string          `json:"closeDate"`
	AssigneeID    string          `json:"assignee_id"`
	DeptID        string          `json:"dept_id"`
	AssigneeName  string          `json:"assignee_name"`
	DeptName      string          `json:"dept_name"`
	Phases        []bool          `json:"phases"`
	BANT          map[string]int  `json:"bant"`
	AmountHistory []AmountHistory `json:"amountHistory"`
	BallOwner     string          `json:"ballOwner"`
	BallDetail    string          `json:"ballDetail"`
	IsWon         bool            `json:"isWon"`
	IsLost        bool            `json:"isLost"`
	CreatedAt     string          `json:"createdAt"`
	UpdatedAt     string          `json:"updatedAt"`
}

type AmountHistory struct {
	Amount    int64  `json:"amount"`
	ChangedAt string `json:"changedAt"`
}

type Activity struct {
	ID         string  `json:"id"`
	DealID     string  `json:"deal_id"`
	Type       string  `json:"type"`
	Date       string  `json:"date"`
	Content    string  `json:"content"`
	AuthorID   string  `json:"author_id"`
	AuthorName string  `json:"author_name"`
	Cost       *int64  `json:"cost,omitempty"`
	Duration   *int64  `json:"duration,omitempty"`
	CreatedAt  string  `json:"createdAt"`
}

// Targets はフロントエンドと同じ { dept: { id: { qk: amount } }, rep: { ... } } 形式で返す。
type Targets struct {
	Dept map[string]map[string]int64 `json:"dept"`
	Rep  map[string]map[string]int64 `json:"rep"`
}

type Settings struct {
	FiscalStartMonth int    `json:"fiscalStartMonth"`
	BANTPreset       string `json:"bantPreset"`
	PhasePreset      string `json:"phasePreset"`
	LockConfig       any    `json:"lockConfig"`
}

type Session struct {
	ID        string
	UserID    string
	CreatedAt string
	ExpiresAt string
}
