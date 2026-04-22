/**
 * Service worker — orchestrator for the extension.
 * Receives messages from popup, triggers content extraction, runs analysis.
 */

import { analyze, validateCredentials } from '../services/analysis-service.js';
import { getApiKey, getProvider } from '../lib/storage.js';
import { RestrictedPageError, ExtractionError } from '../lib/errors.js';

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_PAGE') {
    handleAnalyzePage(message).then(sendResponse).catch(err => {
      sendResponse({ error: err.toJSON ? err.toJSON() : { message: err.message, code: 'UNKNOWN' } });
    });
    return true; // Keep the message channel open for async response
  }

  if (message.type === 'CHECK_API_KEY') {
    getProvider()
      .then(async provider => {
        const key = await getApiKey(provider);
        sendResponse({ hasKey: !!key, provider });
      })
      .catch(() => sendResponse({ hasKey: false }));
    return true;
  }

  if (message.type === 'VALIDATE_API_KEY') {
    validateCredentials().then(valid => {
      sendResponse({ valid });
    }).catch(err => {
      sendResponse({ valid: false, error: err.message });
    });
    return true;
  }
});

async function handleAnalyzePage(message) {
  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    throw new ExtractionError('No active tab found.');
  }

  // Check for restricted pages
  const url = tab.url || '';
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://') ||
    !url.startsWith('http')
  ) {
    throw new RestrictedPageError();
  }

  // Inject content script to extract page content
  let extractionResults;
  try {
    extractionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content-script.js'],
    });
  } catch (err) {
    throw new ExtractionError(`Cannot access this page: ${err.message}`);
  }

  const pageContent = extractionResults?.[0]?.result;

  if (!pageContent || pageContent.length < 20) {
    throw new ExtractionError('Could not extract meaningful content from this page.');
  }

  // Run analysis
  const result = await analyze(pageContent);

  return { success: true, data: result, url: tab.url, title: tab.title };
}
