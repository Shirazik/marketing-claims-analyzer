# Marketing Claims Analyzer

A Chrome extension that analyzes marketing claims on product pages using LLM-powered evaluation. It extracts page content, sends it to the selected provider, and classifies claims as supported, misleading, or unverified.

## Features

- Manifest V3 Chrome extension
- On-demand page extraction for Amazon, Shopify, and generic product pages
- BYOK provider support for OpenAI and Anthropic
- Structured claim verdicts with product context
- Local result caching by URL, provider, and model
- Options page for API keys, provider choice, and model selection
- API keys encrypted at rest using AES-GCM with a PBKDF2-derived key tied to the user's Google account

## Install Locally

1. Open `chrome://extensions` in Chrome.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project folder.
5. Open the extension settings page and add an API key.

## Development

This extension uses vanilla JavaScript and has no build step.

After changing background, content, or manifest files, reload the extension from `chrome://extensions`. Popup-only changes can usually be picked up by closing and reopening the popup.

## Project Structure

```text
background/   Service worker and extension orchestration
content/      Injected content script for extracting page text
extractors/   Reference extractor modules for supported site types
lib/          Shared prompt, storage, error utilities, and crypto
popup/        Extension popup UI
services/     OpenAI, Anthropic, and backend provider adapters
settings/     Options page UI
styles/       Shared CSS tokens and reset
icons/        Extension icons
```

## Permissions

- `activeTab` for user-triggered access to the active tab
- `storage` for local API key, settings, and result cache storage
- `scripting` for injecting the content script on demand
- `identity` for encrypting API keys at rest — the user's stable Google account ID is used as key material for AES-GCM encryption via PBKDF2; no account data is stored or transmitted
- Host permissions for OpenAI and Anthropic API endpoints

## API Key Security

API keys are encrypted before being written to `chrome.storage.local`. The encryption key is derived at runtime from the user's Google account ID (via `chrome.identity`) and is never stored on disk. A random salt and IV are generated per key, so ciphertext is unique even if the same key is saved twice.

If the user is not signed into Chrome, the extension falls back to deriving the key from the extension ID alone, which provides obfuscation rather than full encryption.

Existing plaintext keys from v1.3.0 and earlier are migrated to encrypted format automatically on first use after updating.

## Version

Current extension version: `1.4.0`
