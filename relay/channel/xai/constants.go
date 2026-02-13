package xai

var ModelList = []string{
	// grok-4
	"grok-4", "grok-4-0709",
	// grok-4 search
	"grok-4-search", "grok-4-0709-search",
	// grok-3
	"grok-3-beta", "grok-3-mini-beta",
	// grok-3 fast
	"grok-3-fast-beta", "grok-3-mini-fast-beta",
	// extend grok-3-mini reasoning
	"grok-3-mini-beta-high", "grok-3-mini-beta-low", "grok-3-mini-beta-medium",
	"grok-3-mini-fast-beta-high", "grok-3-mini-fast-beta-low", "grok-3-mini-fast-beta-medium",
	// grok-3 search
	"grok-3-beta-search", "grok-3-fast-beta-search",
	"grok-3-mini-beta-search", "grok-3-mini-fast-beta-search",
	// image model
	"grok-2-image",
	// video model
	"grok-imagine-video",
	// legacy models
	"grok-2", "grok-2-vision",
	"grok-beta", "grok-vision-beta",
}

var ChannelName = "xai"
