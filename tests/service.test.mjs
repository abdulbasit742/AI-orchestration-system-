import assert from 'node:assert/strict';
import test from 'node:test';
import { orchestrateRequest, publicError } from '../lib/orchestration/service.mjs';

test('returns validated route metadata with an explicit demo response', async () => {
  const result = await orchestrateRequest({ message: 'Plan a software launch deadline', preferredProvider: 'demo' }, {
    env: { ORCHESTRATOR_DEMO_MODE: 'true' },
    fetchImpl: async () => { throw new Error('demo must not fetch'); },
  });
  assert.equal(result.provider, 'demo');
  assert.equal(result.route.primaryAgent, 'project');
  assert.ok(result.route.agents.includes('software'));
  assert.match(result.requestId, /^[0-9a-f-]{36}$/);
});

test('rejects arbitrary provider IDs before execution', async () => {
  await assert.rejects(
    orchestrateRequest({ message: 'hello', preferredProvider: 'attacker-endpoint' }),
    /preferredProvider is invalid/,
  );
});

test('redacts unexpected internal errors', () => {
  assert.deepEqual(publicError(new Error('database-password=secret')), {
    status: 500,
    body: { error: { code: 'internal_error', message: 'The orchestration request could not be completed.' } },
  });
});
