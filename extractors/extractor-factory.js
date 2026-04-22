/**
 * Selects the best extractor based on the current page URL.
 * Falls back to generic if a site-specific extractor returns null.
 *
 * Note: This runs inside the content script context (in the page),
 * so we use dynamic imports relative to the extension root.
 */

import { extract as amazonExtract } from './amazon-extractor.js';
import { extract as shopifyExtract } from './shopify-extractor.js';
import { extract as genericExtract } from './generic-extractor.js';

/**
 * Detect if the current page is a Shopify store.
 */
function isShopify() {
  return !!(
    window.Shopify ||
    document.querySelector('meta[name="shopify-checkout-api-token"]') ||
    document.querySelector('link[href*="cdn.shopify.com"]') ||
    document.querySelector('script[src*="cdn.shopify.com"]')
  );
}

/**
 * Detect if the current page is Amazon.
 */
function isAmazon() {
  return /amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|com\.au|in|com\.br|nl|se|pl|com\.mx)/i.test(
    window.location.hostname
  );
}

/**
 * Run the best extractor for this page.
 * @returns {string} Extracted page content
 */
export function extractPageContent() {
  let content = null;

  if (isAmazon()) {
    content = amazonExtract();
  } else if (isShopify()) {
    content = shopifyExtract();
  }

  // Fall back to generic if site-specific returned null or too little
  if (!content || content.length < 30) {
    content = genericExtract();
  }

  return content;
}
