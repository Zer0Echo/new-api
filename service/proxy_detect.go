package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Fingerprint constants
const (
	anthropicToolPrefix = "toolu_"
	bedrockToolPrefix   = "tooluse_"
	anthropicMsgPrefix  = "msg_"
	kiroModelPrefix     = "kiro-"
	bedrockModelPrefix  = "anthropic."

	thinkingSigShortThreshold = 100

	// Overall timeout for a single detection (all probes for one model)
	singleDetectTimeout = 120 * time.Second
	// Overall timeout for multi-model scan
	multiScanTimeout = 300 * time.Second
	// Timeout for individual probe requests
	probeTimeout = 60 * time.Second
	// Timeout for model availability check
	availCheckTimeout = 20 * time.Second
)

var (
	msgIDUUIDPattern = regexp.MustCompile(`(?i)^msg_[0-9a-f]{8}-[0-9a-f]{4}-`)
	toolNPattern     = regexp.MustCompile(`^tool_\d+$`)
	uuidPattern      = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

	awsHeaderKeywords       = []string{"x-amzn", "x-amz-", "bedrock"}
	anthropicHeaderKeywords = []string{"anthropic-ratelimit", "x-ratelimit", "retry-after"}
)

// DefaultScanModels are the default models for multi-model scanning
var DefaultScanModels = []string{
	"claude-opus-4-6-thinking",
	"claude-opus-4-6-20250918",
	"claude-sonnet-4-5-20250929",
	"claude-haiku-4-5-20251001",
	"claude-3-5-sonnet-20241022",
	"claude-3-haiku-20240307",
}

// Fingerprint holds the extracted fingerprint from a single probe
type Fingerprint struct {
	ToolID           string `json:"tool_id"`
	ToolIDSource     string `json:"tool_id_source"`
	MsgID            string `json:"msg_id"`
	MsgIDSource      string `json:"msg_id_source"`
	MsgIDFormat      string `json:"msg_id_format"`
	Model            string `json:"model"`
	ModelRequested   string `json:"model_requested"`
	ModelSource      string `json:"model_source"`
	UsageStyle       string `json:"usage_style"`
	HasServiceTier   bool   `json:"has_service_tier"`
	ServiceTier      string `json:"service_tier"`
	HasInferenceGeo  bool   `json:"has_inference_geo"`
	InferenceGeo     string `json:"inference_geo"`
	HasCacheCreation bool   `json:"has_cache_creation_obj"`
	HasAWSHeaders    bool   `json:"has_aws_headers"`
	HasAnthropicHdrs bool   `json:"has_anthropic_headers"`
	ThinkingSigClass string `json:"thinking_sig_class"`
	ThinkingSigLen   int    `json:"thinking_sig_len"`
	ProbeType        string `json:"probe_type"`
	LatencyMs        int64  `json:"latency_ms"`
	StopReason       string `json:"stop_reason"`
	ProxyPlatform    string   `json:"proxy_platform,omitempty"`
	PlatformClues    []string `json:"platform_clues,omitempty"`
	Error            string   `json:"error,omitempty"`
	// Rate limit headers (Anthropic-specific)
	RatelimitInputLimit     int    `json:"ratelimit_input_limit,omitempty"`
	RatelimitInputRemaining int    `json:"ratelimit_input_remaining,omitempty"`
	RatelimitInputReset     string `json:"ratelimit_input_reset,omitempty"`
}

// DetectResult holds the analysis result for a single model
type DetectResult struct {
	Verdict          string                 `json:"verdict"`
	VerdictText      string                 `json:"verdict_text"`
	Confidence       float64                `json:"confidence"`
	Scores           map[string]int         `json:"scores"`
	Evidence         []string               `json:"evidence"`
	Fingerprints     []Fingerprint          `json:"fingerprints"`
	Model            string                 `json:"model"`
	AvgLatencyMs     int64                  `json:"avg_latency_ms"`
	ProxyPlatform    string                 `json:"proxy_platform"`
	PlatformClues    []string               `json:"platform_clues,omitempty"`
	RatelimitVerify  map[string]any         `json:"ratelimit_verify,omitempty"`
}

// ScanResult holds the result for multi-model scanning
type ScanResult struct {
	BaseURL       string            `json:"base_url"`
	ProxyPlatform string            `json:"proxy_platform"`
	ModelResults  []DetectResult    `json:"model_results"`
	Summary       map[string]string `json:"summary"`
	IsMixed       bool              `json:"is_mixed"`
}

var verdictTextMap = map[string]string{
	"anthropic":   "Anthropic 官方 API",
	"bedrock":     "AWS Bedrock (Kiro)",
	"antigravity": "Google Vertex AI (Antigravity)",
	"suspicious":  "疑似伪装 Anthropic",
	"unknown":     "无法确定",
}

// safeDialer returns a DialContext that blocks connections to private/internal IPs
// This prevents SSRF by checking the resolved IP at connection time (no TOCTOU gap)
func safeDialer() func(ctx context.Context, network, addr string) (net.Conn, error) {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, fmt.Errorf("invalid address: %v", err)
		}

		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, fmt.Errorf("DNS lookup failed: %v", err)
		}

		for _, ipAddr := range ips {
			ip := ipAddr.IP
			if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
				ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
				return nil, fmt.Errorf("connection to private IP blocked")
			}
			// Block cloud metadata endpoints (169.254.169.254)
			if ip.Equal(net.ParseIP("169.254.169.254")) {
				return nil, fmt.Errorf("connection to metadata endpoint blocked")
			}
		}

		return dialer.DialContext(ctx, network, net.JoinHostPort(host, port))
	}
}

// newSafeHTTPClient creates an HTTP client that blocks connections to private IPs
func newSafeHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			DialContext: safeDialer(),
		},
	}
}

// newUnsafeHTTPClient creates a regular HTTP client (for admin use on internal URLs)
func newUnsafeHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{Timeout: timeout}
}

// classifyMsgID classifies the message ID format
func classifyMsgID(msgID string) (source, format string) {
	if msgID == "" {
		return "unknown", ""
	}
	if strings.HasPrefix(msgID, "req_vrtx_") {
		return "vertex", "req_vrtx"
	}
	if strings.HasPrefix(msgID, anthropicMsgPrefix) {
		if msgIDUUIDPattern.MatchString(msgID) {
			return "antigravity", "msg_uuid"
		}
		return "anthropic", "base62"
	}
	if uuidPattern.MatchString(msgID) {
		return "rewritten", "uuid"
	}
	return "rewritten", "other"
}

// classifyThinkingSig classifies the thinking signature
func classifyThinkingSig(sig string) string {
	if sig == "" {
		return "none"
	}
	if len(sig) < thinkingSigShortThreshold {
		return "short"
	}
	if strings.HasPrefix(sig, "claude#") {
		return "vertex"
	}
	return "normal"
}

// detectProxyPlatform detects the proxy platform from response headers
func detectProxyPlatform(headers http.Header) (string, []string) {
	platform := ""
	var clues []string

	for k := range headers {
		kl := strings.ToLower(k)
		if strings.Contains(kl, "aidistri") {
			platform = "Aidistri"
			clues = append(clues, "X-Aidistri-Request-Id")
		}
		if strings.Contains(kl, "one-api") || strings.Contains(kl, "new-api") {
			platform = "OneAPI/NewAPI"
			clues = append(clues, "OneAPI header detected")
		}
	}

	cors := headers.Get("Access-Control-Allow-Headers")
	if strings.Contains(strings.ToLower(cors), "accounthub") {
		if platform == "" {
			platform = "AccountHub"
		}
		for _, part := range strings.Split(cors, ",") {
			part = strings.TrimSpace(part)
			pl := strings.ToLower(part)
			if strings.Contains(pl, "accounthub") || strings.Contains(pl, "pool") {
				clues = append(clues, part)
				if len(clues) >= 5 {
					break
				}
			}
		}
	}

	for k, vals := range headers {
		kl := strings.ToLower(k)
		for _, v := range vals {
			if strings.Contains(kl, "openrouter") || strings.Contains(strings.ToLower(v), "openrouter") {
				platform = "OpenRouter"
				clues = append(clues, "OpenRouter header detected")
			}
		}
	}

	// CloudFlare detection
	if strings.ToLower(headers.Get("Server")) == "cloudflare" {
		if cfRay := headers.Get("Cf-Ray"); cfRay != "" {
			clues = append(clues, fmt.Sprintf("CF-Ray: %s", cfRay))
		}
	}

	return platform, clues
}

// buildToolPayload builds the tool probe request body
func buildToolPayload(model string) map[string]any {
	return map[string]any{
		"model":      model,
		"max_tokens": 50,
		"tools": []map[string]any{
			{
				"name":        "probe",
				"description": "Probe function",
				"input_schema": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"q": map[string]any{"type": "string"},
					},
					"required": []string{"q"},
				},
			},
		},
		"tool_choice": map[string]any{"type": "tool", "name": "probe"},
		"messages": []map[string]any{
			{"role": "user", "content": "call probe with q=test"},
		},
	}
}

// buildThinkingPayload builds the thinking probe request body
func buildThinkingPayload(model string) map[string]any {
	return map[string]any{
		"model":      model,
		"max_tokens": 2048,
		"thinking": map[string]any{
			"type":          "enabled",
			"budget_tokens": 1024,
		},
		"messages": []map[string]any{
			{"role": "user", "content": "What is 2+3?"},
		},
	}
}

// probeOnce sends one probe request and extracts fingerprints
func probeOnce(ctx context.Context, client *http.Client, baseURL, apiKey, model, probeType string) Fingerprint {
	fp := Fingerprint{
		ProbeType:      probeType,
		ModelRequested: model,
	}

	var payload map[string]any
	switch probeType {
	case "tool":
		payload = buildToolPayload(model)
	case "thinking":
		payload = buildThinkingPayload(model)
	default:
		payload = map[string]any{
			"model":      model,
			"max_tokens": 5,
			"messages":   []map[string]any{{"role": "user", "content": "Say OK"}},
		}
	}

	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		fp.Error = "failed to build request"
		return fp
	}

	reqURL := strings.TrimRight(baseURL, "/") + "/v1/messages"
	req, err := http.NewRequestWithContext(ctx, "POST", reqURL, bytes.NewReader(payloadBytes))
	if err != nil {
		fp.Error = "failed to create request"
		return fp
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)

	t0 := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			fp.Error = "detection timed out"
		} else {
			fp.Error = "request failed"
		}
		return fp
	}
	defer resp.Body.Close()
	fp.LatencyMs = time.Since(t0).Milliseconds()

	if resp.StatusCode != 200 {
		bodySnippet, _ := io.ReadAll(io.LimitReader(resp.Body, 200))
		fp.Error = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(bodySnippet))
		return fp
	}

	// Parse headers
	for k := range resp.Header {
		kl := strings.ToLower(k)
		for _, kw := range awsHeaderKeywords {
			if strings.Contains(kl, kw) {
				fp.HasAWSHeaders = true
				break
			}
		}
		for _, kw := range anthropicHeaderKeywords {
			if strings.Contains(kl, kw) {
				fp.HasAnthropicHdrs = true
				break
			}
		}
	}

	// Detect proxy platform from response headers
	fp.ProxyPlatform, fp.PlatformClues = detectProxyPlatform(resp.Header)

	// Extract rate limit headers
	for k, vals := range resp.Header {
		kl := strings.ToLower(k)
		if kl == "anthropic-ratelimit-input-tokens-limit" && len(vals) > 0 {
			if n, err := strconv.Atoi(vals[0]); err == nil {
				fp.RatelimitInputLimit = n
			}
		} else if kl == "anthropic-ratelimit-input-tokens-remaining" && len(vals) > 0 {
			if n, err := strconv.Atoi(vals[0]); err == nil {
				fp.RatelimitInputRemaining = n
			}
		} else if kl == "anthropic-ratelimit-input-tokens-reset" && len(vals) > 0 {
			fp.RatelimitInputReset = vals[0]
		}
	}

	// Parse body
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		fp.Error = "failed to read response"
		return fp
	}

	var body map[string]any
	if err := common.Unmarshal(bodyBytes, &body); err != nil {
		fp.Error = "response body not JSON"
		return fp
	}

	// 1) tool_use id and thinking signature from content blocks
	if content, ok := body["content"].([]any); ok {
		for _, block := range content {
			bm, ok := block.(map[string]any)
			if !ok {
				continue
			}
			if bm["type"] == "tool_use" {
				fp.ToolID, _ = bm["id"].(string)
				if strings.HasPrefix(fp.ToolID, bedrockToolPrefix) {
					fp.ToolIDSource = "bedrock"
				} else if strings.HasPrefix(fp.ToolID, anthropicToolPrefix) {
					fp.ToolIDSource = "anthropic"
				} else if toolNPattern.MatchString(fp.ToolID) {
					fp.ToolIDSource = "vertex"
				} else if fp.ToolID != "" {
					fp.ToolIDSource = "rewritten"
				}
			}
			if bm["type"] == "thinking" {
				sig, _ := bm["signature"].(string)
				fp.ThinkingSigLen = len(sig)
				fp.ThinkingSigClass = classifyThinkingSig(sig)
			}
		}
	}

	// 2) message id
	fp.MsgID, _ = body["id"].(string)
	fp.MsgIDSource, fp.MsgIDFormat = classifyMsgID(fp.MsgID)

	// 3) model
	fp.Model, _ = body["model"].(string)
	if strings.HasPrefix(fp.Model, kiroModelPrefix) {
		fp.ModelSource = "kiro"
	} else if strings.HasPrefix(fp.Model, bedrockModelPrefix) {
		fp.ModelSource = "bedrock"
	} else if fp.Model != "" {
		fp.ModelSource = "anthropic"
	}

	// 4) usage
	if usage, ok := body["usage"].(map[string]any); ok {
		if _, ok := usage["inputTokens"]; ok {
			fp.UsageStyle = "camelCase"
		} else if _, ok := usage["input_tokens"]; ok {
			fp.UsageStyle = "snake_case"
		}
		if st, ok := usage["service_tier"]; ok {
			fp.HasServiceTier = true
			fp.ServiceTier = fmt.Sprintf("%v", st)
		}
		if ig, ok := usage["inference_geo"]; ok {
			fp.HasInferenceGeo = true
			fp.InferenceGeo = fmt.Sprintf("%v", ig)
		}
		if cc, ok := usage["cache_creation"]; ok {
			if _, isMap := cc.(map[string]any); isMap {
				fp.HasCacheCreation = true
			}
		}
	}

	// 5) stop_reason
	fp.StopReason, _ = body["stop_reason"].(string)

	return fp
}

// analyze performs multi-round three-source analysis
func analyze(fingerprints []Fingerprint, model string) DetectResult {
	result := DetectResult{
		Model:  model,
		Scores: map[string]int{"anthropic": 0, "bedrock": 0, "antigravity": 0},
	}

	var validFPs []Fingerprint
	for _, fp := range fingerprints {
		if fp.Error == "" {
			validFPs = append(validFPs, fp)
		}
	}

	if len(validFPs) == 0 {
		result.Verdict = "unknown"
		result.Evidence = []string{"所有探测均失败"}
		result.Fingerprints = fingerprints
		result.VerdictText = verdictTextMap["unknown"]
		return result
	}

	// Average latency
	var totalLatency int64
	for _, fp := range validFPs {
		totalLatency += fp.LatencyMs
	}
	result.AvgLatencyMs = totalLatency / int64(len(validFPs))

	// Proxy platform: use the first non-empty platform found in fingerprints
	for _, fp := range validFPs {
		if fp.ProxyPlatform != "" {
			result.ProxyPlatform = fp.ProxyPlatform
			result.PlatformClues = fp.PlatformClues
			break
		}
	}

	scores := result.Scores
	var evidence []string

	if result.ProxyPlatform != "" {
		evidence = append(evidence, fmt.Sprintf("中转平台: %s", result.ProxyPlatform))
	}

	for i, fp := range validFPs {
		tag := fmt.Sprintf("[R%d]", i+1)

		// 1. tool_use id (weight 5)
		switch fp.ToolIDSource {
		case "bedrock":
			scores["bedrock"] += 5
			evidence = append(evidence, fmt.Sprintf("%s tool_use id: %s -> tooluse_ (Bedrock/AG)", tag, truncStr(fp.ToolID, 28)))
		case "anthropic":
			scores["anthropic"] += 5
			evidence = append(evidence, fmt.Sprintf("%s tool_use id: %s -> toolu_ (Anthropic)", tag, truncStr(fp.ToolID, 28)))
		case "vertex":
			scores["antigravity"] += 5
			evidence = append(evidence, fmt.Sprintf("%s tool_use id: %s -> tool_N (Vertex AI)", tag, truncStr(fp.ToolID, 28)))
		case "rewritten":
			if fp.ToolID != "" {
				evidence = append(evidence, fmt.Sprintf("%s tool_use id: %s -> 被改写", tag, truncStr(fp.ToolID, 28)))
			}
		}

		// 2. thinking signature
		switch fp.ThinkingSigClass {
		case "short":
			evidence = append(evidence, fmt.Sprintf("%s thinking sig: (len=%d) -> 签名截断", tag, fp.ThinkingSigLen))
		case "vertex":
			scores["antigravity"] += 5
			evidence = append(evidence, fmt.Sprintf("%s thinking sig: (len=%d) -> claude# 前缀 (Vertex AI)", tag, fp.ThinkingSigLen))
		case "normal":
			evidence = append(evidence, fmt.Sprintf("%s thinking sig: (len=%d) -> 正常签名", tag, fp.ThinkingSigLen))
		case "none":
			if fp.ProbeType == "thinking" {
				evidence = append(evidence, fmt.Sprintf("%s thinking sig: 无签名", tag))
			}
		}

		// 3. message id
		switch fp.MsgIDSource {
		case "anthropic":
			scores["anthropic"] += 2
			evidence = append(evidence, fmt.Sprintf("%s message id: %s -> msg_<base62> (Anthropic)", tag, truncStr(fp.MsgID, 28)))
		case "antigravity":
			evidence = append(evidence, fmt.Sprintf("%s message id: %s -> msg_<UUID> (非原生)", tag, truncStr(fp.MsgID, 28)))
		case "vertex":
			scores["antigravity"] += 6
			evidence = append(evidence, fmt.Sprintf("%s message id: %s -> req_vrtx_ (Vertex AI)", tag, truncStr(fp.MsgID, 28)))
		case "rewritten":
			evidence = append(evidence, fmt.Sprintf("%s message id: %s -> 被改写", tag, truncStr(fp.MsgID, 28)))
		}

		// 4. model format
		switch fp.ModelSource {
		case "kiro":
			scores["bedrock"] += 8
			evidence = append(evidence, fmt.Sprintf("%s model: %s -> kiro-* (Kiro 逆向铁证)", tag, fp.Model))
		case "bedrock":
			scores["bedrock"] += 3
			evidence = append(evidence, fmt.Sprintf("%s model: %s -> anthropic.* (Bedrock)", tag, fp.Model))
		}

		// 5. service_tier / inference_geo
		if fp.HasServiceTier {
			scores["anthropic"] += 3
			evidence = append(evidence, fmt.Sprintf("%s service_tier: %s -> Anthropic 独有", tag, fp.ServiceTier))
		}
		if fp.HasInferenceGeo {
			scores["anthropic"] += 2
			evidence = append(evidence, fmt.Sprintf("%s inference_geo: %s -> Anthropic 独有", tag, fp.InferenceGeo))
		}
		if fp.HasCacheCreation {
			scores["anthropic"] += 1
			evidence = append(evidence, fmt.Sprintf("%s cache_creation: 嵌套对象 -> Anthropic 新格式", tag))
		}

		// 6. usage style
		if fp.UsageStyle == "camelCase" {
			scores["bedrock"] += 2
			evidence = append(evidence, fmt.Sprintf("%s usage: camelCase (Bedrock)", tag))
		}

		// 7. AWS headers
		if fp.HasAWSHeaders {
			scores["bedrock"] += 3
			evidence = append(evidence, fmt.Sprintf("%s AWS headers detected", tag))
		}

		// 8. Anthropic rate-limit headers
		if fp.HasAnthropicHdrs {
			scores["anthropic"] += 2
			evidence = append(evidence, fmt.Sprintf("%s Anthropic rate-limit headers detected", tag))
		}
	}

	// Second pass: tooluse_ attribution correction
	hasKiroModel := false
	for _, fp := range validFPs {
		if fp.ModelSource == "kiro" {
			hasKiroModel = true
			break
		}
	}

	if !hasKiroModel && scores["antigravity"] > 0 && scores["bedrock"] > 0 {
		toolusePoints := 0
		for _, fp := range validFPs {
			if fp.ToolIDSource == "bedrock" {
				toolusePoints += 5
			}
		}
		if scores["antigravity"] >= 4 {
			scores["antigravity"] += toolusePoints
			scores["bedrock"] -= toolusePoints
			evidence = append(evidence, fmt.Sprintf("[修正] tooluse_ 分数 %d 从 Bedrock 转移到 Antigravity", toolusePoints))
		}
	}

	if hasKiroModel {
		msgUUIDCount := 0
		for _, fp := range validFPs {
			if fp.MsgIDSource == "antigravity" {
				msgUUIDCount++
			}
		}
		if msgUUIDCount > 0 {
			evidence = append(evidence, fmt.Sprintf("[修正] msg_<UUID> x%d 归属 Kiro 中转改写 (非 Antigravity)", msgUUIDCount))
		}
	}

	// Third pass: missing field negative evidence
	var missingFlags []string
	hasThinkingProbe := false
	for _, fp := range validFPs {
		if fp.ProbeType == "thinking" {
			hasThinkingProbe = true
			break
		}
	}

	if scores["anthropic"] > 0 && scores["bedrock"] == 0 && scores["antigravity"] == 0 {
		anyInferenceGeo := false
		anyCacheObj := false
		for _, fp := range validFPs {
			if fp.HasInferenceGeo {
				anyInferenceGeo = true
			}
			if fp.HasCacheCreation {
				anyCacheObj = true
			}
		}

		if !anyInferenceGeo {
			missingFlags = append(missingFlags, "inference_geo")
			scores["anthropic"] -= 3
			evidence = append(evidence, "[缺失] inference_geo 未出现 (Anthropic 官方必有字段)")
		}
		if !anyCacheObj {
			missingFlags = append(missingFlags, "cache_creation_obj")
			scores["anthropic"] -= 2
			evidence = append(evidence, "[缺失] cache_creation 嵌套对象未出现")
		}

		if hasThinkingProbe {
			anyThinkingSig := false
			for _, fp := range validFPs {
				if fp.ProbeType == "thinking" && fp.ThinkingSigLen > 0 {
					anyThinkingSig = true
					break
				}
			}
			if !anyThinkingSig {
				missingFlags = append(missingFlags, "thinking_signature")
				scores["anthropic"] -= 3
				evidence = append(evidence, "[缺失] thinking signature 为空 (真 Anthropic thinking 轮应有 len 200+ 签名)")
			}
		}
	}

	// Ensure non-negative scores
	for k := range scores {
		if scores[k] < 0 {
			scores[k] = 0
		}
	}

	// Verdict
	total := scores["anthropic"] + scores["bedrock"] + scores["antigravity"]
	suspicious := false

	if total == 0 {
		if len(missingFlags) > 0 {
			result.Verdict = "anthropic"
			result.Confidence = 0.0
			suspicious = true
			evidence = append(evidence, "[!] 正面分数被缺失扣分抵消，高度可疑伪装 Anthropic")
		} else {
			result.Verdict = "unknown"
			result.Confidence = 0.0
			evidence = append(evidence, "未获取到有效指纹信号")
		}
	} else {
		winner := "anthropic"
		maxScore := scores["anthropic"]
		for _, k := range []string{"bedrock", "antigravity"} {
			if scores[k] > maxScore {
				maxScore = scores[k]
				winner = k
			}
		}
		result.Verdict = winner
		result.Confidence = math.Round(float64(maxScore)/float64(total)*100) / 100
		if winner == "anthropic" && len(missingFlags) >= 2 {
			suspicious = true
		}
	}

	if suspicious {
		result.Verdict = "suspicious"
		evidence = append(evidence, fmt.Sprintf(
			"[!!] 疑似伪装 Anthropic: %d 个必有字段缺失 (%s)",
			len(missingFlags), strings.Join(missingFlags, ", ")))
		evidence = append(evidence,
			"[!!] 中转站可能重写了 tool_id 前缀并注入 service_tier，但无法伪造 inference_geo 和 cache_creation 嵌套对象")
	}

	result.Evidence = evidence
	result.Fingerprints = fingerprints
	result.Scores = scores
	result.VerdictText = verdictTextMap[result.Verdict]
	if result.VerdictText == "" {
		result.VerdictText = result.Verdict
	}

	return result
}

// verifyRatelimitDynamic sends multiple simple requests and checks if
// ratelimit-input-remaining actually decrements (dynamic) or stays fixed (static).
// Returns a map with keys: "verdict" (dynamic/static/unavailable), "samples", "detail"
func verifyRatelimitDynamic(ctx context.Context, client *http.Client, baseURL, apiKey, model string, shots int) map[string]any {
	if shots <= 0 {
		shots = 4
	}

	type sample struct {
		Remaining int    `json:"remaining"`
		Reset     string `json:"reset"`
	}

	var samples []sample

	for i := 0; i < shots; i++ {
		if ctx.Err() != nil {
			break
		}
		fp := probeOnce(ctx, client, baseURL, apiKey, model, "simple")
		if fp.Error == "" && fp.RatelimitInputRemaining > 0 {
			samples = append(samples, sample{
				Remaining: fp.RatelimitInputRemaining,
				Reset:     fp.RatelimitInputReset,
			})
		}
		if i < shots-1 {
			time.Sleep(300 * time.Millisecond)
		}
	}

	result := map[string]any{
		"samples": samples,
	}

	if len(samples) < 2 {
		result["verdict"] = "unavailable"
		result["detail"] = "ratelimit header 不可用（样本不足）"
		return result
	}

	// Check if all remaining values are the same
	allSame := true
	for i := 1; i < len(samples); i++ {
		if samples[i].Remaining != samples[0].Remaining {
			allSame = false
			break
		}
	}

	// Check monotone decreasing
	monotoneDec := true
	for i := 0; i < len(samples)-1; i++ {
		if samples[i].Remaining < samples[i+1].Remaining {
			monotoneDec = false
			break
		}
	}

	totalDrop := samples[0].Remaining - samples[len(samples)-1].Remaining

	if allSame {
		result["verdict"] = "static"
		result["detail"] = fmt.Sprintf("remaining 固定为 %d，疑似伪造", samples[0].Remaining)
	} else if monotoneDec && totalDrop > 0 {
		result["verdict"] = "dynamic"
		result["detail"] = fmt.Sprintf("remaining 单调递减 %d → %d (drop=%d)，真实 ratelimit",
			samples[0].Remaining, samples[len(samples)-1].Remaining, totalDrop)
	} else {
		result["verdict"] = "dynamic"
		result["detail"] = fmt.Sprintf("remaining 有变化但非单调 (%d → %d)，可能真实",
			samples[0].Remaining, samples[len(samples)-1].Remaining)
	}

	return result
}

// FindWorkingModel tries multiple models to find one that works with the given API key.
// Excludes Opus to save quota. Returns the first working model or a default.
func FindWorkingModel(ctx context.Context, client *http.Client, baseURL, apiKey string) string {
	probeModels := []string{
		"claude-sonnet-4-5-20250929",
		"claude-haiku-4-5-20251001",
		"claude-3-5-sonnet-20241022",
		"claude-3-haiku-20240307",
	}

	for _, model := range probeModels {
		if ctx.Err() != nil {
			break
		}
		checkCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		if CheckModelAvailable(checkCtx, client, baseURL, apiKey, model) {
			cancel()
			return model
		}
		cancel()
	}

	return probeModels[0]
}

// FetchRemoteModels fetches available Claude models from a remote OpenAI-compatible /v1/models endpoint.
func FetchRemoteModels(baseURL, apiKey string, skipSSRFCheck bool) ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var client *http.Client
	if skipSSRFCheck {
		client = newUnsafeHTTPClient(15 * time.Second)
	} else {
		client = newSafeHTTPClient(15 * time.Second)
	}

	modelsURL := strings.TrimRight(baseURL, "/") + "/v1/models"
	req, err := http.NewRequestWithContext(ctx, "GET", modelsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := common.Unmarshal(bodyBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var claudeModels []string
	for _, m := range result.Data {
		if strings.Contains(strings.ToLower(m.ID), "claude") {
			claudeModels = append(claudeModels, m.ID)
		}
	}

	return claudeModels, nil
}

// DetectSingleModel runs detection for a single model with SSRF-safe HTTP client
func DetectSingleModel(baseURL, apiKey, model string, rounds int, skipSSRFCheck bool, verifyRatelimit bool) DetectResult {
	ctx, cancel := context.WithTimeout(context.Background(), singleDetectTimeout)
	defer cancel()

	var client *http.Client
	if skipSSRFCheck {
		client = newUnsafeHTTPClient(probeTimeout)
	} else {
		client = newSafeHTTPClient(probeTimeout)
	}

	var fingerprints []Fingerprint

	// Tool probes
	for i := 0; i < rounds; i++ {
		if ctx.Err() != nil {
			break
		}
		fp := probeOnce(ctx, client, baseURL, apiKey, model, "tool")
		fingerprints = append(fingerprints, fp)
		if i < rounds-1 {
			time.Sleep(300 * time.Millisecond)
		}
	}

	// Thinking probe
	if ctx.Err() == nil {
		fp := probeOnce(ctx, client, baseURL, apiKey, model, "thinking")
		fingerprints = append(fingerprints, fp)
	}

	result := analyze(fingerprints, model)

	// Optional: verify ratelimit dynamic behavior
	if verifyRatelimit && ctx.Err() == nil {
		result.RatelimitVerify = verifyRatelimitDynamic(ctx, client, baseURL, apiKey, model, 4)
		if v, ok := result.RatelimitVerify["verdict"].(string); ok {
			switch v {
			case "static":
				result.Evidence = append(result.Evidence,
					"[!!] ratelimit remaining 值固定不变，疑似伪造的 ratelimit header")
			case "dynamic":
				result.Evidence = append(result.Evidence,
					"[✓] ratelimit remaining 正常递减，真实 Anthropic ratelimit header")
			case "unavailable":
				result.Evidence = append(result.Evidence,
					"[i] ratelimit header 不可用，无法进行动态验证")
			}
		}
	}

	return result
}

// CheckModelAvailable quickly checks if a model is available
func CheckModelAvailable(ctx context.Context, client *http.Client, baseURL, apiKey, model string) bool {
	payload := map[string]any{
		"model":      model,
		"max_tokens": 5,
		"messages":   []map[string]any{{"role": "user", "content": "hi"}},
	}
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return false
	}

	reqURL := strings.TrimRight(baseURL, "/") + "/v1/messages"
	req, err := http.NewRequestWithContext(ctx, "POST", reqURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

// ScanMultipleModels scans multiple models to detect mixed channels
func ScanMultipleModels(baseURL, apiKey string, models []string, rounds int, skipSSRFCheck bool) ScanResult {
	if len(models) == 0 {
		models = DefaultScanModels
	}

	ctx, cancel := context.WithTimeout(context.Background(), multiScanTimeout)
	defer cancel()

	var client *http.Client
	if skipSSRFCheck {
		client = newUnsafeHTTPClient(probeTimeout)
	} else {
		client = newSafeHTTPClient(probeTimeout)
	}

	scan := ScanResult{
		BaseURL: baseURL,
		Summary: make(map[string]string),
	}

	for _, model := range models {
		if ctx.Err() != nil {
			break
		}

		availClient := client
		if skipSSRFCheck {
			availClient = newUnsafeHTTPClient(availCheckTimeout)
		} else {
			availClient = newSafeHTTPClient(availCheckTimeout)
		}

		if !CheckModelAvailable(ctx, availClient, baseURL, apiKey, model) {
			r := DetectResult{
				Model:       model,
				Verdict:     "unavailable",
				VerdictText: "不可用",
				Scores:      map[string]int{"anthropic": 0, "bedrock": 0, "antigravity": 0},
			}
			scan.ModelResults = append(scan.ModelResults, r)
			scan.Summary[model] = "unavailable"
			continue
		}

		// Use DetectSingleModel which creates its own context/client
		result := DetectSingleModel(baseURL, apiKey, model, rounds, skipSSRFCheck, false)
		scan.ModelResults = append(scan.ModelResults, result)
		scan.Summary[model] = result.Verdict

		if result.ProxyPlatform != "" && scan.ProxyPlatform == "" {
			scan.ProxyPlatform = result.ProxyPlatform
		}

		time.Sleep(500 * time.Millisecond)
	}

	// Check if mixed channel
	verdictSet := make(map[string]bool)
	for _, v := range scan.Summary {
		if v != "unavailable" {
			verdictSet[v] = true
		}
	}
	scan.IsMixed = len(verdictSet) > 1

	return scan
}

// ValidateProxyDetectURL validates the URL for proxy detection
func ValidateProxyDetectURL(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL format")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("only http/https URLs are allowed")
	}
	if parsed.Hostname() == "" {
		return fmt.Errorf("URL must have a hostname")
	}
	return nil
}

func truncStr(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
