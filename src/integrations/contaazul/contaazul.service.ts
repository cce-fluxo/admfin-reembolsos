import { createClient } from '@supabase/supabase-js';
import pino from 'pino';
import { env } from '../../config/env.js';
import {
  ContaAzulAuthResponse,
  ContaAzulCentroCusto,
  ContaAzulCentroCustoResponse,
  ContaAzulFinanceiroResponse,
} from './contaazul.types.js';
import { retryRequest, runInBatches } from './utils.js';

const logger = pino({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export class ContaAzulApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(`ContaAzul API Error: ${message}`);
    this.name = 'ContaAzulApiError';
  }
}

export class ContaAzulService {
  private readonly TOKEN_URL = 'https://auth.contaazul.com/oauth2/token';
  private readonly API_BASE = 'https://api-v2.contaazul.com';

  /* ---------------------------
     DB token helpers (Stateful)
     --------------------------- */
  private async getRefreshTokenFromDB(): Promise<string> {
    const { data, error } = await supabase
      .from('contaazul_tokens')
      .select('refresh_token')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw new Error('Nenhum refresh_token encontrado no banco');
    }

    return data.refresh_token;
  }

  private async saveRefreshTokenToDB(refresh_token: string) {
    const { error } = await supabase
      .from('contaazul_tokens')
      .insert({ refresh_token });

    if (error) {
      logger.error({ error: error.message }, 'Erro ao salvar refresh_token no Supabase');
      throw error;
    }
  }

  private async invalidateRefreshTokenInDB() {
    const { error } = await supabase
      .from('contaazul_tokens')
      .delete()
      .neq('id', 0);
      
    if (error) {
      logger.error({ error }, 'Falha ao remover refresh_token do DB');
    } else {
      logger.info('Refresh token removido do DB para forçar reautenticação.');
    }
  }

  /* ---------------------------
     Token handling
     --------------------------- */
  async getAccessToken(): Promise<string> {
    const refresh_token = await this.getRefreshTokenFromDB();

    const authHeader = Buffer.from(
      `${env.CONTAAZUL_CLIENT_ID}:${env.CONTAAZUL_CLIENT_SECRET}`
    ).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
    });

    try {
      const response = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        if (response.status === 400 && (errorData.error === 'invalid_grant' || errorData.error === 'invalid_token')) {
          await this.invalidateRefreshTokenInDB();
        }
        throw new ContaAzulApiError(`Failed to refresh token: ${JSON.stringify(errorData)}`, response.status);
      }

      const data = (await response.json()) as ContaAzulAuthResponse;

      if (data.refresh_token && data.refresh_token !== refresh_token) {
        await this.saveRefreshTokenToDB(data.refresh_token);
        logger.info('Novo refresh_token salvo no Supabase');
      }

      return data.access_token;
    } catch (error) {
      logger.error({ error }, 'Erro ao obter access token');
      throw error;
    }
  }

  /* ---------------------------
     API methods
     --------------------------- */

  /**
   * Mantido para compatibilidade com pipefy.handler.ts
   * Na verdade busca um Centro de Custo pelo código
   */
  async getProjectByCodigo(codigo: string): Promise<ContaAzulCentroCusto> {
    return this.getCentroDeCustoPorCodigo(codigo);
  }

  /**
   * Mantido para compatibilidade com pipefy.handler.ts
   * Retorna o nome do centro de custo
   */
  getCentroDeCusto(centro: ContaAzulCentroCusto): string {
    return centro.nome;
  }

  async getCentroDeCustoPorCodigo(codigo: string): Promise<ContaAzulCentroCusto> {
    const token = await this.getAccessToken();

    const fn = async () => {
      const response = await fetch(
        `${this.API_BASE}/v1/centro-de-custo?busca=${encodeURIComponent(codigo)}&filtro_rapido=ATIVO`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        throw new ContaAzulApiError('Erro ao buscar centro de custo', response.status);
      }

      const data = (await response.json()) as ContaAzulCentroCustoResponse;
      const found = data.items.find((c) => c.codigo === codigo);
      
      if (!found) {
        throw new ContaAzulApiError(`Centro de custo ${codigo} não encontrado`, 404);
      }
      
      return found;
    };

    return retryRequest(() => fn(), { maxRetries: 5, baseDelayMs: 800 });
  }

  async getCentrosDeCusto(cards: any[]) {
    const accessToken = await this.getAccessToken();
    const concurrency = env.CONTAAZUL_CONCURRENCY;

    const worker = async (card: any) => {
      // O mapeamento do card depende de como o card vem do PipefyService
      // Usando 'Nome do Projeto' e 'Código' baseados no template do usuário
      const codigo = card['Código'] || card.fields?.find((f: any) => f.id === 'codigo')?.value;
      
      if (!codigo) return null;

      try {
        const centro = await this.getCentroDeCustoPorCodigo(codigo);
        return {
          projeto: card['Nome do Projeto'] || card.title,
          codigo: centro.codigo,
          id: centro.id,
          idCard: card.id,
        };
      } catch (error) {
        logger.error({ error, cardId: card.id }, 'Erro ao buscar centro de custo para card');
        return null;
      }
    };

    const results = await runInBatches(cards, worker, concurrency);
    return results.filter((r) => r !== null);
  }

  async getDespesas(centrosDeCusto: any[]) {
    const accessToken = await this.getAccessToken();
    const concurrency = env.CONTAAZUL_CONCURRENCY;

    const worker = async (centro: any) => {
      if (!centro.id) return { centro: centro.projeto, totalPago: 0, idCard: centro.idCard };

      const query = new URLSearchParams({
        pagina: '1',
        tamanho_pagina: '1000',
        data_vencimento_de: '2015-01-01',
        data_vencimento_ate: '2030-12-31',
        ids_centros_de_custo: centro.id,
        ids_categorias: env.CONTAAZUL_CATEGORIA_IDS || '',
      }).toString();

      const fn = async () => {
        const response = await fetch(
          `${this.API_BASE}/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?${query}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new ContaAzulApiError('Erro ao buscar despesas', response.status);
        }

        const data = (await response.json()) as ContaAzulFinanceiroResponse;
        return {
          centro: centro.projeto,
          totalPago: data.totais?.pago?.valor ?? 0,
          idCard: centro.idCard,
        };
      };

      try {
        return await retryRequest(() => fn(), { maxRetries: 5, baseDelayMs: 1000 });
      } catch (error) {
        logger.error({ error, centro: centro.projeto }, 'Erro ao buscar despesas');
        return { centro: centro.projeto, totalPago: 0, idCard: centro.idCard };
      }
    };

    return runInBatches(centrosDeCusto, worker, concurrency);
  }

  async setupCategoryFilter() {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.API_BASE}/v1/categorias?tipo=DESPESA&tamanho_pagina=500`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new ContaAzulApiError('Erro ao buscar categorias', response.status);
      }

      const data = (await response.json()) as any;
      const categoryIds = (data.itens || data.items || [])
        .filter((cat: any) => cat.entrada_dre === 'CUSTO_SERVICOS_PRESTADOS')
        .map((cat: any) => cat.id);
      
      logger.info({ count: categoryIds.length }, "Categorias 'CUSTO_SERVICOS_PRESTADOS' encontradas");
      return categoryIds.join(',');
    } catch (error) {
      logger.error({ error }, 'Erro ao configurar filtro de categorias');
      throw error;
    }
  }
}