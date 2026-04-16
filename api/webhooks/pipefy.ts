import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePipefyWebhook } from '../../src/webhooks/pipefy.handler.js';
import pino from 'pino';

const logger = pino();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const signature = req.headers['x-pipefy-signature'] as string;

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  try {
    // Em Serverless (Vercel), a execução PODE ser suspensa assim que a resposta é enviada.
    // Portanto, devemos OBRIGATORIAMENTE realizar o processamento ANTES de fechar a resposta.
    await handlePipefyWebhook(signature, req.body);
    
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
