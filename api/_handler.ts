import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../apps/backend/src/app.js';

let appPromise: Promise<any> | null = null;

async function getFastifyApp() {
  if (!appPromise) {
    const app = buildApp();
    appPromise = app.ready().then(() => app);
  }
  return appPromise;
}

export async function handleVercelRequest(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getFastifyApp();

    // Determine the original requested URL
    let url = req.url || '/api/v1/health';

    // In case Vercel rewrote or stripped path, check forwarded headers
    const forwardedUri = req.headers['x-forwarded-uri'] as string;
    if (forwardedUri && forwardedUri.startsWith('/api')) {
      url = forwardedUri;
    }

    const payload = req.body !== undefined ? req.body : undefined;

    const response = await app.inject({
      method: (req.method as any) || 'GET',
      url,
      headers: req.headers as any,
      payload
    });

    // Forward response headers
    for (const [key, val] of Object.entries(response.headers)) {
      if (val !== undefined) {
        res.setHeader(key, val as any);
      }
    }

    res.status(response.statusCode).send(response.rawPayload);
  } catch (err: any) {
    console.error('Vercel API Handler Error:', err);
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: err.message || 'An error occurred processing the request'
    });
  }
}
