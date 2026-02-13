package service

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/types"
)

func TestResetStatusCode_NilError(t *testing.T) {
	// Should not panic when newApiErr is nil
	ResetStatusCode(nil, `{"400":"200"}`)
}

func TestResetStatusCode_EmptyMapping(t *testing.T) {
	err := types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, 400)
	ResetStatusCode(err, "")
	if err.StatusCode != 400 {
		t.Errorf("expected 400, got %d", err.StatusCode)
	}
	ResetStatusCode(err, "{}")
	if err.StatusCode != 400 {
		t.Errorf("expected 400, got %d", err.StatusCode)
	}
}

func TestResetStatusCode_StringValue(t *testing.T) {
	err := types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, 400)
	ResetStatusCode(err, `{"400":"429"}`)
	if err.StatusCode != 429 {
		t.Errorf("expected 429, got %d", err.StatusCode)
	}
}

func TestResetStatusCode_NumericValue(t *testing.T) {
	err := types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, 400)
	ResetStatusCode(err, `{"400":429}`)
	if err.StatusCode != 429 {
		t.Errorf("expected 429, got %d", err.StatusCode)
	}
}

func TestParseStatusCodeMappingValue_JsonNumber(t *testing.T) {
	// Simulate json.Number by using Decoder with UseNumber
	mapping := `{"400":429}`
	var m map[string]any
	dec := json.NewDecoder(strings.NewReader(mapping))
	dec.UseNumber()
	if decErr := dec.Decode(&m); decErr != nil {
		t.Fatalf("failed to decode: %v", decErr)
	}
	val := m["400"]
	result := parseStatusCodeMappingValue(val)
	if result != 429 {
		t.Errorf("expected 429 from json.Number, got %d", result)
	}
}

func TestResetStatusCode_OKNotRemapped(t *testing.T) {
	err := types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, 200)
	ResetStatusCode(err, `{"200":"500"}`)
	if err.StatusCode != 200 {
		t.Errorf("expected 200 (should not remap OK), got %d", err.StatusCode)
	}
}

func TestResetStatusCode_NoMatchingCode(t *testing.T) {
	err := types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, 500)
	ResetStatusCode(err, `{"400":"429"}`)
	if err.StatusCode != 500 {
		t.Errorf("expected 500 (no matching code), got %d", err.StatusCode)
	}
}
