import { publicProviderStatus } from '../../lib/orchestration/gateway.mjs';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use GET.' } });
  }
  const providers = publicProviderStatus(process.env);
  return res.status(200).json({
    status: providers.some((provider) => provider.configured) ? 'ready' : 'configuration-required',
    providers,
    security: { credentials: 'server-side', routing: 'deterministic', sideEffects: 'disabled' },
  });
}
