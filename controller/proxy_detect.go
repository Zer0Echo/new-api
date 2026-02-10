package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

type ProxyDetectRequest struct {
	BaseURL         string   `json:"base_url"`
	APIKey          string   `json:"api_key"`
	Models          []string `json:"models"`
	Rounds          int      `json:"rounds"`
	VerifyRatelimit bool     `json:"verify_ratelimit"`
}

type ProxyDetectModelsRequest struct {
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
}

// resolveProxyDetectBaseURL applies admin/non-admin logic and validates the URL.
// Returns the resolved baseURL, isAdmin flag, and an error message if invalid.
func resolveProxyDetectBaseURL(c *gin.Context, baseURL string) (string, bool, string) {
	role := c.GetInt("role")
	isAdmin := role >= common.RoleAdminUser

	if !isAdmin {
		baseURL = system_setting.ServerAddress
	}
	if baseURL == "" {
		baseURL = system_setting.ServerAddress
	}

	if err := service.ValidateProxyDetectURL(baseURL); err != nil {
		return "", isAdmin, "无效的目标地址"
	}
	return baseURL, isAdmin, ""
}

func ProxyDetectListModels(c *gin.Context) {
	var req ProxyDetectModelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	if req.APIKey == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "API Key 不能为空",
		})
		return
	}

	baseURL, isAdmin, errMsg := resolveProxyDetectBaseURL(c, req.BaseURL)
	if errMsg != "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": errMsg,
		})
		return
	}

	models, err := service.FetchRemoteModels(baseURL, req.APIKey, isAdmin)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取模型列表失败: " + err.Error(),
		})
		return
	}

	common.ApiSuccess(c, models)
}

func ProxyDetect(c *gin.Context) {
	var req ProxyDetectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	if req.APIKey == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "API Key 不能为空",
		})
		return
	}

	if len(req.Models) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请选择要检测的模型",
		})
		return
	}

	if len(req.Models) > 6 {
		req.Models = req.Models[:6]
	}

	if req.Rounds <= 0 {
		req.Rounds = 2
	}
	if req.Rounds > 3 {
		req.Rounds = 3
	}

	baseURL, isAdmin, errMsg := resolveProxyDetectBaseURL(c, req.BaseURL)
	if errMsg != "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": errMsg,
		})
		return
	}

	if len(req.Models) == 1 {
		// Single model: use DetectSingleModel with ratelimit verification support
		detectResult := service.DetectSingleModel(baseURL, req.APIKey, req.Models[0], req.Rounds, isAdmin, req.VerifyRatelimit)
		// Wrap in ScanResult for uniform response format
		scanResult := service.ScanResult{
			BaseURL:       baseURL,
			ProxyPlatform: detectResult.ProxyPlatform,
			ModelResults:  []service.DetectResult{detectResult},
			Summary:       map[string]string{detectResult.Model: detectResult.Verdict},
			IsMixed:       false,
		}
		common.ApiSuccess(c, scanResult)
	} else {
		// Multiple models: use ScanMultipleModels
		result := service.ScanMultipleModels(baseURL, req.APIKey, req.Models, req.Rounds, isAdmin)
		common.ApiSuccess(c, result)
	}
}
