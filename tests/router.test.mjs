import assert from 'node:assert/strict';
import test from 'node:test';
import { routeMessage, validateMessage, validateRoutingDecision } from '../lib/orchestration/router.mjs';

test('routes marketing and social work deterministically', () => {
  const route = routeMessage('Create a social media marketing campaign for Instagram engagement');
  assert.deepEqual(route.agents.slice(0, 2), ['social', 'marketing']);
  assert.equal(route.primaryAgent, 'social');
});

test('uses project management as the explicit fallback', () => {
  const route = routeMessage('Help me organize this work');
  assert.deepEqual(route.agents, ['project']);
  assert.deepEqual(route.reasonCodes, ['fallback:project']);
});

test('detects high priority without delegating to a model', () => {
  assert.equal(routeMessage('Urgent: fix this API bug today').priority, 'high');
});

test('caps routes at three known agents', () => {
  const route = routeMessage('Plan software data analytics marketing sales finance and social work');
  assert.equal(route.agents.length, 3);
  assert.equal(new Set(route.agents).size, 3);
});

test('rejects empty and oversized messages', () => {
  assert.throws(() => validateMessage('   '), /required/);
  assert.throws(() => validateMessage('x'.repeat(4001)), /4000/);
});

test('rejects model-shaped routing output with unknown agents', () => {
  assert.throws(() => validateRoutingDecision({ agents: ['root-shell'], complexity: 'simple', priority: 'low' }), /known agent/);
});
