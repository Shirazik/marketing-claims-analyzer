/**
 * Popup controller — manages UI states and communicates with the service worker.
 */

import { getCachedResult, setCachedResult } from '../lib/storage.js';

// ── DOM References ──
const states = {
  noKey: document.getElementById('state-no-key'),
  loading: document.getElementById('state-loading'),
  results: document.getElementById('state-results'),
  noClaims: document.getElementById('state-no-claims'),
  error: document.getElementById('state-error'),
};

const btnSettings = document.getElementById('btn-settings');
const btnAddKey = document.getElementById('btn-add-key');
const btnRetryNoClaims = document.getElementById('btn-retry-no-claims');
const btnRetryError = document.getElementById('btn-retry-error');
const errorMessage = document.getElementById('error-message');
const resultsHeader = document.getElementById('results-header');
const resultsSummary = document.getElementById('results-summary');
const productContextEl = document.getElementById('product-context');
const claimsList = document.getElementById('claims-list');

// ── State Management ──

function showState(stateName) {
  Object.entries(states).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== stateName);
  });
}

// ── Event Listeners ──

function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
}

btnSettings.addEventListener('click', openSettings);
btnAddKey.addEventListener('click', openSettings);

btnRetryNoClaims.addEventListener('click', runAnalysis);
btnRetryError.addEventListener('click', runAnalysis);

// ── Helpers ──

function normalizeUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
     'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'ref_'].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || null;
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Analysis Flow ──

async function runAnalysis() {
  showState('loading');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_PAGE' });

    if (response.error) {
      handleError(response.error);
      return;
    }

    if (!response.data || !response.data.claims || response.data.claims.length === 0) {
      const desc = document.getElementById('no-claims-desc');
      if (response.data?.page_summary) {
        desc.textContent = response.data.page_summary;
      } else {
        desc.textContent = "This page doesn't appear to contain marketing claims to analyze.";
      }
      showState('noClaims');
      return;
    }

    renderResults(response.data, response.title);
    showState('results');

    const url = normalizeUrl(response.url || await getActiveTabUrl());
    if (url) await setCachedResult(url, response.data, response.title);
  } catch (err) {
    handleError({ message: err.message, code: 'UNKNOWN' });
  }
}

function handleError(error) {
  if (error.code === 'API_KEY_MISSING') {
    showState('noKey');
    return;
  }

  errorMessage.textContent = error.message || 'An unexpected error occurred.';
  showState('error');
}

// ── Rendering ──

function renderResults(data, pageTitle, cachedTimestamp = null) {
  // Header
  resultsHeader.innerHTML = '';
  if (pageTitle) {
    const pageEl = document.createElement('p');
    pageEl.className = 'results-header__page';
    pageEl.title = pageTitle;
    pageEl.textContent = pageTitle;
    resultsHeader.appendChild(pageEl);
  }

  // Toolbar (cached indicator + rerun button)
  const toolbar = document.createElement('div');
  toolbar.className = 'results-header__toolbar';

  if (cachedTimestamp) {
    const cached = document.createElement('span');
    cached.className = 'results-header__cached';
    cached.textContent = `Cached ${formatTimeAgo(cachedTimestamp)}`;
    toolbar.appendChild(cached);
  } else {
    toolbar.appendChild(document.createElement('span'));
  }

  const rerunBtn = document.createElement('button');
  rerunBtn.className = 'btn-rerun';
  rerunBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 105.535 3.09.75.75 0 011.27-.79A8 8 0 118 0a.75.75 0 010 1.5z"/><path d="M14.75 1a.75.75 0 01.75.75v3.5a.75.75 0 01-.75.75h-3.5a.75.75 0 010-1.5h2.75V1.75a.75.75 0 01.75-.75z"/></svg> Rerun';
  rerunBtn.addEventListener('click', runAnalysis);
  toolbar.appendChild(rerunBtn);

  resultsHeader.appendChild(toolbar);

  // Summary badges
  const counts = { supported: 0, misleading: 0, unverified: 0 };
  data.claims.forEach(c => {
    if (counts[c.verdict] !== undefined) counts[c.verdict]++;
  });

  resultsSummary.innerHTML = '';
  for (const [verdict, count] of Object.entries(counts)) {
    if (count === 0) continue;
    const badge = document.createElement('span');
    badge.className = `summary-badge summary-badge--${verdict}`;
    badge.innerHTML = `${getVerdictIcon(verdict)} ${count} ${capitalize(verdict)}`;
    resultsSummary.appendChild(badge);
  }

  // Product context
  renderProductContext(data.product_context);

  // Claim cards
  claimsList.innerHTML = '';
  data.claims.forEach(claim => {
    claimsList.appendChild(createClaimCard(claim));
  });
}

function renderProductContext(ctx) {
  productContextEl.innerHTML = '';

  if (!ctx) {
    productContextEl.classList.add('hidden');
    return;
  }

  productContextEl.classList.remove('hidden');

  const heading = document.createElement('h3');
  heading.className = 'product-context__heading';
  heading.textContent = 'Product Understanding';
  productContextEl.appendChild(heading);

  const fields = [
    { label: 'Product', value: ctx.product_name },
    { label: 'Type', value: ctx.product_type },
    { label: 'Key Ingredients', value: ctx.key_ingredients },
    { label: 'Mechanism', value: ctx.claimed_mechanism },
  ];

  fields.forEach(({ label, value }) => {
    if (!value || value === 'N/A') return;
    const row = document.createElement('div');
    row.className = 'product-context__row';
    row.innerHTML = `<span class="product-context__label">${escapeHtml(label)}</span><span class="product-context__value">${escapeHtml(value)}</span>`;
    productContextEl.appendChild(row);
  });

  if (ctx.overall_impression) {
    const impression = document.createElement('p');
    impression.className = 'product-context__impression';
    impression.textContent = ctx.overall_impression;
    productContextEl.appendChild(impression);
  }
}

function createClaimCard(claim) {
  const card = document.createElement('div');
  card.className = 'claim-card';

  const reasoningHtml = claim.reasoning
    ? `<details class="claim-card__details">
        <summary class="claim-card__details-toggle">Detailed reasoning</summary>
        <p class="claim-card__reasoning">${escapeHtml(claim.reasoning)}</p>
      </details>`
    : '';

  card.innerHTML = `
    <div class="claim-card__header">
      <span class="claim-card__verdict claim-card__verdict--${claim.verdict}">
        ${getVerdictIcon(claim.verdict)}
        ${capitalize(claim.verdict)}
      </span>
      <span class="claim-card__category">${claim.category}</span>
    </div>
    <p class="claim-card__text">${escapeHtml(claim.claim_text)}</p>
    <p class="claim-card__explanation">${escapeHtml(claim.explanation)}</p>
    ${reasoningHtml}
  `;

  return card;
}

function getVerdictIcon(verdict) {
  const icons = {
    supported: '<svg class="verdict-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm3.03 4.97a.75.75 0 00-1.06 0L7 8.94 5.53 7.47a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l3.5-3.5a.75.75 0 000-1.06z"/></svg>',
    misleading: '<svg class="verdict-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm-.75 3.5v4.5a.75.75 0 001.5 0V4.5a.75.75 0 00-1.5 0zM8 11a1 1 0 100 2 1 1 0 000-2z"/></svg>',
    unverified: '<svg class="verdict-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm-.75 3.5v4.5a.75.75 0 001.5 0V4.5a.75.75 0 00-1.5 0zM8 11a1 1 0 100 2 1 1 0 000-2z"/></svg>',
  };
  return icons[verdict] || '';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Initialize ──

async function init() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_API_KEY' });
    if (!response.hasKey) {
      showState('noKey');
      return;
    }

    // Check cache before making an API call
    const url = normalizeUrl(await getActiveTabUrl());
    if (url) {
      const cached = await getCachedResult(url);
      if (cached && cached.data && Array.isArray(cached.data.claims)) {
        renderResults(cached.data, cached.title, cached.timestamp);
        showState('results');
        return;
      }
    }

    runAnalysis();
  } catch (err) {
    handleError({ message: err.message, code: 'UNKNOWN' });
  }
}

init().catch(err => handleError({ message: err.message || 'Failed to load', code: 'UNKNOWN' }));
