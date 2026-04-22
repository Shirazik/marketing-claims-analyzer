/**
 * Content script — injected on-demand via chrome.scripting.executeScript().
 * Extracts page content using the best available extractor and returns it.
 *
 * Because this is injected via executeScript, we can't use ES module imports.
 * Instead, the extraction logic is inlined here and the factory pattern is
 * replicated directly.
 */

(function () {
  'use strict';

  const MAX_WORDS = 4000;

  // ── Utilities ──

  function truncateToWords(text, maxWords) {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '\n\n[Content truncated]';
  }

  // ── Amazon Extractor ──

  function extractAmazon() {
    const parts = [];

    const title = document.querySelector('#productTitle');
    if (title) parts.push(`Product: ${title.textContent.trim()}`);

    const byline = document.querySelector('#bylineInfo');
    if (byline) parts.push(`Brand: ${byline.textContent.trim()}`);

    const bullets = document.querySelector('#feature-bullets ul');
    if (bullets) {
      const items = Array.from(bullets.querySelectorAll('li'))
        .map(li => li.textContent.trim())
        .filter(Boolean);
      if (items.length) parts.push('Key Features:\n' + items.map(b => `• ${b}`).join('\n'));
    }

    const desc = document.querySelector('#productDescription');
    if (desc) parts.push('Product Description:\n' + desc.textContent.trim());

    const bookDesc = document.querySelector('#bookDescription_feature_div');
    if (bookDesc) parts.push('Book Description:\n' + bookDesc.textContent.trim());

    const aplus = document.querySelector('#aplus, #aplus_feature_div, .aplus-v2');
    if (aplus) {
      const text = aplus.textContent.trim();
      if (text.length > 20) parts.push('Enhanced Content:\n' + text);
    }

    const techSpecs = document.querySelector(
      '#productDetails_techSpec_section_1, #productDetails_detailBullets_sections1'
    );
    if (techSpecs) parts.push('Technical Details:\n' + techSpecs.textContent.trim());

    const important = document.querySelector('#important-information');
    if (important) parts.push('Important Information:\n' + important.textContent.trim());

    const metaDesc = document.querySelector('meta[name="description"]')?.content;
    if (metaDesc) parts.push(`Meta Description: ${metaDesc}`);

    const result = parts.join('\n\n');
    return result.length >= 30 ? truncateToWords(result, MAX_WORDS) : null;
  }

  // ── Shopify Extractor ──

  function extractShopify() {
    const parts = [];

    const title = document.querySelector(
      '.product__title, .product-single__title, h1.product-title, [data-product-title]'
    );
    if (title) parts.push(`Product: ${title.textContent.trim()}`);

    const vendor = document.querySelector(
      '.product__vendor, .product-single__vendor, [data-product-vendor]'
    );
    if (vendor) parts.push(`Brand: ${vendor.textContent.trim()}`);

    const badges = document.querySelectorAll('.product__badge, .badge, .product-tag');
    if (badges.length) {
      const texts = Array.from(badges).map(b => b.textContent.trim()).filter(Boolean);
      if (texts.length) parts.push('Badges: ' + texts.join(', '));
    }

    document
      .querySelectorAll(
        '.product__description, .product-single__description, .product-description, [data-product-description], .rte'
      )
      .forEach((desc, i) => {
        const text = desc.textContent.trim();
        if (text.length > 20) parts.push(`Product Description:\n${text}`);
      });

    document.querySelectorAll('.product__tabs, .product-tabs, .tabs__content').forEach(tab => {
      const text = tab.textContent.trim();
      if (text.length > 20) parts.push('Additional Details:\n' + text);
    });

    document
      .querySelectorAll('.product__accordion, .accordion__content')
      .forEach(acc => {
        const text = acc.textContent.trim();
        if (text.length > 20) parts.push('Details:\n' + text);
      });

    const metaDesc = document.querySelector('meta[name="description"]')?.content;
    if (metaDesc) parts.push(`Meta Description: ${metaDesc}`);

    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent);
        if (data.description) parts.push(`Structured Data Description: ${data.description}`);
      } catch {}
    }

    const result = parts.join('\n\n');
    return result.length >= 30 ? truncateToWords(result, MAX_WORDS) : null;
  }

  // ── Generic Extractor ──

  function extractGeneric() {
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

    let contentRoot = null;
    for (const selector of CONTENT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 50) {
        contentRoot = el;
        break;
      }
    }
    if (!contentRoot) contentRoot = document.body;

    const clone = contentRoot.cloneNode(true);
    for (const selector of NOISE_SELECTORS) {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    }

    const blockTags = new Set([
      'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'LI', 'TR', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'DT', 'DD', 'FIGCAPTION',
    ]);

    const blocks = [];
    function walk(el) {
      if (el.nodeType === Node.TEXT_NODE) {
        const t = el.textContent.trim();
        if (t) blocks.push(t);
        return;
      }
      if (el.nodeType !== Node.ELEMENT_NODE) return;
      if (el.hidden || el.getAttribute('aria-hidden') === 'true') return;
      if (el.style.display === 'none' || el.style.visibility === 'hidden') return;

      for (const child of el.childNodes) walk(child);
      if (blockTags.has(el.tagName) && blocks.length > 0) blocks.push('\n');
    }
    walk(clone);

    const text = blocks
      .join(' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ {2,}/g, ' ')
      .trim();

    const title = document.title || '';
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
    let result = '';
    if (title) result += `Page Title: ${title}\n`;
    if (metaDesc) result += `Meta Description: ${metaDesc}\n`;
    result += '\n' + text;

    return truncateToWords(result, MAX_WORDS);
  }

  // ── Factory ──

  function isAmazon() {
    return /amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|com\.au|in|com\.br|nl|se|pl|com\.mx)/i.test(
      location.hostname
    );
  }

  function isShopify() {
    return !!(
      window.Shopify ||
      document.querySelector('meta[name="shopify-checkout-api-token"]') ||
      document.querySelector('link[href*="cdn.shopify.com"]') ||
      document.querySelector('script[src*="cdn.shopify.com"]')
    );
  }

  // Run extraction
  let content = null;

  if (isAmazon()) {
    content = extractAmazon();
  } else if (isShopify()) {
    content = extractShopify();
  }

  if (!content || content.length < 30) {
    content = extractGeneric();
  }

  // Return the result — executeScript captures the last expression
  return content;
})();
