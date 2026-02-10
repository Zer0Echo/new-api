package dto

// UserSubscriptionInfo is a summary of a user's active subscription for the admin user list.
type UserSubscriptionInfo struct {
	PlanTitle   string `json:"plan_title"`
	PlanId      int    `json:"plan_id"`
	AmountTotal int64  `json:"amount_total"`
	AmountUsed  int64  `json:"amount_used"`
	EndTime     int64  `json:"end_time"`
	Status      string `json:"status"`
}
