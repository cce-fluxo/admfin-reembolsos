import { env } from '../../config/env.js';
import { UPDATE_CARD_FIELD_MUTATION, GET_CARD_DETAILS_QUERY } from './pipefy.queries.js';
import pino from 'pino';

const logger = pino({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
});

export class PipefyApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(`Pipefy API Error: ${message}`);
    this.name = 'PipefyApiError';
  }
}

export class PipefyService {
  private readonly API_URL = 'https://api.pipefy.com/graphql';

  async updateCardField(cardId: string | number, fieldId: string | number, value: string): Promise<void> {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.PIPEFY_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: UPDATE_CARD_FIELD_MUTATION,
          variables: { cardId: cardId.toString(), fieldId: fieldId.toString(), value: [value] },
        }),
      });

      const body = (await response.json()) as { errors?: Array<{ message: string }> };

      if (!response.ok || body.errors) {
        const errorMessage = body.errors?.[0]?.message || 'Unknown error';
        throw new PipefyApiError(errorMessage, response.status);
      }

      logger.info({ cardId, fieldId, value }, 'Card field updated successfully');
    } catch (error: any) {
      logger.error({ errorMsg: error.message, error, cardId, fieldId }, 'Error updating Pipefy card field');
      throw error;
    }
  }

  async getCardDetails(cardId: string | number): Promise<{ id: string; current_phase: { id: string }; fields: Array<{ id: string; value: string }> }> {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.PIPEFY_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: GET_CARD_DETAILS_QUERY,
          variables: { cardId: cardId.toString() },
        }),
      });

      const body = (await response.json()) as { data: { card: any }; errors?: Array<{ message: string }> };

      if (!response.ok || body.errors || !body.data?.card) {
        const errorMessage = body.errors?.[0]?.message || 'Card not found';
        throw new PipefyApiError(errorMessage, response.status);
      }

      const card = body.data.card;
      
      // Achata a resposta do Pipefy preenchendo 'id' a partir de 'field.id' para manter compatibilidade com a tipagem
      if (card.fields) {
        card.fields = card.fields.map((f: any) => ({
          id: f.field?.id,
          value: f.value,
          name: f.name
        }));
      }

      return card;
    } catch (error: any) {
      logger.error({ errorMsg: error.message, error, cardId }, 'Error fetching Pipefy card details');
      throw error;
    }
  }
}
