package controller

import (
	"net/http"
	"strconv"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// ========== User endpoints ==========

func GetSelfTickets(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	tickets, total, err := model.GetSelfTickets(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

func SearchSelfTickets(c *gin.Context) {
	userId := c.GetInt("id")
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)
	tickets, total, err := model.SearchSelfTickets(userId, keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

func CreateTicket(c *gin.Context) {
	ticket := model.Ticket{}
	err := c.ShouldBindJSON(&ticket)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	titleLen := utf8.RuneCountInString(ticket.Title)
	if titleLen == 0 {
		common.ApiErrorI18n(c, i18n.MsgTicketTitleEmpty)
		return
	}
	if titleLen > 200 {
		common.ApiErrorI18n(c, i18n.MsgTicketTitleTooLong)
		return
	}
	descLen := utf8.RuneCountInString(ticket.Description)
	if descLen == 0 {
		common.ApiErrorI18n(c, i18n.MsgTicketContentEmpty)
		return
	}
	if descLen > 2000 {
		common.ApiErrorI18n(c, i18n.MsgTicketContentTooLong)
		return
	}
	if ticket.Priority < common.TicketPriorityLow || ticket.Priority > common.TicketPriorityCritical {
		ticket.Priority = common.TicketPriorityMedium
	}

	userId := c.GetInt("id")

	// Rate limit: max 5 open tickets per user
	openCount, err := model.CountUserOpenTickets(userId)
	if err == nil && openCount >= 5 {
		common.ApiErrorI18n(c, i18n.MsgTicketTooManyOpen)
		return
	}

	// Rate limit: max 3 new tickets per day
	todayCount, err := model.CountUserTicketsCreatedToday(userId)
	if err == nil && todayCount >= 3 {
		common.ApiErrorI18n(c, i18n.MsgTicketDailyLimitReached)
		return
	}

	now := common.GetTimestamp()
	cleanTicket := model.Ticket{
		UserId:      userId,
		Title:       ticket.Title,
		Description: ticket.Description,
		Status:      common.TicketStatusOpen,
		Priority:    ticket.Priority,
		CreatedTime: now,
		UpdatedTime: now,
	}
	err = cleanTicket.Insert()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgCreateFailed)
		return
	}
	common.ApiSuccess(c, cleanTicket)
}

func CloseTicket(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	ticket, err := model.GetTicketById(id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTicketNotFound)
		return
	}
	userId := c.GetInt("id")
	if ticket.UserId != userId {
		common.ApiErrorI18n(c, i18n.MsgTicketNoPermission)
		return
	}
	if ticket.Status == common.TicketStatusClosed {
		common.ApiErrorI18n(c, i18n.MsgTicketAlreadyClosed)
		return
	}
	ticket.Status = common.TicketStatusClosed
	ticket.UpdatedTime = common.GetTimestamp()
	err = ticket.Update()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUpdateFailed)
		return
	}
	common.ApiSuccess(c, ticket)
}

func GetTicketMessages(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	ticket, err := model.GetTicketById(id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTicketNotFound)
		return
	}
	userId := c.GetInt("id")
	role := c.GetInt("role")
	if ticket.UserId != userId && role < common.RoleAdminUser {
		common.ApiErrorI18n(c, i18n.MsgTicketNoPermission)
		return
	}
	messages, err := model.GetTicketMessages(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, messages)
}

func AddTicketMessage(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	ticket, err := model.GetTicketById(id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTicketNotFound)
		return
	}
	userId := c.GetInt("id")
	if ticket.UserId != userId {
		common.ApiErrorI18n(c, i18n.MsgTicketNoPermission)
		return
	}
	if ticket.Status == common.TicketStatusClosed {
		common.ApiErrorI18n(c, i18n.MsgTicketAlreadyClosed)
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	err = c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if utf8.RuneCountInString(req.Content) == 0 {
		common.ApiErrorI18n(c, i18n.MsgTicketContentEmpty)
		return
	}
	if utf8.RuneCountInString(req.Content) > 2000 {
		common.ApiErrorI18n(c, i18n.MsgTicketContentTooLong)
		return
	}

	// Rate limit: max 20 messages per ticket per day
	msgCount, err := model.CountUserMessagesInTicketToday(userId, id)
	if err == nil && msgCount >= 20 {
		common.ApiErrorI18n(c, i18n.MsgTicketMessageDailyLimit)
		return
	}

	msg := model.TicketMessage{
		TicketId:    id,
		UserId:      userId,
		Content:     req.Content,
		IsAdmin:     false,
		CreatedTime: common.GetTimestamp(),
	}
	err = msg.Insert()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgCreateFailed)
		return
	}

	// Update ticket timestamp
	ticket.UpdatedTime = common.GetTimestamp()
	_ = ticket.Update()

	common.ApiSuccess(c, msg)
}

// ========== Admin endpoints ==========

func GetAllTickets(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status, _ := strconv.Atoi(c.Query("status"))
	priority, _ := strconv.Atoi(c.Query("priority"))
	tickets, total, err := model.GetAllTickets(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), status, priority)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

func SearchTickets(c *gin.Context) {
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)
	tickets, total, err := model.SearchTickets(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

func UpdateTicket(c *gin.Context) {
	var req struct {
		Id       int `json:"id"`
		Status   int `json:"status"`
		Priority int `json:"priority"`
	}
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	ticket, err := model.GetTicketById(req.Id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTicketNotFound)
		return
	}
	if req.Status != 0 {
		if req.Status < common.TicketStatusOpen || req.Status > common.TicketStatusClosed {
			common.ApiErrorI18n(c, i18n.MsgTicketStatusInvalid)
			return
		}
		ticket.Status = req.Status
	}
	if req.Priority != 0 {
		if req.Priority < common.TicketPriorityLow || req.Priority > common.TicketPriorityCritical {
			common.ApiErrorI18n(c, i18n.MsgTicketPriorityInvalid)
			return
		}
		ticket.Priority = req.Priority
	}
	ticket.UpdatedTime = common.GetTimestamp()
	err = ticket.Update()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUpdateFailed)
		return
	}
	common.ApiSuccess(c, ticket)
}

func DeleteTicket(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	err := model.DeleteTicketById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func AdminAddTicketMessage(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	ticket, err := model.GetTicketById(id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTicketNotFound)
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	err = c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if utf8.RuneCountInString(req.Content) == 0 {
		common.ApiErrorI18n(c, i18n.MsgTicketContentEmpty)
		return
	}
	if utf8.RuneCountInString(req.Content) > 2000 {
		common.ApiErrorI18n(c, i18n.MsgTicketContentTooLong)
		return
	}

	msg := model.TicketMessage{
		TicketId:    id,
		UserId:      c.GetInt("id"),
		Content:     req.Content,
		IsAdmin:     true,
		CreatedTime: common.GetTimestamp(),
	}
	err = msg.Insert()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgCreateFailed)
		return
	}

	// Auto-set ticket to InProgress if it was Open
	if ticket.Status == common.TicketStatusOpen {
		ticket.Status = common.TicketStatusInProgress
	}
	ticket.UpdatedTime = common.GetTimestamp()
	_ = ticket.Update()

	common.ApiSuccess(c, msg)
}
