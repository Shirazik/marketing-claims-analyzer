/**
 * Settings page controller.
 */

import {
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  getProvider,
  setProvider,
} from '../lib/storage.js';

const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    keyHeading: 'OpenAI API Key',
    keyPlaceholder: 'sk-...',
    keyLink: 'https://platform.openai.com/api-keys',
    keyLinkText: 'Get an OpenAI API key',
    keyDescription: 'Your key is stored locally and sent only to OpenAI.',
    modelDescription: 'Select the OpenAI model for analysis. GPT-4.1 Nano is the fastest and cheapest option.',
    models: [
      ['gpt-4.1-nano', 'GPT-4.1 Nano (Recommended - fastest, lowest cost)'],
      ['gpt-4o-mini', 'GPT-4o Mini'],
      ['gpt-4.1-mini', 'GPT-4.1 Mini'],
      ['gpt-4.1', 'GPT-4.1 (Higher quality)'],
      ['gpt-4o', 'GPT-4o'],
      ['o4-mini', 'o4-mini (Reasoning - most thorough, slower)'],
    ],
  },
  anthropic: {
    label: 'Claude',
    keyHeading: 'Claude API Key',
    keyPlaceholder: 'sk-ant-...',
    keyLink: 'https://console.anthropic.com/settings/keys',
    keyLinkText: 'Get a Claude API key',
    keyDescription: 'Your key is stored locally and sent only to Anthropic.',
    modelDescription: 'Select the Claude model for analysis. Sonnet 4.6 balances quality, speed, and cost.',
    models: [
      ['claude-sonnet-4-6', 'Claude Sonnet 4.6 (Recommended)'],
      ['claude-haiku-4-5', 'Claude Haiku 4.5 (Fastest)'],
      ['claude-opus-4-7', 'Claude Opus 4.7 (Highest quality)'],
    ],
  },
};

const providerSelect = document.getElementById('provider-select');
const apiKeyHeading = document.getElementById('api-key-heading');
const apiKeyDesc = document.getElementById('api-key-desc');
const apiKeyInput = document.getElementById('api-key-input');
const btnToggleKey = document.getElementById('btn-toggle-key');
const iconEye = document.getElementById('icon-eye');
const iconEyeOff = document.getElementById('icon-eye-off');
const keyStatus = document.getElementById('key-status');
const modelDesc = document.getElementById('model-desc');
const modelSelect = document.getElementById('model-select');
const btnSave = document.getElementById('btn-save');
const saveStatus = document.getElementById('save-status');

let selectedProvider = 'openai';

async function loadSettings() {
  const storedProvider = await getProvider();
  selectedProvider = PROVIDERS[storedProvider] ? storedProvider : 'openai';
  providerSelect.value = selectedProvider;
  await renderProviderSettings();
}

async function renderProviderSettings() {
  const config = PROVIDERS[selectedProvider] || PROVIDERS.openai;
  const apiKey = await getApiKey(selectedProvider);
  const model = await getModel(selectedProvider);

  apiKeyHeading.textContent = config.keyHeading;
  apiKeyInput.value = apiKey || '';
  apiKeyInput.placeholder = config.keyPlaceholder;
  apiKeyDesc.innerHTML = `${escapeHtml(config.keyDescription)} <a href="${config.keyLink}" target="_blank" rel="noopener">${escapeHtml(config.keyLinkText)}</a>`;
  modelDesc.textContent = config.modelDescription;

  modelSelect.innerHTML = '';
  config.models.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    modelSelect.appendChild(option);
  });
  modelSelect.value = model || config.models[0][0];

  showKeyStatus('', 'checking');
}

providerSelect.addEventListener('change', async () => {
  selectedProvider = providerSelect.value;
  await renderProviderSettings();
});

btnToggleKey.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  iconEye.classList.toggle('hidden', isPassword);
  iconEyeOff.classList.toggle('hidden', !isPassword);
});

btnSave.addEventListener('click', async () => {
  const provider = providerSelect.value;
  const providerLabel = PROVIDERS[provider].label;
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;

  if (!apiKey) {
    showKeyStatus(`Please enter a ${providerLabel} API key.`, 'invalid');
    return;
  }

  if (provider === 'openai' && !apiKey.startsWith('sk-')) {
    showKeyStatus('OpenAI API keys usually start with "sk-".', 'invalid');
    return;
  }

  if (provider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
    showKeyStatus('Claude API keys usually start with "sk-ant-".', 'invalid');
    return;
  }

  btnSave.disabled = true;
  btnSave.textContent = 'Saving...';
  showKeyStatus(`Validating ${providerLabel} API key...`, 'checking');

  await setProvider(provider);
  await setApiKey(apiKey, provider);
  await setModel(model, provider);

  try {
    const response = await chrome.runtime.sendMessage({ type: 'VALIDATE_API_KEY' });
    if (response.valid) {
      showKeyStatus(`${providerLabel} API key is valid.`, 'valid');
    } else {
      showKeyStatus(`${providerLabel} API key could not be validated. It has been saved but may not work.`, 'invalid');
    }
  } catch {
    showKeyStatus('Settings saved. Could not validate key right now.', 'checking');
  }

  btnSave.disabled = false;
  btnSave.textContent = 'Save Settings';

  saveStatus.textContent = 'Settings saved';
  saveStatus.classList.add('save-status--visible');
  setTimeout(() => {
    saveStatus.classList.remove('save-status--visible');
  }, 2500);
});

function showKeyStatus(message, type) {
  keyStatus.textContent = message;
  keyStatus.className = `key-status key-status--${type}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

loadSettings();
