/**
 * Anthropic API provider — direct BYOK calls to the Claude API.
 */

import { SYSTEM_PROMPT, CLAIMS_JSON_SCHEMA, buildUserPrompt } from '../lib/prompt-builder.js';
import {
  ApiKeyInvalidError,
  RateLimitError,
  InsufficientQuotaError,
  ApiRequestError,
} from '../lib/errors.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicProvider {
  constructor(apiKey, model = 'claude-sonnet-4-6') {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Analyze page content and return structured claims.
   * @param {string} pageContent
   * @param {object} [options]
   * @returns {Promise<{page_summary: string, claims: Array}>}
   */
  async analyze(pageContent, options = {}) {
    const body = {
      model: this.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(pageContent, options),
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: CLAIMS_JSON_SCHEMA,
        },
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    let response;
    try {
      response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new ApiRequestError('Request timed out after 45s');
      throw new ApiRequestError(`Network error: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      await this._handleErrorResponse(response);
    }

    const data = await response.json();
    const content = data.content?.find(block => block.type === 'text')?.text;

    if (data.stop_reason === 'refusal') {
      throw new ApiRequestError('Claude refused this analysis request. Try a different page or model.');
    }

    if (data.stop_reason === 'max_tokens') {
      throw new ApiRequestError('Claude reached the output limit before finishing. Try again or select a larger model.');
    }

    if (!content) {
      throw new ApiRequestError('Empty response from Claude');
    }

    try {
      return JSON.parse(content);
    } catch {
      throw new ApiRequestError('Claude returned a response that could not be parsed as JSON.');
    }
  }

  /**
   * Validate that the API key works without incurring message-generation cost.
   * @returns {Promise<boolean>}
   */
  async validateCredentials() {
    try {
      const response = await fetch(ANTHROPIC_MODELS_URL, {
        headers: this._headers(),
      });
      if (response.status === 401) return false;
      return response.ok;
    } catch {
      return false;
    }
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }

  async _handleErrorResponse(response) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      throw new ApiRequestError(`Claude API returned status ${response.status}`);
    }

    const type = errorBody?.error?.type || '';
    const message = errorBody?.error?.message || '';

    if (response.status === 401 || type === 'authentication_error') {
      throw new ApiKeyInvalidError('Claude');
    }
    if (response.status === 403 || type === 'permission_error') {
      throw new InsufficientQuotaError('Claude');
    }
    if (response.status === 429 || type === 'rate_limit_error') {
      throw new RateLimitError('Claude');
    }
    if (response.status === 529 || type === 'overloaded_error') {
      throw new ApiRequestError('Claude is temporarily overloaded. Please wait a moment and try again.');
    }
    throw new ApiRequestError(message || `Claude API error (${response.status})`);
  }
}
