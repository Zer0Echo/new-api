package model

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ErrRedeemFailed is returned when redemption fails due to database error
var ErrRedeemFailed = errors.New("redeem.failed")

type Redemption struct {
	Id           int            `json:"id"`
	UserId       int            `json:"user_id"`
	Key          string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status       int            `json:"status" gorm:"default:1"`
	Name         string         `json:"name" gorm:"index"`
	Quota        int            `json:"quota" gorm:"default:100"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime int64          `json:"redeemed_time" gorm:"bigint"`
	Count        int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId   int            `json:"used_user_id"`
	DeletedAt       gorm.DeletedAt `gorm:"index"`
	ExpiredTime     int64          `json:"expired_time" gorm:"bigint"`     // 过期时间，0 表示不过期
	ValidityPeriod  int64          `json:"validity_period" gorm:"bigint;default:0"` // Balance validity in seconds after redemption. 0 = balance never expires
	PlanId          int            `json:"plan_id" gorm:"default:0;index"` // 0=余额兑换码, >0=订阅套餐ID
}

// RedeemResult holds the result of a redemption operation
type RedeemResult struct {
	Type     string `json:"type"`      // "balance" or "subscription"
	Quota    int    `json:"quota"`     // populated for balance codes
	PlanName string `json:"plan_name"` // populated for subscription codes
}

func GetAllRedemptions(startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err = tx.Model(&Redemption{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func SearchRedemptions(keyword string, startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Build query based on keyword type
	query := tx.Model(&Redemption{})

	// Only try to convert to ID if the string represents a valid integer
	if id, err := strconv.Atoi(keyword); err == nil {
		query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
	} else {
		query = query.Where("name LIKE ?", keyword+"%")
	}

	// Get total count
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated data
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	var err error = nil
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

func Redeem(key string, userId int) (*RedeemResult, error) {
	if key == "" {
		return nil, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return nil, errors.New("无效的 user id")
	}
	redemption := &Redemption{}

	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	result := &RedeemResult{}
	common.RandomSleep()
	err := DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		now := common.GetTimestamp()

		if redemption.PlanId > 0 {
			// Subscription code path
			plan, err := getSubscriptionPlanByIdTx(tx, redemption.PlanId)
			if err != nil {
				return errors.New("关联的订阅套餐不存在")
			}
			if !plan.Enabled {
				return errors.New("关联的订阅套餐已禁用")
			}
			_, err = CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption")
			if err != nil {
				return err
			}
			result.Type = "subscription"
			result.PlanName = plan.Title
		} else {
			// Balance code path (existing behavior)
			err = tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error
			if err != nil {
				return err
			}
			// Create QuotaRecord if ValidityPeriod > 0 (expiring balance)
			if redemption.ValidityPeriod > 0 {
				quotaRecord := &QuotaRecord{
					UserId:         userId,
					RedemptionId:   redemption.Id,
					OriginalAmount: redemption.Quota,
					Remaining:      redemption.Quota,
					Status:         common.QuotaRecordStatusActive,
					ExpiredTime:    now + redemption.ValidityPeriod,
				}
				err = CreateQuotaRecord(tx, quotaRecord)
				if err != nil {
					return err
				}
			}
			result.Type = "balance"
			result.Quota = redemption.Quota
		}

		redemption.RedeemedTime = now
		redemption.Status = common.RedemptionCodeStatusUsed
		redemption.UsedUserId = userId
		err = tx.Save(redemption).Error
		if err != nil {
			return err
		}

		// Create TopUp record for billing history
		topUp := &TopUp{
			UserId:        userId,
			Money:         0,
			PaymentMethod: "redemption",
			CreateTime:    now,
			CompleteTime:  now,
			Status:        "success",
		}
		if redemption.PlanId > 0 {
			topUp.Amount = 0
			topUp.TradeNo = fmt.Sprintf("subrdm%d", redemption.Id)
		} else {
			dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
			topUp.Amount = decimal.NewFromInt(int64(redemption.Quota)).Div(dQuotaPerUnit).IntPart()
			topUp.TradeNo = fmt.Sprintf("RDM%d", redemption.Id)
		}
		if err := tx.Create(topUp).Error; err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return nil, ErrRedeemFailed
	}
	if redemption.PlanId > 0 {
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码激活订阅套餐「%s」，兑换码ID %d", result.PlanName, redemption.Id))
	} else {
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	}
	return result, nil
}

func (redemption *Redemption) Insert() error {
	// Explicitly select all columns to ensure zero-value fields (e.g. Quota=0 for subscription codes)
	// are inserted rather than being skipped by GORM in favor of database defaults.
	return DB.Select(
		"user_id", "name", "key", "status", "quota", "created_time",
		"redeemed_time", "used_user_id", "expired_time", "validity_period", "plan_id",
	).Create(redemption).Error
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	var err error
	err = DB.Model(redemption).Select("name", "status", "quota", "redeemed_time", "expired_time", "validity_period", "plan_id").Updates(redemption).Error
	return err
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	err = DB.Where(redemption).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func BatchDeleteRedemptions(ids []int) (int64, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 不能为空")
	}
	result := DB.Where("id IN ?", ids).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}

func BatchUpdateRedemptionStatus(ids []int, status int) (int64, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 不能为空")
	}
	result := DB.Model(&Redemption{}).Where("id IN ?", ids).Update("status", status)
	return result.RowsAffected, result.Error
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
