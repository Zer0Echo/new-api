package model

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type Ticket struct {
	Id           int            `json:"id"`
	UserId       int            `json:"user_id" gorm:"index"`
	Title        string         `json:"title" gorm:"type:varchar(200);index"`
	Description  string         `json:"description" gorm:"type:text"`
	Status       int            `json:"status" gorm:"default:1;index"`
	Priority     int            `json:"priority" gorm:"default:2;index"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime  int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt    gorm.DeletedAt `gorm:"index"`
	Username     string         `json:"username" gorm:"-:all"`
	MessageCount int64          `json:"message_count" gorm:"-:all"`
}

func fillTicketUsername(ticket *Ticket) {
	if ticket.UserId != 0 {
		username, err := GetUsernameById(ticket.UserId, false)
		if err == nil {
			ticket.Username = username
		}
	}
}

func fillTicketMessageCount(ticket *Ticket) {
	var count int64
	DB.Model(&TicketMessage{}).Where("ticket_id = ?", ticket.Id).Count(&count)
	ticket.MessageCount = count
}

func fillTicketsExtra(tickets []*Ticket) {
	for _, t := range tickets {
		fillTicketUsername(t)
		fillTicketMessageCount(t)
	}
}

func GetAllTickets(startIdx int, num int, status int, priority int) (tickets []*Ticket, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&Ticket{})
	if status != 0 {
		query = query.Where("status = ?", status)
	}
	if priority != 0 {
		query = query.Where("priority = ?", priority)
	}

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&tickets).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	fillTicketsExtra(tickets)
	return tickets, total, nil
}

func SearchTickets(keyword string, startIdx int, num int) (tickets []*Ticket, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&Ticket{})
	if id, parseErr := strconv.Atoi(keyword); parseErr == nil {
		query = query.Where("id = ? OR title LIKE ?", id, keyword+"%")
	} else {
		query = query.Where("title LIKE ?", keyword+"%")
	}

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&tickets).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	fillTicketsExtra(tickets)
	return tickets, total, nil
}

func GetSelfTickets(userId int, startIdx int, num int) (tickets []*Ticket, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&Ticket{}).Where("user_id = ?", userId)

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&tickets).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	fillTicketsExtra(tickets)
	return tickets, total, nil
}

func SearchSelfTickets(userId int, keyword string, startIdx int, num int) (tickets []*Ticket, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&Ticket{}).Where("user_id = ?", userId)
	if id, parseErr := strconv.Atoi(keyword); parseErr == nil {
		query = query.Where("id = ? OR title LIKE ?", id, keyword+"%")
	} else {
		query = query.Where("title LIKE ?", keyword+"%")
	}

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&tickets).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	fillTicketsExtra(tickets)
	return tickets, total, nil
}

func GetTicketById(id int) (*Ticket, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	ticket := Ticket{Id: id}
	err := DB.First(&ticket, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	fillTicketUsername(&ticket)
	fillTicketMessageCount(&ticket)
	return &ticket, nil
}

func CountUserOpenTickets(userId int) (int64, error) {
	var count int64
	err := DB.Model(&Ticket{}).Where("user_id = ? AND status != ?", userId, 4).Count(&count).Error
	return count, err
}

func CountUserTicketsCreatedToday(userId int) (int64, error) {
	now := common.GetTimestamp()
	todayStart := now - (now % 86400)
	var count int64
	err := DB.Model(&Ticket{}).Where("user_id = ? AND created_time >= ?", userId, todayStart).Count(&count).Error
	return count, err
}

func (ticket *Ticket) Insert() error {
	return DB.Create(ticket).Error
}

func (ticket *Ticket) Update() error {
	return DB.Model(ticket).Select("title", "description", "status", "priority", "updated_time").Updates(ticket).Error
}

func DeleteTicketById(id int) error {
	if id == 0 {
		return errors.New("id 为空！")
	}
	ticket := Ticket{Id: id}
	err := DB.Where(ticket).First(&ticket).Error
	if err != nil {
		return err
	}
	// Also delete associated messages
	DB.Where("ticket_id = ?", id).Delete(&TicketMessage{})
	return DB.Delete(&ticket).Error
}
