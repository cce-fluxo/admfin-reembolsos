import { env } from '../../config/env.js';
import { AppsScriptRequest, SheetRowData } from './sheets.types.js';
import pino from 'pino';

const logger = pino({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
});

export class SheetsApiError extends Error {
  constructor(message: string) {
    super(`Sheets API Error: ${message}`);
    this.name = 'SheetsApiError';
  }
}

export class SheetsService {
  private async callAppsScript(payload: AppsScriptRequest): Promise<void> {
    try {
      const response = await fetch(env.SHEETS_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new SheetsApiError(`Request failed with status ${response.status}`);
      }

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new SheetsApiError(result.error || 'Unknown Apps Script error');
      }

      logger.info({ action: payload.action, cardId: payload.cardId }, 'Apps Script called successfully');
    } catch (error) {
      logger.error({ error, payload }, 'Error calling Google Apps Script');
      throw error;
    }
  }

  async insertRow(cardId: string, data: SheetRowData): Promise<void> {
    await this.callAppsScript({
      action: 'insert',
      cardId,
      data,
    });
  }

  async removeRow(cardId: string): Promise<void> {
    await this.callAppsScript({
      action: 'remove',
      cardId,
    });
  }

  async updateRow(cardId: string, data: SheetRowData): Promise<void> {
    await this.callAppsScript({
      action: 'update',
      cardId,
      data,
    });
  }
}
