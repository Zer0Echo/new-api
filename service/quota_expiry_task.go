package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	quotaExpiryTickInterval = 1 * time.Minute
	quotaExpiryBatchSize    = 300
)

var (
	quotaExpiryOnce    sync.Once
	quotaExpiryRunning atomic.Bool
)

func StartQuotaExpiryTask() {
	quotaExpiryOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("quota expiry task started: tick=%s", quotaExpiryTickInterval))
			ticker := time.NewTicker(quotaExpiryTickInterval)
			defer ticker.Stop()

			runQuotaExpiryOnce()
			for range ticker.C {
				runQuotaExpiryOnce()
			}
		})
	})
}

func runQuotaExpiryOnce() {
	if !quotaExpiryRunning.CompareAndSwap(false, true) {
		return
	}
	defer quotaExpiryRunning.Store(false)

	ctx := context.Background()
	totalExpired, err := model.ExpireQuotaRecords(quotaExpiryBatchSize)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("quota expiry task failed: %v", err))
		return
	}
	if common.DebugEnabled && totalExpired > 0 {
		logger.LogDebug(ctx, "quota expiry maintenance: expired_count=%d", totalExpired)
	}
}
