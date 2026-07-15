const DEFAULT_ORDER = ['ollama', 'anthropic', 'openai', 'groq', 'together', 'gemini', 'demo'];
const PROVIDER_LABELS = Object.freeze({
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  groq: 'Groq',
  together: 'Together AI',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
  demo: 'Explicit demo mode',
});

export class GatewayError extends Error {
  constructor(message, { code = 'gateway_error', status = 502, retryable = false, attempts = [] } = {}) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.attempts = attempts;
  }
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function requireModel(env, key) {
  return typeof env[key] === 'string' && env[key].trim().length > 0;
}

export function configuredProviders(env = process.env) {
  const configured = [];
  if (env.ANTHROPIC_API_KEY && requireModel(env, 'ANTHROPIC_MODEL')) configured.push('anthropic');
  if (env.OPENAI_API_KEY && requireModel(env, 'OPENAI_MODEL')) configured.push('openai');
  if (env.GROQ_API_KEY && requireModel(env, 'GROQ_MODEL')) configured.push('groq');
  if (env.TOGETHER_API_KEY && requireModel(env, 'TOGETHER_MODEL')) configured.push('together');
  if (env.GEMINI_API_KEY && requireModel(env, 'GEMINI_MODEL')) configured.push('gemini');
  if (env.OLLAMA_ENABLED === 'true' && requireModel(env, 'OLLAMA_MODEL')) configured.push('ollama');
  if (env.ORCHESTRATOR_DEMO_MODE === 'true') configured.push('demo');
  return configured;
}

export function publicProviderStatus(env = process.env) {
  const active = new Set(configuredProviders(env));
  return Object.entries(PROVIDER_LABELS).map(([id, label]) => ({ id, label, configured: active.has(id) }));
}

function providerOrder(preferred, env, configured) {
  const configuredSet = new Set(configured);
  const requestedOrder = String(env.ORCHESTRATOR_PROVIDER_ORDER || '')
    .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  const order = requestedOrder.length ? requestedOrder : DEFAULT_ORDER;
  const candidates = preferred && preferred !== 'auto' ? [preferred, ...order] : order;
  return [...new Set(candidates)].filter((id) => configuredSet.has(id));
}

function ollamaEndpoint(env) {
  const value = String(env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new GatewayError('OLLAMA_BASE_URL is invalid', { code: 'invalid_configuration', status: 500 });
  }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new GatewayError('OLLAMA_BASE_URL must use a loopback HTTP address', { code: 'invalid_configuration', status: 500 });
  }
  return `${url.origin}/api/chat`;
}

async function requestJson(url, options, { fetchImpl, timeoutMs, signal }) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(new Error('provider timeout')), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const text = await response.text();
    if (text.length > 1_000_000) {
      throw new GatewayError('Provider response exceeded the size limit', { code: 'response_too_large' });
    }
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new GatewayError('Provider returned invalid JSON', { code: 'invalid_provider_response' });
    }
    if (!response.ok) {
      throw new GatewayError(`Provider request failed with status ${response.status}`, {
        code: response.status === 429 ? 'provider_rate_limited' : 'provider_http_error',
        status: response.status === 429 ? 503 : 502,
        retryable: response.status === 429 || response.status >= 500,
      });
    }
    return data;
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (controller.signal.aborted) {
      throw new GatewayError('Provider request timed out or was cancelled', { code: 'provider_timeout', status: 504, retryable: true });
    }
    throw new GatewayError('Provider request failed', { code: 'provider_network_error', retryable: true });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

function extractText(provider, data) {
  const text = provider === 'anthropic'
    ? data?.content?.[0]?.text
    : provider === 'gemini'
      ? data?.candidates?.[0]?.content?.parts?.[0]?.text
      : provider === 'ollama'
        ? data?.message?.content ?? data?.response
        : data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new GatewayError('Provider response did not contain usable text', { code: 'invalid_provider_response' });
  }
  return text.trim().slice(0, 20000);
}

async function invokeProvider(provider, request, context) {
  const { env, fetchImpl, timeoutMs, signal } = context;
  if (provider === 'demo') {
    return `[Demo mode] Routed to ${request.agentName}. Configure a server-side provider in .env.local for a model-generated response.`;
  }

  let url;
  let headers = { 'Content-Type': 'application/json' };
  let body;
  if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = { ...headers, 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' };
    body = {
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1200,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.message }],
    };
  } else if (['openai', 'groq', 'together'].includes(provider)) {
    const mapping = {
      openai: ['https://api.openai.com/v1/chat/completions', 'OPENAI_API_KEY', 'OPENAI_MODEL'],
      groq: ['https://api.groq.com/openai/v1/chat/completions', 'GROQ_API_KEY', 'GROQ_MODEL'],
      together: ['https://api.together.xyz/v1/chat/completions', 'TOGETHER_API_KEY', 'TOGETHER_MODEL'],
    }[provider];
    url = mapping[0];
    headers = { ...headers, Authorization: `Bearer ${env[mapping[1]]}` };
    body = {
      model: env[mapping[2]],
      max_tokens: 1200,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.message },
      ],
    };
  } else if (provider === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`;
    headers = { ...headers, 'x-goog-api-key': env.GEMINI_API_KEY };
    body = { contents: [{ parts: [{ text: `${request.systemPrompt}\n\nUser request:\n${request.message}` }] }] };
  } else if (provider === 'ollama') {
    url = ollamaEndpoint(env);
    body = {
      model: env.OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.message },
      ],
    };
  } else {
    throw new GatewayError('Unknown provider', { code: 'invalid_provider', status: 400 });
  }

  const data = await requestJson(
    url,
    { method: 'POST', headers, body: JSON.stringify(body) },
    { fetchImpl, timeoutMs, signal },
  );
  return extractText(provider, data);
}

export async function executeWithFallback(request, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new GatewayError('fetch is unavailable', { code: 'runtime_error', status: 500 });
  }
  const configured = configuredProviders(env);
  const order = providerOrder(request.preferredProvider, env, configured);
  if (!order.length) {
    throw new GatewayError('No server-side model provider is configured', { code: 'provider_unavailable', status: 503 });
  }
  const timeoutMs = boundedInteger(env.ORCHESTRATOR_TIMEOUT_MS, 25000, 1000, 60000);
  const maxAttempts = boundedInteger(env.ORCHESTRATOR_MAX_PROVIDER_ATTEMPTS, 3, 1, 5);
  const attempts = [];

  for (const provider of order.slice(0, maxAttempts)) {
    try {
      const text = await invokeProvider(provider, request, { env, fetchImpl, timeoutMs, signal });
      return { provider, text, attempts };
    } catch (error) {
      const normalized = error instanceof GatewayError ? error : new GatewayError('Provider failed');
      attempts.push({ provider, code: normalized.code });
      if (signal?.aborted) throw normalized;
    }
  }
  throw new GatewayError('All configured providers failed', {
    code: 'all_providers_failed',
    status: 502,
    attempts,
  });
}
