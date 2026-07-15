export const MAX_MESSAGE_LENGTH = 4000;

export const AGENTS = Object.freeze([
  { id: 'marketing', name: 'Marketing', expertise: ['marketing', 'campaign', 'seo', 'brand', 'audience'] },
  { id: 'ecommerce', name: 'E-Commerce', expertise: ['ecommerce', 'store', 'product', 'checkout', 'marketplace'] },
  { id: 'software', name: 'Software Development', expertise: ['code', 'software', 'api', 'bug', 'database', 'deploy'] },
  { id: 'content', name: 'Content', expertise: ['write', 'article', 'blog', 'caption', 'script', 'copy'] },
  { id: 'data', name: 'Data Analytics', expertise: ['analytics', 'data', 'metric', 'report', 'dashboard', 'trend'] },
  { id: 'sales', name: 'Sales', expertise: ['sales', 'lead', 'conversion', 'pipeline', 'prospect'] },
  { id: 'customer', name: 'Customer Service', expertise: ['support', 'customer', 'ticket', 'complaint', 'refund'] },
  { id: 'finance', name: 'Finance', expertise: ['budget', 'finance', 'invoice', 'cashflow', 'cost', 'revenue'] },
  { id: 'hr', name: 'Human Resources', expertise: ['hiring', 'recruitment', 'training', 'employee', 'policy'] },
  { id: 'design', name: 'Design', expertise: ['design', 'logo', 'visual', 'ui', 'ux', 'creative'] },
  { id: 'project', name: 'Project Management', expertise: ['project', 'plan', 'milestone', 'deadline', 'risk', 'roadmap'] },
  { id: 'social', name: 'Social Media', expertise: ['social', 'instagram', 'linkedin', 'facebook', 'tiktok', 'engagement'] },
]);

const AGENT_IDS = new Set(AGENTS.map((agent) => agent.id));
const URGENT_WORDS = new Set(['urgent', 'asap', 'immediately', 'emergency', 'today']);
const LOW_PRIORITY_WORDS = new Set(['idea', 'brainstorm', 'someday', 'optional', 'explore']);

function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function tokenize(value) {
  return normalizeText(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function validateMessage(value) {
  const message = normalizeText(value);
  if (!message) throw new TypeError('message is required');
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new RangeError(`message must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
  }
  return message;
}

export function validateRoutingDecision(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('routing decision must be an object');
  }
  const agents = Array.isArray(value.agents) ? [...new Set(value.agents)] : [];
  if (!agents.length || agents.length > 3 || agents.some((id) => !AGENT_IDS.has(id))) {
    throw new TypeError('routing agents must contain one to three known agent IDs');
  }
  if (!['simple', 'medium', 'complex'].includes(value.complexity)) {
    throw new TypeError('routing complexity is invalid');
  }
  if (!['low', 'medium', 'high'].includes(value.priority)) {
    throw new TypeError('routing priority is invalid');
  }
  return { ...value, agents };
}

export function routeMessage(input) {
  const message = validateMessage(input);
  const words = tokenize(message);
  const wordSet = new Set(words);
  const scored = AGENTS.map((agent) => ({
    id: agent.id,
    score: agent.expertise.reduce((total, term) => total + (wordSet.has(term) ? 2 : 0) + (message.toLowerCase().includes(term) ? 1 : 0), 0),
  })).filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const agents = (scored.length ? scored : [{ id: 'project', score: 0 }]).slice(0, 3).map((entry) => entry.id);
  const priority = words.some((word) => URGENT_WORDS.has(word))
    ? 'high'
    : words.some((word) => LOW_PRIORITY_WORDS.has(word)) ? 'low' : 'medium';
  const complexity = message.length > 1200 || agents.length === 3
    ? 'complex'
    : message.length > 300 || agents.length === 2 ? 'medium' : 'simple';

  return validateRoutingDecision({
    agents,
    primaryAgent: agents[0],
    complexity,
    priority,
    reasonCodes: scored.length ? scored.slice(0, 3).map((entry) => `keyword:${entry.id}`) : ['fallback:project'],
  });
}

export function getAgent(id) {
  return AGENTS.find((agent) => agent.id === id) ?? null;
}
