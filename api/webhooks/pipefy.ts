import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePipefyWebhook } from '../../src/webhooks/pipefy.handler.js';
import pino from 'pino';

const logger = pino();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const signature = req.headers['x-pipefy-signature'] as string;
  const token = req.query.token as string;

  if (!signature && token !== process.env.PIPEFY_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Missing or invalid signature/token' });
  }

  const authKey = signature || token;

  try {
    // Em Serverless (Vercel), a execução PODE ser suspensa assim que a resposta é enviada.
    // Portanto, devemos OBRIGATORIAMENTE realizar o processamento ANTES de fechar a resposta.
    await handlePipefyWebhook(authKey, req.body);
    
    logger.info('Webhook processed successfully');
    return res.status(200).json({ received: true });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error handling Pipefy webhook');
    // Só responde com erro se já não tiver enviado uma resposta.
    if (!res.headersSent) {
      return res.status(400).json({ error: error.message });
    }
  }
}
