package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type TicketMessage struct {
	Id          int            `json:"id"`
	TicketId    int            `json:"ticket_id" gorm:"index"`
	UserId      int            `json:"user_id" gorm:"index"`
	Content     string         `json:"content" gorm:"type:text"`
	IsAdmin     bool           `json:"is_admin" gorm:"default:false"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `gorm:"index"`
	Username    string         `json:"username" gorm:"-:all"`
}

func GetTicketMessages(ticketId int) ([]*TicketMessage, error) {
	if ticketId == 0 {
		return nil, errors.New("ticket_id 为空！")
	}
	var messages []*TicketMessage
	err := DB.Where("ticket_id = ?", ticketId).Order("id asc").Find(&messages).Error
	if err != nil {
		return nil, err
	}
	for _, msg := range messages {
		if msg.UserId != 0 {
			username, err := GetUsernameById(msg.UserId, false)
			if err == nil {
				msg.Username = username
			}
		}
	}
	return messages, nil
}

func (msg *TicketMessage) Insert() error {
	return DB.Create(msg).Error
}

func CountUserMessagesInTicketToday(userId int, ticketId int) (int64, error) {
	now := common.GetTimestamp()
	todayStart := now - (now % 86400)
	var count int64
	err := DB.Model(&TicketMessage{}).Where("user_id = ? AND ticket_id = ? AND created_time >= ?", userId, ticketId, todayStart).Count(&count).Error
	return count, err
}
