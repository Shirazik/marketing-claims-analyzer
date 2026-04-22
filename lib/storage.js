/**
 * Wrapper around chrome.storage.local for typed access.
 */

const KEYS = {
  OPENAI_API_KEY: 'openai_api_key',
  ANTHROPIC_API_KEY: 'anthropic_api_key',
  PROVIDER: 'analysis_provider',
  OPENAI_MODEL: 'openai_model',
  ANTHROPIC_MODEL: 'anthropic_model',
  RESULTS_CACHE: 'results_cache',
};

const DEFAULTS = {
  [KEYS.PROVIDER]: 'openai',
  [KEYS.OPENAI_MODEL]: 'gpt-4.1-nano',
  [KEYS.ANTHROPIC_MODEL]: 'claude-sonnet-4-6',
};

const PROVIDER_CONFIG = {
  openai: {
    key: KEYS.OPENAI_API_KEY,
    model: KEYS.OPENAI_MODEL,
  },
  anthropic: {
    key: KEYS.ANTHROPIC_API_KEY,
    model: KEYS.ANTHROPIC_MODEL,
  },
};

async function get(key) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? DEFAULTS[key] ?? null;
}

async function set(key, value) {
  return chrome.storage.local.set({ [key]: value });
}

async function remove(key) {
  return chrome.storage.local.remove(key);
}

function getProviderConfig(provider) {
  return PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.openai;
}

async function getApiKey(provider = null) {
  const activeProvider = provider || (await getProvider());
  return get(getProviderConfig(activeProvider).key);
}

async function setApiKey(key, provider = null) {
  const activeProvider = provider || (await getProvider());
  return set(getProviderConfig(activeProvider).key, key);
}

async function getProvider() {
  return get(KEYS.PROVIDER);
}

async function setProvider(provider) {
  return set(KEYS.PROVIDER, provider);
}

async function getModel(provider = null) {
  const activeProvider = provider || (await getProvider());
  return get(getProviderConfig(activeProvider).model);
}

async function setModel(model, provider = null) {
  const activeProvider = provider || (await getProvider());
  return set(getProviderConfig(activeProvider).model, model);
}

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

async function getCachedResult(url) {
  const cache = await get(KEYS.RESULTS_CACHE) || {};
  return cache[await getCacheKey(url)] || null;
}

async function setCachedResult(url, data, title) {
  const cache = await get(KEYS.RESULTS_CACHE) || {};
  cache[await getCacheKey(url)] = { data, title, timestamp: Date.now() };
  return set(KEYS.RESULTS_CACHE, cache);
}

async function getCacheKey(url) {
  const provider = await getProvider();
  const model = await getModel(provider);
  return `${provider}:${model}:${normalizeUrl(url)}`;
}

async function clearResultsCache() {
  return remove(KEYS.RESULTS_CACHE);
}

export {
  KEYS,
  DEFAULTS,
  get,
  set,
  remove,
  getApiKey,
  setApiKey,
  getProvider,
  setProvider,
  getModel,
  setModel,
  getCachedResult,
  setCachedResult,
  clearResultsCache,
};
