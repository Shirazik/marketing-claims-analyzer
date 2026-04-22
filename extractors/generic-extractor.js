/**
 * Generic content extractor — heuristic-based extraction for any site.
 * Targets semantic HTML, isolates main content, cleans and truncates.
 */

const MAX_WORDS = 4000;

/**
 * Selectors likely to contain product/marketing content, in priority order.
 */
const CONTENT_SELECTORS = [
  '[data-product-description]',
  '[itemprop="description"]',
  'article',
  '[role="main"]',
  'main',
  '.product-description',
  '.product-details',
  '.product-info',
  '#product-description',
  '#description',
  '.description',
];

/**
 * Selectors to remove (nav, footer, scripts, etc.)
 */
const NOISE_SELECTORS = [
  'script', 'style', 'noscript', 'iframe',
  'nav', 'header', 'footer',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '.breadcrumb', '.breadcrumbs',
  '.sidebar', 'aside',
  '.cookie-banner', '.cookie-notice',
  '.modal', '.popup',
  '.social-share', '.share-buttons',
  '.related-products', '.recommended',
  '.reviews-section', '#reviews',
  '.footer', '.site-footer',
  '.header', '.site-header',
];

export function extract() {
  // Try to find a focused content area first
  let contentRoot = null;
  for (const selector of CONTENT_SELECTORS) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim().length > 50) {
      contentRoot = el;
      break;
    }
  }

  // Fall back to body
  if (!contentRoot) {
    contentRoot = document.body;
  }

  // Clone so we can mutate without affecting the page
  const clone = contentRoot.cloneNode(true);

  // Remove noise elements
  for (const selector of NOISE_SELECTORS) {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  }

  // Extract text content
  let text = extractTextFromNode(clone);

  // Get page title and meta description for extra context
  const title = document.title || '';
  const metaDesc = document.querySelector('meta[name="description"]')?.content || '';

  let result = '';
  if (title) result += `Page Title: ${title}\n`;
  if (metaDesc) result += `Meta Description: ${metaDesc}\n`;
  result += '\n' + text;

  return truncateToWords(result, MAX_WORDS);
}

/**
 * Recursively extract meaningful text from a DOM node.
 */
function extractTextFromNode(node) {
  const blocks = [];
  const blockTags = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'TR', 'BLOCKQUOTE', 'SECTION', 'ARTICLE',
    'DT', 'DD', 'FIGCAPTION',
  ]);

  function walk(el) {
    if (el.nodeType === Node.TEXT_NODE) {
      const text = el.textContent.trim();
      if (text) blocks.push(text);
      return;
    }

    if (el.nodeType !== Node.ELEMENT_NODE) return;

    // Skip hidden elements
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return;
    const style = el.style;
    if (style.display === 'none' || style.visibility === 'hidden') return;

    const isBlock = blockTags.has(el.tagName);

    for (const child of el.childNodes) {
      walk(child);
    }

    if (isBlock && blocks.length > 0) {
      blocks.push('\n');
    }
  }

  walk(el);

  return blocks
    .join(' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function truncateToWords(text, maxWords) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '\n\n[Content truncated]';
}
