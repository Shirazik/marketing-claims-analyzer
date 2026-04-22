# Marketing Claims Analyzer — Chrome Extension

## Overview

A Chrome extension (Manifest V3) that analyzes marketing claims on product pages using LLM-powered evaluation. Users bring their own OpenAI or Claude API key (BYOK). The extension extracts page content, sends it to the selected provider API with a structured prompt, and displays verdicts (supported, misleading, unverified) in the popup.

**Current version:** 1.3.0

## Architecture

```
popup (UI) → service-worker (orchestrator) → content-script (extraction) + selected LLM provider
```

### Request Flow

1. User clicks extension icon → `popup/popup.js` checks cache for current URL → if cached, renders instantly and stops
1a. If no cache hit → sends `ANALYZE_PAGE` message
2. `background/service-worker.js` receives message, gets active tab
3. Service worker injects `content/content-script.js` into the page via `chrome.scripting.executeScript()`
4. Content script detects site type (Amazon / Shopify / generic) and extracts text from the DOM
5. Extracted text returns to service worker → passed to `services/analysis-service.js`
6. Analysis service creates the selected provider (`OpenAIProvider` or `AnthropicProvider`), calls the API with the prompt from `lib/prompt-builder.js`
7. Provider returns structured JSON → flows back to popup for rendering → result cached per URL/provider/model

### Key Design Decisions

- **Content script is injected on-demand**, not declared in manifest. Uses IIFE pattern (no ES modules) because `executeScript` doesn't support module imports.
- **Extractors are duplicated** — `extractors/` directory has modular versions (amazon, shopify, generic) but `content/content-script.js` inlines all extraction logic because content scripts can't use ES module imports. The `extractors/` directory serves as the reference/source-of-truth versions.
- **Two-phase LLM prompt** (v1.1.0) — The prompt instructs the model to first build a `product_context` (product type, ingredients, mechanism) before evaluating claims. This exploits autoregressive generation to ground verdicts in product-specific knowledge.
- **Structured output** — Uses provider-specific JSON schema wrappers: OpenAI `response_format` and Claude `output_config.format`.
- **Result caching** — Successful analysis results are cached per normalized URL, provider, and model in `chrome.storage.local`. On popup open, cached results render instantly without an API call. A "Rerun" button lets users force a fresh analysis. Errors and "no claims" results are not cached.

## File Structure

```
├── manifest.json              # Manifest V3 config
├── background/
│   └── service-worker.js      # Orchestrator — message handling, tab access, injection
├── content/
│   └── content-script.js      # Injected into pages — extracts text (IIFE, no modules)
├── extractors/                # Reference extractor modules (not directly used at runtime)
│   ├── extractor-factory.js   # Site detection + fallback logic
│   ├── amazon-extractor.js    # Amazon-specific DOM selectors
│   ├── shopify-extractor.js   # Shopify-specific DOM selectors
│   └── generic-extractor.js   # Generic DOM walker with noise removal
├── lib/
│   ├── prompt-builder.js      # Provider-neutral system prompt + JSON schema
│   ├── storage.js             # chrome.storage.local wrapper (API key, model, provider, results cache)
│   └── errors.js              # Custom error hierarchy with serialization (toJSON/fromJSON)
├── services/
│   ├── analysis-service.js    # Provider factory — creates OpenAI, Claude, or Backend provider
│   ├── openai-provider.js     # Direct OpenAI API calls (BYOK)
│   ├── anthropic-provider.js  # Direct Claude API calls (BYOK)
│   └── backend-provider.js    # Stub for future backend proxy provider
├── popup/
│   ├── popup.html             # Extension popup markup
│   ├── popup.js               # Popup controller — state management, rendering, cache check, rerun
│   └── popup.css              # Popup styles
├── settings/
│   ├── settings.html          # Options page markup
│   ├── settings.js            # Settings controller — provider, API key, and model selection
│   └── settings.css           # Settings styles
├── styles/
│   └── shared.css             # Design tokens (CSS custom properties) and reset
└── icons/
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```

## LLM Output Schema (v1.1.0)

```json
{
  "product_context": {
    "product_name": "string",
    "product_type": "string",
    "key_ingredients": "string",
    "claimed_mechanism": "string",
    "overall_impression": "string"
  },
  "page_summary": "string",
  "claims": [
    {
      "claim_text": "string",
      "verdict": "supported | misleading | unverified",
      "explanation": "string (1 sentence, user-facing)",
      "reasoning": "string (2-3 sentences, detailed scientific/factual basis)",
      "category": "health | performance | environmental | safety | quality | value | scientific | testimonial | comparison | other"
    }
  ]
}
```

## Extractors

- **Amazon**: Targets `#productTitle`, `#feature-bullets`, `#productDescription`, `#aplus`, `#important-information`, tech specs
- **Shopify**: Detected via `window.Shopify` or CDN links. Pulls from `.product__description`, tabs, accordions, JSON-LD
- **Generic**: Finds main content area via semantic selectors, clones DOM, strips noise elements (nav, footer, sidebar, cookie banners, reviews), walks remaining tree
- All extractors truncate to **4,000 words** max

## Storage Keys

| Key | Default | Purpose |
|-----|---------|---------|
| `openai_api_key` | — | User's OpenAI API key |
| `anthropic_api_key` | — | User's Claude API key |
| `analysis_provider` | `"openai"` | Provider type (`openai`, `anthropic`, or future `backend`) |
| `openai_model` | `"gpt-4.1-nano"` | OpenAI model selection |
| `anthropic_model` | `"claude-sonnet-4-6"` | Claude model selection |
| `results_cache` | `{}` | Per-normalized-URL/provider/model cache of analysis results (`{ cacheKey: { data, title, timestamp } }`) |

## Available Models (Settings Page)

OpenAI:
- `gpt-4.1-nano` (default, recommended)
- `gpt-4o-mini`
- `gpt-4o`
- `gpt-4.1-mini`
- `gpt-4.1`
- `o4-mini`

Claude:
- `claude-sonnet-4-6` (default, recommended)
- `claude-haiku-4-5`
- `claude-opus-4-7`

## Error Handling

Custom error hierarchy in `lib/errors.js`. All errors serialize via `toJSON()` for message passing between service worker and popup:

- `ApiKeyMissingError` → shows "no key" state
- `ApiKeyInvalidError` → 401/authentication error from selected provider
- `RateLimitError` → 429/rate limit from selected provider
- `InsufficientQuotaError` → 429 with `insufficient_quota` code
- `ExtractionError` → content script injection or extraction failed
- `RestrictedPageError` → chrome://, about:, edge:// pages

## Development

- No build step — vanilla JS with ES modules (except content script which uses IIFE)
- Load as unpacked extension: `chrome://extensions` → Developer mode → Load unpacked → select project root
- After code changes: click reload button on the extension card in `chrome://extensions`
- Popup-only changes (HTML/CSS/JS) can be picked up by closing and reopening the popup

## Permissions

- `activeTab` — access to current tab content when user clicks extension
- `storage` — persist API key and settings locally
- `scripting` — inject content script on demand
- `host_permissions: https://api.openai.com/*` — direct OpenAI API calls from service worker
- `host_permissions: https://api.anthropic.com/*` — direct Claude API calls from service worker
