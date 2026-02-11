package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// ============================================================
// DTO structs
// ============================================================

type DashboardOverview struct {
	// Row 1: Mini stat cards
	TotalUsers        int64   `json:"total_users"`
	ActiveUsers       int64   `json:"active_users"`
	TodayNewUsers     int64   `json:"today_new_users"`
	MonthNewUsers     int64   `json:"month_new_users"`
	SubscriptionUsers int64   `json:"subscription_users"`
	ActiveChannels    int64   `json:"active_channels"`
	TotalChannels     int64   `json:"total_channels"`
	TotalBalance      int     `json:"total_balance"`
	TotalTopUp        float64 `json:"total_topup"`
	TotalConsumed     int     `json:"total_consumed"`
	EstimatedProfit   float64 `json:"estimated_profit"`

	// Subscription info (user dashboard)
	HasSubscription        bool   `json:"has_subscription"`
	SubscriptionQuotaTotal int64  `json:"subscription_quota_total"`
	SubscriptionQuotaUsed  int64  `json:"subscription_quota_used"`
	SubscriptionPlanTitle  string `json:"subscription_plan_title"`
	SubscriptionEndTime    int64  `json:"subscription_end_time"`

	// Row 2: Performance
	TotalTokens   int64   `json:"total_tokens"`
	TotalRequests int64   `json:"total_requests"`
	AvgLatency    int     `json:"avg_latency"`
	SuccessRate   float64 `json:"success_rate"`
	TodayErrors   int64   `json:"today_errors"`
	AvgTTFT       int     `json:"avg_ttft"`

	// Row 3: Period summaries
	PeriodToday PeriodSummary `json:"period_today"`
	PeriodWeek  PeriodSummary `json:"period_week"`
	PeriodMonth PeriodSummary `json:"period_month"`

	// Row 4: 14-day trends
	ConsumeTrend []DayPoint `json:"consume_trend"`
	RequestTrend []DayPoint `json:"request_trend"`
	TokenTrend   []DayPoint `json:"token_trend"`
	TopUpTrend   []DayPoint `json:"topup_trend"`

	// Row 5: Distribution
	ModelRequestDist []DistItem `json:"model_request_dist"`
	UserRequestDist  []DistItem `json:"user_request_dist"`
	TopModels        []DistItem `json:"top_models"`
	TopUsers         []DistItem `json:"top_users"`
}

type PeriodSummary struct {
	TopUp    float64 `json:"topup"`
	Consumed int     `json:"consumed"`
	Requests int64   `json:"requests"`
	Tokens   int64   `json:"tokens"`
}

type DayPoint struct {
	Date  string `json:"date"`
	Value int64  `json:"value"`
}

type DistItem struct {
	Name  string `json:"name"`
	Value int64  `json:"value"`
}

// ============================================================
// Cross-DB helpers
// ============================================================

func dateFromUnixExpr(field string) string {
	if common.UsingPostgreSQL {
		return fmt.Sprintf("TO_CHAR(TO_TIMESTAMP(%s), 'YYYY-MM-DD')", field)
	}
	if common.UsingMySQL {
		return fmt.Sprintf("DATE_FORMAT(FROM_UNIXTIME(%s), '%%Y-%%m-%%d')", field)
	}
	// SQLite
	return fmt.Sprintf("DATE(%s, 'unixepoch')", field)
}

func beginOfDay(t time.Time) int64 {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location()).Unix()
}

// ============================================================
// Query functions — DB (users, channels, top_ups)
// ============================================================

func DashboardCountTotalUsers() (int64, error) {
	var total int64
	err := DB.Model(&User{}).Count(&total).Error
	return total, err
}

func DashboardCountNewUsers(since int64) (int64, error) {
	var total int64
	err := DB.Model(&User{}).Where("created_time >= ?", since).Count(&total).Error
	return total, err
}

func DashboardCountActiveUsers(sinceDays int) (int64, error) {
	var total int64
	since := time.Now().AddDate(0, 0, -sinceDays).Unix()
	err := DB.Model(&User{}).Where("last_active_time >= ?", since).Count(&total).Error
	return total, err
}

func DashboardCountActiveSubscriptionUsers() (int64, error) {
	var total int64
	now := time.Now().Unix()
	err := DB.Model(&UserSubscription{}).
		Where("status = ? AND end_time > ?", "active", now).
		Distinct("user_id").
		Count(&total).Error
	return total, err
}

func DashboardCountActiveChannels() (int64, error) {
	var total int64
	err := DB.Model(&Channel{}).Where("status = ?", common.ChannelStatusEnabled).Count(&total).Error
	return total, err
}

func DashboardSumAllUserBalance() (int, error) {
	var result struct{ Total *int }
	err := DB.Model(&User{}).Select("COALESCE(SUM(quota), 0) as total").Scan(&result).Error
	if result.Total == nil {
		return 0, err
	}
	return *result.Total, err
}

func DashboardSumAllUserUsedQuota() (int, error) {
	var result struct{ Total *int }
	err := DB.Model(&User{}).Select("COALESCE(SUM(used_quota), 0) as total").Scan(&result).Error
	if result.Total == nil {
		return 0, err
	}
	return *result.Total, err
}

func DashboardSumTopUpMoney(startTs, endTs int64) (float64, error) {
	var result struct{ Total *float64 }
	tx := DB.Model(&TopUp{}).Where("status = ?", common.TopUpStatusSuccess)
	if startTs > 0 {
		tx = tx.Where("complete_time >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("complete_time <= ?", endTs)
	}
	err := tx.Select("COALESCE(SUM(money), 0) as total").Scan(&result).Error
	if result.Total == nil {
		return 0, err
	}
	return *result.Total, err
}

func DashboardGetUserBalance(userId int) (int, error) {
	var user User
	err := DB.Select("quota").Where("id = ?", userId).First(&user).Error
	return user.Quota, err
}

func DashboardGetUserUsedQuota(userId int) (int, error) {
	var user User
	err := DB.Select("used_quota").Where("id = ?", userId).First(&user).Error
	return user.UsedQuota, err
}

// ============================================================
// Query functions — LOG_DB (logs)
// ============================================================

func DashboardCountRequests(startTs, endTs int64, userId int) (int64, error) {
	var total int64
	tx := LOG_DB.Model(&Log{}).Where("type = ?", LogTypeConsume)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	err := tx.Count(&total).Error
	return total, err
}

func DashboardCountErrors(startTs, endTs int64, userId int) (int64, error) {
	var total int64
	tx := LOG_DB.Model(&Log{}).Where("type = ?", LogTypeError)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	err := tx.Count(&total).Error
	return total, err
}

func DashboardSumTokens(startTs, endTs int64, userId int) (int64, error) {
	var result struct{ Total *int64 }
	tx := LOG_DB.Model(&Log{}).Where("type = ?", LogTypeConsume)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	err := tx.Select("COALESCE(SUM(prompt_tokens) + SUM(completion_tokens), 0) as total").Scan(&result).Error
	if result.Total == nil {
		return 0, err
	}
	return *result.Total, err
}

func DashboardSumQuota(startTs, endTs int64, userId int) (int, error) {
	var result struct{ Total *int }
	tx := LOG_DB.Model(&Log{}).Where("type = ?", LogTypeConsume)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	err := tx.Select("COALESCE(SUM(quota), 0) as total").Scan(&result).Error
	if result.Total == nil {
		return 0, err
	}
	return *result.Total, err
}

func DashboardAvgLatency(startTs, endTs int64, userId int) (int, error) {
	var result struct{ Total *float64 }
	tx := LOG_DB.Model(&Log{}).Where("type = ? AND use_time > 0", LogTypeConsume)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	err := tx.Select("COALESCE(AVG(use_time), 0) as total").Scan(&result).Error
	if result.Total == nil {
		return 0, err
	}
	return int(*result.Total), err
}

func DashboardAvgTTFT(startTs, endTs int64, userId int) (int, error) {
	var result struct{ Total *float64 }
	tx := LOG_DB.Model(&Log{}).Where("type = ? AND is_stream = ? AND use_time > 0", LogTypeConsume, true)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	err := tx.Select("COALESCE(AVG(use_time), 0) as total").Scan(&result).Error
	if result.Total == nil {
		return 0, err
	}
	return int(*result.Total), err
}

func DashboardSuccessRate(startTs, endTs int64, userId int) (float64, error) {
	consumeCount, err := DashboardCountRequests(startTs, endTs, userId)
	if err != nil {
		return 0, err
	}
	errorCount, err := DashboardCountErrors(startTs, endTs, userId)
	if err != nil {
		return 0, err
	}
	total := consumeCount + errorCount
	if total == 0 {
		return 100, nil
	}
	return float64(consumeCount) / float64(total) * 100, nil
}

// ============================================================
// Trend queries
// ============================================================

func DashboardGetConsumeTrend(startTs, endTs int64, userId int) ([]DayPoint, error) {
	dateExpr := dateFromUnixExpr("created_at")
	var results []DayPoint
	tx := LOG_DB.Table("logs").
		Select(dateExpr + " as date, COALESCE(SUM(quota), 0) as value").
		Where("type = ?", LogTypeConsume)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	err := tx.Group(dateExpr).Order("date ASC").Scan(&results).Error
	return results, err
}

func DashboardGetRequestTrend(startTs, endTs int64, userId int) ([]DayPoint, error) {
	dateExpr := dateFromUnixExpr("created_at")
	var results []DayPoint
	tx := LOG_DB.Table("logs").
		Select(dateExpr + " as date, COUNT(*) as value").
		Where("type = ?", LogTypeConsume)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	err := tx.Group(dateExpr).Order("date ASC").Scan(&results).Error
	return results, err
}

func DashboardGetTokenTrend(startTs, endTs int64, userId int) ([]DayPoint, error) {
	dateExpr := dateFromUnixExpr("created_at")
	var results []DayPoint
	tx := LOG_DB.Table("logs").
		Select(dateExpr+" as date, COALESCE(SUM(prompt_tokens) + SUM(completion_tokens), 0) as value").
		Where("type = ?", LogTypeConsume)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	err := tx.Group(dateExpr).Order("date ASC").Scan(&results).Error
	return results, err
}

func DashboardGetTopUpTrend(startTs, endTs int64) ([]DayPoint, error) {
	dateExpr := dateFromUnixExpr("complete_time")
	var results []DayPoint
	tx := DB.Table("top_ups").
		Select(dateExpr+" as date, COALESCE(SUM(money), 0) as value").
		Where("status = ?", common.TopUpStatusSuccess)
	if startTs > 0 {
		tx = tx.Where("complete_time >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("complete_time <= ?", endTs)
	}
	err := tx.Group(dateExpr).Order("date ASC").Scan(&results).Error
	return results, err
}

// ============================================================
// Distribution queries
// ============================================================

func DashboardGetModelDistribution(limit int, startTs, endTs int64, userId int) ([]DistItem, error) {
	var results []DistItem
	tx := LOG_DB.Table("logs").
		Select("model_name as name, COUNT(*) as value").
		Where("type = ?", LogTypeConsume)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	err := tx.Group("model_name").Order("value DESC").Limit(limit).Scan(&results).Error
	return results, err
}

func DashboardGetUserDistribution(limit int, startTs, endTs int64) ([]DistItem, error) {
	var results []DistItem
	tx := LOG_DB.Table("logs").
		Select("username as name, COUNT(*) as value").
		Where("type = ?", LogTypeConsume)
	if startTs > 0 {
		tx = tx.Where("created_at >= ?", startTs)
	}
	if endTs > 0 {
		tx = tx.Where("created_at <= ?", endTs)
	}
	err := tx.Group("username").Order("value DESC").Limit(limit).Scan(&results).Error
	return results, err
}

// ============================================================
// Period summary helper
// ============================================================

func dashboardGetPeriodSummary(startTs, endTs int64, userId int, includeTopUp bool) PeriodSummary {
	var ps PeriodSummary
	ps.Consumed, _ = DashboardSumQuota(startTs, endTs, userId)
	ps.Requests, _ = DashboardCountRequests(startTs, endTs, userId)
	ps.Tokens, _ = DashboardSumTokens(startTs, endTs, userId)
	if includeTopUp && userId == 0 {
		ps.TopUp, _ = DashboardSumTopUpMoney(startTs, endTs)
	}
	return ps
}

// ============================================================
// Orchestrators
// ============================================================

func GetDashboardOverviewAdmin(startTs, endTs int64) (*DashboardOverview, error) {
	o := &DashboardOverview{}
	now := time.Now()
	todayStart := beginOfDay(now)
	weekStart := beginOfDay(now.AddDate(0, 0, -7))
	monthStart := beginOfDay(now.AddDate(0, -1, 0))
	nowTs := now.Unix()

	// Determine effective time ranges
	fourteenDaysAgo := beginOfDay(now.AddDate(0, 0, -14))
	hasCustomRange := startTs > 0 && endTs > 0

	trendStart := fourteenDaysAgo
	trendEnd := nowTs
	perfStart := todayStart // performance metrics default to today
	perfEnd := nowTs
	distStart := fourteenDaysAgo // distributions default to 14 days
	distEnd := nowTs
	if hasCustomRange {
		trendStart = startTs
		trendEnd = endTs
		perfStart = startTs
		perfEnd = endTs
		distStart = startTs
		distEnd = endTs
	}

	// Row 1 (snapshot data, not affected by time range)
	o.TotalUsers, _ = DashboardCountTotalUsers()
	o.ActiveUsers, _ = DashboardCountActiveUsers(3)
	o.TodayNewUsers, _ = DashboardCountNewUsers(todayStart)
	o.MonthNewUsers, _ = DashboardCountNewUsers(monthStart)
	o.SubscriptionUsers, _ = DashboardCountActiveSubscriptionUsers()
	o.TotalChannels, _ = CountAllChannels()
	o.ActiveChannels, _ = DashboardCountActiveChannels()
	o.TotalBalance, _ = DashboardSumAllUserBalance()
	o.TotalTopUp, _ = DashboardSumTopUpMoney(0, 0)
	o.TotalConsumed, _ = DashboardSumAllUserUsedQuota()
	o.EstimatedProfit = o.TotalTopUp - float64(o.TotalConsumed)/common.QuotaPerUnit

	// Row 2 (filtered by time range)
	o.TotalTokens, _ = DashboardSumTokens(perfStart, perfEnd, 0)
	o.TotalRequests, _ = DashboardCountRequests(perfStart, perfEnd, 0)
	o.AvgLatency, _ = DashboardAvgLatency(perfStart, perfEnd, 0)
	o.SuccessRate, _ = DashboardSuccessRate(perfStart, perfEnd, 0)
	o.TodayErrors, _ = DashboardCountErrors(perfStart, perfEnd, 0)
	o.AvgTTFT, _ = DashboardAvgTTFT(perfStart, perfEnd, 0)

	// Row 3 (always fixed periods)
	o.PeriodToday = dashboardGetPeriodSummary(todayStart, nowTs, 0, true)
	o.PeriodWeek = dashboardGetPeriodSummary(weekStart, nowTs, 0, true)
	o.PeriodMonth = dashboardGetPeriodSummary(monthStart, nowTs, 0, true)

	// Row 4 (filtered by time range)
	o.ConsumeTrend, _ = DashboardGetConsumeTrend(trendStart, trendEnd, 0)
	o.RequestTrend, _ = DashboardGetRequestTrend(trendStart, trendEnd, 0)
	o.TokenTrend, _ = DashboardGetTokenTrend(trendStart, trendEnd, 0)
	o.TopUpTrend, _ = DashboardGetTopUpTrend(trendStart, trendEnd)

	// Row 5 (distributions, default to 14 days)
	o.ModelRequestDist, _ = DashboardGetModelDistribution(10, distStart, distEnd, 0)
	o.UserRequestDist, _ = DashboardGetUserDistribution(10, distStart, distEnd)
	o.TopModels, _ = DashboardGetModelDistribution(6, distStart, distEnd, 0)
	o.TopUsers, _ = DashboardGetUserDistribution(6, distStart, distEnd)

	return o, nil
}

func GetDashboardOverviewUser(userId int, startTs, endTs int64) (*DashboardOverview, error) {
	o := &DashboardOverview{}
	now := time.Now()
	todayStart := beginOfDay(now)
	weekStart := beginOfDay(now.AddDate(0, 0, -7))
	monthStart := beginOfDay(now.AddDate(0, -1, 0))
	nowTs := now.Unix()

	fourteenDaysAgo := beginOfDay(now.AddDate(0, 0, -14))
	hasCustomRange := startTs > 0 && endTs > 0

	trendStart := fourteenDaysAgo
	trendEnd := nowTs
	perfStart := todayStart
	perfEnd := nowTs
	distStart := fourteenDaysAgo
	distEnd := nowTs
	if hasCustomRange {
		trendStart = startTs
		trendEnd = endTs
		perfStart = startTs
		perfEnd = endTs
		distStart = startTs
		distEnd = endTs
	}

	// Row 1 (user-specific, snapshot)
	o.TotalBalance, _ = DashboardGetUserBalance(userId)
	o.TotalConsumed, _ = DashboardGetUserUsedQuota(userId)

	// Subscription info
	subMap, err := GetActiveSubscriptionsByUserIds([]int{userId})
	if err == nil {
		if sub, ok := subMap[userId]; ok {
			o.HasSubscription = true
			o.SubscriptionQuotaTotal = sub.AmountTotal
			o.SubscriptionQuotaUsed = sub.AmountUsed
			o.SubscriptionEndTime = sub.EndTime
			titles, _ := GetSubscriptionPlanTitlesByIds([]int{sub.PlanId})
			o.SubscriptionPlanTitle = titles[sub.PlanId]
		}
	}

	// Row 2 (filtered)
	o.TotalTokens, _ = DashboardSumTokens(perfStart, perfEnd, userId)
	o.TotalRequests, _ = DashboardCountRequests(perfStart, perfEnd, userId)
	o.AvgLatency, _ = DashboardAvgLatency(perfStart, perfEnd, userId)
	o.SuccessRate, _ = DashboardSuccessRate(perfStart, perfEnd, userId)
	o.TodayErrors, _ = DashboardCountErrors(perfStart, perfEnd, userId)
	o.AvgTTFT, _ = DashboardAvgTTFT(perfStart, perfEnd, userId)

	// Row 3 (always fixed periods)
	o.PeriodToday = dashboardGetPeriodSummary(todayStart, nowTs, userId, false)
	o.PeriodWeek = dashboardGetPeriodSummary(weekStart, nowTs, userId, false)
	o.PeriodMonth = dashboardGetPeriodSummary(monthStart, nowTs, userId, false)

	// Row 4 (filtered)
	o.ConsumeTrend, _ = DashboardGetConsumeTrend(trendStart, trendEnd, userId)
	o.RequestTrend, _ = DashboardGetRequestTrend(trendStart, trendEnd, userId)
	o.TokenTrend, _ = DashboardGetTokenTrend(trendStart, trendEnd, userId)

	// Row 5 (distributions, default to 14 days)
	o.ModelRequestDist, _ = DashboardGetModelDistribution(10, distStart, distEnd, userId)
	o.TopModels, _ = DashboardGetModelDistribution(6, distStart, distEnd, userId)

	return o, nil
}
