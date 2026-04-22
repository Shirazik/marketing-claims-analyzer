# Marketing Claims Analyzer

A Chrome extension that analyzes marketing claims on product pages using LLM-powered evaluation. It extracts page content, sends it to the selected provider, and classifies claims as supported, misleading, or unverified.

## Features

- Manifest V3 Chrome extension
- On-demand page extraction for Amazon, Shopify, and generic product pages
- BYOK provider support for OpenAI and Anthropic
- Structured claim verdicts with product context
- Local result caching by URL, provider, and model
- Options page for API keys, provider choice, and model selection

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
lib/          Shared prompt, storage, and error utilities
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
- Host permissions for OpenAI and Anthropic API endpoints

## Version

Current extension version: `1.3.0`
