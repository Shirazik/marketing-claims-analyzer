/**
 * Custom error hierarchy for the extension.
 */

export class ExtensionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
  }

  toJSON() {
    return { name: this.name, message: this.message, code: this.code };
  }
}

export class ApiKeyMissingError extends ExtensionError {
  constructor(provider = 'selected AI provider') {
    super(`${provider} API key not configured. Please add your key in Settings.`, 'API_KEY_MISSING');
    this.name = 'ApiKeyMissingError';
  }
}

export class ApiKeyInvalidError extends ExtensionError {
  constructor(provider = 'selected AI provider') {
    super(`Your ${provider} API key is invalid. Please check it in Settings.`, 'API_KEY_INVALID');
    this.name = 'ApiKeyInvalidError';
  }
}

export class RateLimitError extends ExtensionError {
  constructor(provider = 'selected AI provider') {
    super(`${provider} rate limit reached. Please wait a moment and try again.`, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

export class InsufficientQuotaError extends ExtensionError {
  constructor(provider = 'selected AI provider') {
    super(`Your ${provider} account has insufficient quota or permission for this request. Please check your billing and model access.`, 'INSUFFICIENT_QUOTA');
    this.name = 'InsufficientQuotaError';
  }
}

export class ApiRequestError extends ExtensionError {
  constructor(message = 'Failed to communicate with the AI service.') {
    super(message, 'API_REQUEST_ERROR');
    this.name = 'ApiRequestError';
  }
}

export class ExtractionError extends ExtensionError {
  constructor(message = 'Failed to extract content from this page.') {
    super(message, 'EXTRACTION_ERROR');
    this.name = 'ExtractionError';
  }
}

export class RestrictedPageError extends ExtensionError {
  constructor() {
    super('Cannot analyze this page. Chrome internal pages are restricted.', 'RESTRICTED_PAGE');
    this.name = 'RestrictedPageError';
  }
}

/**
 * Reconstruct an error from a serialized JSON object (for message passing).
 */
export function fromJSON(obj) {
  const err = new ExtensionError(obj.message, obj.code);
  err.name = obj.name || 'ExtensionError';
  return err;
}
