/**
 * Analysis service factory — abstracts the provider layer.
 * Reads provider type from storage and instantiates the correct provider.
 */

import { getApiKey, getProvider, getModel } from '../lib/storage.js';
import { ApiKeyMissingError } from '../lib/errors.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { BackendProvider } from './backend-provider.js';

/**
 * Create the appropriate analysis provider based on stored settings.
 * @returns {Promise<OpenAIProvider | AnthropicProvider | BackendProvider>}
 */
async function createProvider() {
  const providerType = await getProvider();

  if (providerType === 'backend') {
    return new BackendProvider('https://api.example.com'); // placeholder
  }

  const apiKey = await getApiKey(providerType);
  if (!apiKey) {
    throw new ApiKeyMissingError(getProviderLabel(providerType));
  }

  const model = await getModel(providerType);
  if (providerType === 'anthropic') {
    return new AnthropicProvider(apiKey, model);
  }

  return new OpenAIProvider(apiKey, model);
}

function getProviderLabel(providerType) {
  return providerType === 'anthropic' ? 'Claude' : 'OpenAI';
}

/**
 * Run a full analysis on the given page content.
 * @param {string} pageContent
 * @param {object} [options]
 * @returns {Promise<{page_summary: string, claims: Array}>}
 */
export async function analyze(pageContent, options = {}) {
  const provider = await createProvider();
  return provider.analyze(pageContent, options);
}

/**
 * Validate the current provider credentials.
 * @returns {Promise<boolean>}
 */
export async function validateCredentials() {
  const provider = await createProvider();
  return provider.validateCredentials();
}
