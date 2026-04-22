/**
 * Amazon-specific content extractor.
 * Targets known Amazon DOM selectors for product content.
 */

const MAX_WORDS = 4000;

const SELECTORS = {
  title: '#productTitle',
  bullets: '#feature-bullets ul',
  description: '#productDescription',
  aplusContent: '#aplus, #aplus_feature_div, .aplus-v2',
  bookDescription: '#bookDescription_feature_div',
  techSpecs: '#productDetails_techSpec_section_1, #productDetails_detailBullets_sections1',
  byline: '#bylineInfo',
  importantInfo: '#important-information',
};

export function extract() {
  const parts = [];

  // Title
  const title = document.querySelector(SELECTORS.title);
  if (title) parts.push(`Product: ${title.textContent.trim()}`);

  // Brand/byline
  const byline = document.querySelector(SELECTORS.byline);
  if (byline) parts.push(`Brand: ${byline.textContent.trim()}`);

  // Bullet points (key marketing claims live here)
  const bullets = document.querySelector(SELECTORS.bullets);
  if (bullets) {
    const items = bullets.querySelectorAll('li');
    const bulletTexts = Array.from(items)
      .map(li => li.textContent.trim())
      .filter(Boolean);
    if (bulletTexts.length) {
      parts.push('Key Features:\n' + bulletTexts.map(b => `• ${b}`).join('\n'));
    }
  }

  // Product description
  const desc = document.querySelector(SELECTORS.description);
  if (desc) {
    parts.push('Product Description:\n' + desc.textContent.trim());
  }

  // Book description
  const bookDesc = document.querySelector(SELECTORS.bookDescription);
  if (bookDesc) {
    parts.push('Book Description:\n' + bookDesc.textContent.trim());
  }

  // A+ Content (brand story, enhanced marketing)
  const aplus = document.querySelector(SELECTORS.aplusContent);
  if (aplus) {
    const text = aplus.textContent.trim();
    if (text.length > 20) {
      parts.push('Enhanced Content:\n' + text);
    }
  }

  // Tech specs
  const techSpecs = document.querySelector(SELECTORS.techSpecs);
  if (techSpecs) {
    parts.push('Technical Details:\n' + techSpecs.textContent.trim());
  }

  // Important information (warnings, ingredients)
  const important = document.querySelector(SELECTORS.importantInfo);
  if (important) {
    parts.push('Important Information:\n' + important.textContent.trim());
  }

  // Page meta
  const metaDesc = document.querySelector('meta[name="description"]')?.content;
  if (metaDesc) parts.push(`Meta Description: ${metaDesc}`);

  const result = parts.join('\n\n');

  if (result.length < 30) {
    // Fallback: not enough Amazon-specific content found, return null to trigger generic
    return null;
  }

  return truncateToWords(result, MAX_WORDS);
}

function truncateToWords(text, maxWords) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '\n\n[Content truncated]';
}
