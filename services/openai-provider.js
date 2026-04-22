/**
 * OpenAI API provider — direct BYOK calls to the OpenAI API.
 */

import { buildPrompt } from '../lib/prompt-builder.js';
import {
  ApiKeyInvalidError,
  RateLimitError,
  InsufficientQuotaError,
  ApiRequestError,
} from '../lib/errors.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider {
  constructor(apiKey, model = 'gpt-4o-mini') {
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
    const { messages, responseFormat } = buildPrompt(pageContent, options);

    const isReasoningModel = /^o\d/.test(this.model);
    const body = {
      model: this.model,
      messages,
      response_format: responseFormat,
      ...(!isReasoningModel && { temperature: 0.2 }),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    let response;
    try {
      response = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
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
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new ApiRequestError('Empty response from OpenAI');
    }

    try {
      return JSON.parse(content);
    } catch (err) {
      throw new ApiRequestError(`Failed to parse model response: ${err.message}`);
    }
  }

  /**
   * Validate that the API key works by making a minimal API call.
   * @returns {Promise<boolean>}
   */
  async validateCredentials() {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (response.status === 401) return false;
      return response.ok;
    } catch {
      return false;
    }
  }

  async _handleErrorResponse(response) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      throw new ApiRequestError(`API returned status ${response.status}`);
    }

    const code = errorBody?.error?.code || '';
    const message = errorBody?.error?.message || '';

    if (response.status === 401 || code === 'invalid_api_key') {
      throw new ApiKeyInvalidError('OpenAI');
    }
    if (response.status === 429) {
      if (code === 'insufficient_quota') {
        throw new InsufficientQuotaError('OpenAI');
      }
      throw new RateLimitError('OpenAI');
    }
    throw new ApiRequestError(message || `API error (${response.status})`);
  }
}
