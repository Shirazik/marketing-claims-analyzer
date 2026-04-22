/**
 * Backend proxy provider — stub for future implementation.
 * Will route requests through a backend server instead of direct API calls.
 */

import { ApiRequestError } from '../lib/errors.js';

export class BackendProvider {
  constructor(backendUrl) {
    this.backendUrl = backendUrl;
  }

  async analyze(pageContent, options = {}) {
    // TODO: Implement backend proxy calls
    throw new ApiRequestError(
      'Backend provider is not yet implemented. Please use OpenAI or Claude.'
    );
  }

  async validateCredentials() {
    // TODO: Implement backend health check
    return false;
  }
}
