package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetSelfQuotaRecords returns the current user's quota records (paginated).
func GetSelfQuotaRecords(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	records, total, err := model.GetQuotaRecordsByUser(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

// GetSelfQuotaSummary returns a balance breakdown for the current user.
func GetSelfQuotaSummary(c *gin.Context) {
	userId := c.GetInt("id")
	userQuota, err := model.GetUserQuota(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	expiringBalance, err := model.GetUserExpiringBalance(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	permanentBalance := userQuota - expiringBalance
	if permanentBalance < 0 {
		permanentBalance = 0
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total_balance":     userQuota,
			"expiring_balance":  expiringBalance,
			"permanent_balance": permanentBalance,
		},
	})
}

// GetUserQuotaRecords returns quota records for a specific user (admin).
func GetUserQuotaRecords(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo := common.GetPageQuery(c)
	records, total, err := model.GetQuotaRecordsByUser(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

// GetUserQuotaSummary returns a balance breakdown for a specific user (admin).
func GetUserQuotaSummary(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userQuota, err := model.GetUserQuota(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	expiringBalance, err := model.GetUserExpiringBalance(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	permanentBalance := userQuota - expiringBalance
	if permanentBalance < 0 {
		permanentBalance = 0
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total_balance":     userQuota,
			"expiring_balance":  expiringBalance,
			"permanent_balance": permanentBalance,
		},
	})
}

type UpdateQuotaRecordRequest struct {
	Remaining   *int   `json:"remaining"`
	ExpiredTime *int64 `json:"expired_time"`
}

// UpdateQuotaRecord allows admin to modify a quota record's remaining and/or expired_time.
func UpdateQuotaRecord(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req UpdateQuotaRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	record, err := model.GetQuotaRecordById(id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgQuotaRecordNotFound)
		return
	}

	newRemaining := record.Remaining
	if req.Remaining != nil {
		if *req.Remaining < 0 {
			common.ApiErrorI18n(c, i18n.MsgQuotaNegative)
			return
		}
		newRemaining = *req.Remaining
	}

	newExpiredTime := int64(0)
	if req.ExpiredTime != nil {
		newExpiredTime = *req.ExpiredTime
	}

	err = model.UpdateQuotaRecordAdmin(id, newRemaining, newExpiredTime)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgQuotaRecordUpdateFailed)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
