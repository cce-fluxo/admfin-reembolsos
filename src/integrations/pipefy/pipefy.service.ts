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

  async updateCardField(cardId: string, fieldId: string, value: string): Promise<void> {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.PIPEFY_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: UPDATE_CARD_FIELD_MUTATION,
          variables: { cardId, fieldId, value },
        }),
      });

      const body = (await response.json()) as { errors?: Array<{ message: string }> };

      if (!response.ok || body.errors) {
        const errorMessage = body.errors?.[0]?.message || 'Unknown error';
        throw new PipefyApiError(errorMessage, response.status);
      }

      logger.info({ cardId, fieldId, value }, 'Card field updated successfully');
    } catch (error) {
      logger.error({ error, cardId, fieldId }, 'Error updating Pipefy card field');
      throw error;
    }
  }

  async getCardDetails(cardId: string): Promise<{ id: string; fields: Array<{ id: string; value: string }> }> {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.PIPEFY_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: GET_CARD_DETAILS_QUERY,
          variables: { cardId },
        }),
      });

      const body = (await response.json()) as { data: { card: any }; errors?: Array<{ message: string }> };

      if (!response.ok || body.errors || !body.data?.card) {
        const errorMessage = body.errors?.[0]?.message || 'Card not found';
        throw new PipefyApiError(errorMessage, response.status);
      }

      return body.data.card;
    } catch (error) {
      logger.error({ error, cardId }, 'Error fetching Pipefy card details');
      throw error;
    }
  }
}
