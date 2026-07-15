import assert from 'node:assert/strict';
import test from 'node:test';
import { configuredProviders, executeWithFallback, GatewayError, publicProviderStatus } from '../lib/orchestration/gateway.mjs';

const request = {
  message: 'Draft a launch checklist',
  systemPrompt: 'You are a project manager.',
  agentName: 'Project Management',
  preferredProvider: 'auto',
};

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

test('requires both provider key and explicit model', () => {
  assert.deepEqual(configuredProviders({ OPENAI_API_KEY: 'secret' }), []);
  assert.deepEqual(configuredProviders({ OPENAI_API_KEY: 'secret', OPENAI_MODEL: 'model' }), ['openai']);
});

test('public status never returns credentials or models', () => {
  const status = publicProviderStatus({ OPENAI_API_KEY: 'super-secret', OPENAI_MODEL: 'private-model' });
  assert.equal(status.find((provider) => provider.id === 'openai').configured, true);
  assert.equal(JSON.stringify(status).includes('super-secret'), false);
  assert.equal(JSON.stringify(status).includes('private-model'), false);
});

test('sends OpenAI credentials only in a server-side authorization header', async () => {
  let captured;
  const result = await executeWithFallback({ ...request, preferredProvider: 'openai' }, {
    env: { OPENAI_API_KEY: 'server-key', OPENAI_MODEL: 'approved-model', ORCHESTRATOR_MAX_PROVIDER_ATTEMPTS: '1' },
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return jsonResponse(200, { choices: [{ message: { content: 'Safe response' } }] });
    },
  });
  assert.equal(result.text, 'Safe response');
  assert.equal(captured.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(captured.options.headers.Authorization, 'Bearer server-key');
  assert.equal(JSON.parse(captured.options.body).model, 'approved-model');
});

test('falls back to explicitly enabled demo mode after a retryable provider failure', async () => {
  const result = await executeWithFallback({ ...request, preferredProvider: 'openai' }, {
    env: {
      OPENAI_API_KEY: 'key', OPENAI_MODEL: 'model', ORCHESTRATOR_DEMO_MODE: 'true',
      ORCHESTRATOR_PROVIDER_ORDER: 'openai,demo', ORCHESTRATOR_MAX_PROVIDER_ATTEMPTS: '2',
    },
    fetchImpl: async () => jsonResponse(500, { error: 'unavailable' }),
  });
  assert.equal(result.provider, 'demo');
  assert.match(result.text, /^\[Demo mode\]/);
  assert.deepEqual(result.attempts, [{ provider: 'openai', code: 'provider_http_error' }]);
});

test('enforces the provider attempt cap', async () => {
  await assert.rejects(
    executeWithFallback(request, {
      env: {
        OPENAI_API_KEY: 'key', OPENAI_MODEL: 'model', GROQ_API_KEY: 'key', GROQ_MODEL: 'model',
        ORCHESTRATOR_PROVIDER_ORDER: 'openai,groq', ORCHESTRATOR_MAX_PROVIDER_ATTEMPTS: '1',
      },
      fetchImpl: async () => jsonResponse(500, {}),
    }),
    (error) => error instanceof GatewayError && error.attempts.length === 1,
  );
});

test('rejects remote Ollama endpoints to prevent SSRF', async () => {
  await assert.rejects(
    executeWithFallback({ ...request, preferredProvider: 'ollama' }, {
      env: { OLLAMA_ENABLED: 'true', OLLAMA_MODEL: 'model', OLLAMA_BASE_URL: 'http://example.com:11434', ORCHESTRATOR_MAX_PROVIDER_ATTEMPTS: '1' },
      fetchImpl: async () => { throw new Error('must not be called'); },
    }),
    (error) => error instanceof GatewayError && error.code === 'all_providers_failed',
  );
});

test('fails closed when no provider is configured', async () => {
  await assert.rejects(
    executeWithFallback(request, { env: {}, fetchImpl: async () => jsonResponse(200, {}) }),
    (error) => error instanceof GatewayError && error.code === 'provider_unavailable' && error.status === 503,
  );
});
