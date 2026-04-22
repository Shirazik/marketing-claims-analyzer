/**
 * Shopify-specific content extractor.
 * Targets common Shopify theme DOM patterns.
 */

const MAX_WORDS = 4000;

const SELECTORS = {
  title: '.product__title, .product-single__title, h1.product-title, [data-product-title]',
  vendor: '.product__vendor, .product-single__vendor, [data-product-vendor]',
  description: '.product__description, .product-single__description, .product-description, [data-product-description], .rte',
  price: '.product__price, .product-single__price, [data-product-price]',
  metafields: '.product__metafields, [data-product-metafields]',
  badges: '.product__badge, .badge, .product-tag',
  tabs: '.product__tabs, .product-tabs, .tabs__content',
  accordion: '.product__accordion, .accordion__content',
};

export function extract() {
  const parts = [];

  // Title
  const title = document.querySelector(SELECTORS.title);
  if (title) parts.push(`Product: ${title.textContent.trim()}`);

  // Vendor/brand
  const vendor = document.querySelector(SELECTORS.vendor);
  if (vendor) parts.push(`Brand: ${vendor.textContent.trim()}`);

  // Badges (often contain claims like "organic", "best seller")
  const badges = document.querySelectorAll(SELECTORS.badges);
  if (badges.length) {
    const badgeTexts = Array.from(badges)
      .map(b => b.textContent.trim())
      .filter(Boolean);
    if (badgeTexts.length) {
      parts.push('Badges: ' + badgeTexts.join(', '));
    }
  }

  // Main description (richest source of marketing claims)
  const descriptions = document.querySelectorAll(SELECTORS.description);
  descriptions.forEach((desc, i) => {
    const text = desc.textContent.trim();
    if (text.length > 20) {
      parts.push(`Product Description${descriptions.length > 1 ? ` (${i + 1})` : ''}:\n${text}`);
    }
  });

  // Tabs content (ingredients, benefits, how-to-use, etc.)
  const tabs = document.querySelectorAll(SELECTORS.tabs);
  tabs.forEach(tab => {
    const text = tab.textContent.trim();
    if (text.length > 20) {
      parts.push('Additional Details:\n' + text);
    }
  });

  // Accordion content
  const accordions = document.querySelectorAll(SELECTORS.accordion);
  accordions.forEach(acc => {
    const text = acc.textContent.trim();
    if (text.length > 20) {
      parts.push('Details:\n' + text);
    }
  });

  // Metafields
  const metafields = document.querySelector(SELECTORS.metafields);
  if (metafields) {
    parts.push('Product Details:\n' + metafields.textContent.trim());
  }

  // Page meta
  const metaDesc = document.querySelector('meta[name="description"]')?.content;
  if (metaDesc) parts.push(`Meta Description: ${metaDesc}`);

  // Shopify JSON-LD structured data
  const jsonLd = document.querySelector('script[type="application/ld+json"]');
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd.textContent);
      if (data.description) {
        parts.push(`Structured Data Description: ${data.description}`);
      }
    } catch {
      // ignore parse errors
    }
  }

  const result = parts.join('\n\n');

  if (result.length < 30) {
    return null; // Trigger generic fallback
  }

  return truncateToWords(result, MAX_WORDS);
}

function truncateToWords(text, maxWords) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '\n\n[Content truncated]';
}
