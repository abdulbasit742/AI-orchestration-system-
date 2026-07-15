import { orchestrateRequest, publicError } from '../../lib/orchestration/service.mjs';

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use POST.' } });
  }
  try {
    const result = await orchestrateRequest(req.body, { env: process.env, fetchImpl: globalThis.fetch });
    return res.status(200).json(result);
  } catch (error) {
    const response = publicError(error);
    return res.status(response.status).json(response.body);
  }
}
