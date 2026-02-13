package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

type QuotaRecord struct {
	Id             int            `json:"id"`
	UserId         int            `json:"user_id" gorm:"index:idx_qr_user_status;index"`
	RedemptionId   int            `json:"redemption_id" gorm:"index"`
	OriginalAmount int            `json:"original_amount"`
	Remaining      int            `json:"remaining" gorm:"default:0"`
	Status         int            `json:"status" gorm:"default:1;index:idx_qr_user_status"`
	ExpiredTime    int64          `json:"expired_time" gorm:"bigint;index:idx_qr_expiry"`
	CreatedTime    int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime    int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt      gorm.DeletedAt `gorm:"index"`
}

func CreateQuotaRecord(tx *gorm.DB, record *QuotaRecord) error {
	record.CreatedTime = common.GetTimestamp()
	record.UpdatedTime = record.CreatedTime
	return tx.Create(record).Error
}

// GetActiveQuotaRecordsByUser returns active quota records ordered by expiry ASC (FIFO).
func GetActiveQuotaRecordsByUser(userId int) ([]*QuotaRecord, error) {
	var records []*QuotaRecord
	err := DB.Where("user_id = ? AND status = ?", userId, common.QuotaRecordStatusActive).
		Order("CASE WHEN expired_time = 0 THEN 1 ELSE 0 END ASC, expired_time ASC").
		Find(&records).Error
	return records, err
}

// ConsumeQuotaRecordsFIFO consumes quota from the earliest-expiring records first.
// Must be called within a transaction.
func ConsumeQuotaRecordsFIFO(tx *gorm.DB, userId int, amount int) (consumed int, err error) {
	if amount <= 0 {
		return 0, nil
	}

	var records []*QuotaRecord
	queryTx := tx
	if !common.UsingSQLite {
		queryTx = tx.Set("gorm:query_option", "FOR UPDATE")
	}
	err = queryTx.Where("user_id = ? AND status = ?", userId, common.QuotaRecordStatusActive).
		Order("CASE WHEN expired_time = 0 THEN 1 ELSE 0 END ASC, expired_time ASC").
		Find(&records).Error
	if err != nil {
		return 0, err
	}

	remaining := amount
	now := time.Now().Unix()
	for _, record := range records {
		if remaining <= 0 {
			break
		}
		if record.Remaining <= 0 {
			continue
		}

		deduct := remaining
		if deduct > record.Remaining {
			deduct = record.Remaining
		}

		record.Remaining -= deduct
		record.UpdatedTime = now
		if record.Remaining == 0 {
			record.Status = common.QuotaRecordStatusConsumed
		}

		err = tx.Model(record).Select("remaining", "status", "updated_time").Updates(record).Error
		if err != nil {
			return consumed, err
		}

		consumed += deduct
		remaining -= deduct
	}

	return consumed, nil
}

// ExpireQuotaRecords expires quota records in batches (background task).
// Returns the number of expired records.
func ExpireQuotaRecords(batchSize int) (int, error) {
	now := common.GetTimestamp()
	total := 0

	for {
		var records []*QuotaRecord
		err := DB.Where("status = ? AND expired_time > 0 AND expired_time <= ?",
			common.QuotaRecordStatusActive, now).
			Limit(batchSize).
			Find(&records).Error
		if err != nil {
			return total, err
		}
		if len(records) == 0 {
			break
		}

		for _, record := range records {
			err := expireSingleRecord(record)
			if err != nil {
				common.SysError(fmt.Sprintf("failed to expire quota record %d: %s", record.Id, err.Error()))
				continue
			}
			total++
		}

		if len(records) < batchSize {
			break
		}
	}

	return total, nil
}

func expireSingleRecord(record *QuotaRecord) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		// Re-fetch with lock
		var fresh QuotaRecord
		queryTx := tx
		if !common.UsingSQLite {
			queryTx = tx.Set("gorm:query_option", "FOR UPDATE")
		}
		err := queryTx.First(&fresh, record.Id).Error
		if err != nil {
			return err
		}
		if fresh.Status != common.QuotaRecordStatusActive {
			return nil // already handled
		}

		expiredAmount := fresh.Remaining
		if expiredAmount <= 0 {
			// No remaining balance to expire, just mark as expired
			return tx.Model(&fresh).Updates(map[string]interface{}{
				"status":       common.QuotaRecordStatusExpired,
				"remaining":    0,
				"updated_time": time.Now().Unix(),
			}).Error
		}

		// Deduct expired amount from user.Quota
		err = tx.Model(&User{}).Where("id = ?", fresh.UserId).
			Update("quota", gorm.Expr("quota - ?", expiredAmount)).Error
		if err != nil {
			return err
		}

		// Mark record as expired
		err = tx.Model(&fresh).Updates(map[string]interface{}{
			"status":       common.QuotaRecordStatusExpired,
			"remaining":    0,
			"updated_time": time.Now().Unix(),
		}).Error
		if err != nil {
			return err
		}

		// Update Redis cache
		cacheDecrUserQuota(fresh.UserId, int64(expiredAmount))

		// Log the expiration
		RecordLog(fresh.UserId, LogTypeSystem,
			fmt.Sprintf("兑换码额度过期，扣除 %s（兑换码记录ID %d）",
				logger.LogQuota(expiredAmount), fresh.Id))

		return nil
	})
}

// ExpireQuotaRecordsForUser expires all due records for a specific user within a transaction.
// Returns the total expired amount.
func ExpireQuotaRecordsForUser(tx *gorm.DB, userId int) (expiredAmount int, err error) {
	now := common.GetTimestamp()

	var records []*QuotaRecord
	queryTx := tx
	if !common.UsingSQLite {
		queryTx = tx.Set("gorm:query_option", "FOR UPDATE")
	}
	err = queryTx.Where("user_id = ? AND status = ? AND expired_time > 0 AND expired_time <= ?",
		userId, common.QuotaRecordStatusActive, now).
		Find(&records).Error
	if err != nil {
		return 0, err
	}

	for _, record := range records {
		if record.Remaining > 0 {
			expiredAmount += record.Remaining
		}
		err = tx.Model(record).Updates(map[string]interface{}{
			"status":       common.QuotaRecordStatusExpired,
			"remaining":    0,
			"updated_time": now,
		}).Error
		if err != nil {
			return expiredAmount, err
		}
	}

	// Deduct all expired amounts from user.Quota in one update
	if expiredAmount > 0 {
		err = tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota - ?", expiredAmount)).Error
		if err != nil {
			return expiredAmount, err
		}
		RecordLog(userId, LogTypeSystem,
			fmt.Sprintf("兑换码额度过期，扣除 %s", logger.LogQuota(expiredAmount)))
	}

	return expiredAmount, nil
}

// GetQuotaRecordsByUser returns paginated quota records for a user.
func GetQuotaRecordsByUser(userId int, startIdx int, num int) ([]*QuotaRecord, int64, error) {
	var records []*QuotaRecord
	var total int64

	query := DB.Model(&QuotaRecord{}).Where("user_id = ?", userId)
	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&records).Error
	if err != nil {
		return nil, 0, err
	}

	return records, total, nil
}

// GetUserExpiringBalance returns the total remaining balance from active quota records.
func GetUserExpiringBalance(userId int) (int, error) {
	var total int
	err := DB.Model(&QuotaRecord{}).
		Where("user_id = ? AND status = ?", userId, common.QuotaRecordStatusActive).
		Select("COALESCE(SUM(remaining), 0)").
		Scan(&total).Error
	return total, err
}

// UserHasActiveQuotaRecords checks if a user has any active (expiring) quota records.
func UserHasActiveQuotaRecords(userId int) bool {
	var count int64
	DB.Model(&QuotaRecord{}).
		Where("user_id = ? AND status = ?", userId, common.QuotaRecordStatusActive).
		Limit(1).
		Count(&count)
	return count > 0
}

// GetQuotaRecordById returns a single quota record by ID.
func GetQuotaRecordById(id int) (*QuotaRecord, error) {
	var record QuotaRecord
	err := DB.First(&record, id).Error
	return &record, err
}

// UpdateQuotaRecordAdmin updates a quota record (admin). Adjusts user.Quota by the delta.
func UpdateQuotaRecordAdmin(id int, newRemaining int, newExpiredTime int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var record QuotaRecord
		queryTx := tx
		if !common.UsingSQLite {
			queryTx = tx.Set("gorm:query_option", "FOR UPDATE")
		}
		err := queryTx.First(&record, id).Error
		if err != nil {
			return err
		}

		delta := newRemaining - record.Remaining
		now := time.Now().Unix()

		updates := map[string]interface{}{
			"remaining":    newRemaining,
			"updated_time": now,
		}
		if newExpiredTime > 0 {
			updates["expired_time"] = newExpiredTime
		}
		if newRemaining > 0 && record.Status != common.QuotaRecordStatusActive {
			updates["status"] = common.QuotaRecordStatusActive
		} else if newRemaining == 0 && record.Status == common.QuotaRecordStatusActive {
			updates["status"] = common.QuotaRecordStatusConsumed
		}

		err = tx.Model(&record).Updates(updates).Error
		if err != nil {
			return err
		}

		// Adjust user.Quota by the delta
		if delta != 0 {
			err = tx.Model(&User{}).Where("id = ?", record.UserId).
				Update("quota", gorm.Expr("quota + ?", delta)).Error
			if err != nil {
				return err
			}
			if delta > 0 {
				cacheIncrUserQuota(record.UserId, int64(delta))
			} else {
				cacheDecrUserQuota(record.UserId, int64(-delta))
			}
		}

		return nil
	})
}
