import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleVercelRequest } from './_handler.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleVercelRequest(req, res);
}

