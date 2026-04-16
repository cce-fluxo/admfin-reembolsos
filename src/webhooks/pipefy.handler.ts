import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { PipefyWebhookPayload } from './pipefy.dto.js';
import { ContaAzulService } from '../integrations/contaazul/contaazul.service.js';
import { PipefyService } from '../integrations/pipefy/pipefy.service.js';
import { SheetsService } from '../integrations/sheets/sheets.service.js';
import pino from 'pino';

const logger = pino({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
});

const contaAzulService = new ContaAzulService();
const pipefyService = new PipefyService();
const sheetsService = new SheetsService();

export class WebhookValidationError extends Error {
  constructor(message: string) {
    super(`Webhook Validation Error: ${message}`);
    this.name = 'WebhookValidationError';
  }
}

export async function handlePipefyWebhook(signature: string, payload: PipefyWebhookPayload): Promise<void> {
  validateSignature(signature, payload);

  // O payload vem encapsulado dentro da propriedade "data"
  logger.info({ raw_payload_keys: Object.keys(payload), innerDataPayload: JSON.stringify(payload.data).substring(0, 500) }, 'PIPEFY_PAYLOAD_DEBUG');

  const innerData = payload.data || payload;
  const actionType = (innerData as any).action || (innerData as any).event?.type || (innerData as any).event;

  logger.info({ type: actionType }, 'Processing Pipefy webhook event');

  if (actionType === 'card.field_update' || actionType === 'card.update' || actionType === 'card.done') {
    await handleFieldUpdate(innerData);
  } else if (actionType === 'card.move') {
    await handleCardMove(innerData);
  }
}

function validateSignature(signature: string, payload: any): void {
  // Se estivermos usando o secret cru na URL da Vercel (?token=sua_secret)
  if (signature === env.PIPEFY_WEBHOOK_SECRET) return;

  const hmac = crypto.createHmac('sha256', env.PIPEFY_WEBHOOK_SECRET);
  const body = JSON.stringify(payload);
  const digest = hmac.update(body).digest('hex');

  if (signature !== digest) {
    logger.warn({ signature, expected: digest }, 'Invalid webhook signature');
    throw new WebhookValidationError('Invalid HMAC signature');
  }
}

async function handleFieldUpdate(data: any): Promise<void> {
  const { card, field, new_value } = data;
  const fieldValue = new_value || field?.value;
  logger.info({ card, field, new_value, fieldValue }, 'Field update');
  if (field && field.id && field.id.toString() === env.PIPEFY_CENTRO_CUSTO_FIELD_ID && fieldValue) {
    logger.info({ cardId: card.id, codigoProjeto: fieldValue }, 'Updating Centro de Custo from ContaAzul');

    try {
      const project = await contaAzulService.getProjectByCodigo(fieldValue);
      const centroCusto = contaAzulService.getCentroDeCusto(project);

      await pipefyService.updateCardField(card.id, env.PIPEFY_CENTRO_CUSTO_FIELD_ID, centroCusto);
    } catch (error) {
      logger.error({ error, cardId: card.id }, 'Failed to process ContaAzul integration');
    }
  }
}

async function handleCardMove(data: any): Promise<void> {
  const { card, to } = data;

  if (!to || !to.id) return;

  const toIdStr = to.id.toString();

  if (toIdStr === env.SHEETS_FASE_MONITORADA) {
    logger.info({ cardId: card.id }, 'Fetching card details for Google Sheets insertion');

    try {
      const cardDetails = await pipefyService.getCardDetails(card.id);

      const getFieldValue = (id: string) =>
        cardDetails.fields.find(f => f.id === id)?.value || '';

      await sheetsService.insertRow(card.id.toString(), {
        competencia: getFieldValue(env.FIELD_COMPETENCIA_ID),
        vencimento: getFieldValue(env.FIELD_VENCIMENTO_ID),
        pagamento: getFieldValue(env.FIELD_PAGAMENTO_ID),
        valor: getFieldValue(env.FIELD_VALOR_ID),
        categoria: getFieldValue(env.FIELD_CATEGORIA_ID),
        descricao: getFieldValue(env.FIELD_DESCRICAO_ID),
        clienteFornecedor: getFieldValue(env.FIELD_CLIENTE_FORNECEDOR_ID),
        cnpjCpf: getFieldValue(env.FIELD_CNPJ_CPF_ID),
        centroCusto: getFieldValue(env.FIELD_CENTRO_CUSTO_ID),
        observacoes: getFieldValue(env.FIELD_OBSERVACOES_ID),
      });
    } catch (error) {
      logger.error({ error, cardId: card.id }, 'Failed to process Sheets insertion');
    }
  } else if (toIdStr === env.SHEETS_FASE_SEGUINTE) {
    logger.info({ cardId: card.id }, 'Removing card from Google Sheets');
    await sheetsService.removeRow(card.id.toString());
  }
}
