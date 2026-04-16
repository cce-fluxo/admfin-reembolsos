export interface ContaAzulProject {
  id: string;
  name: string;
  code: string;
  cost_center_name?: string;
  cost_center?: {
    id: string;
    name: string;
  };
}

export interface ContaAzulCentroCusto {
  id: string;
  nome: string;
  codigo: string;
}

export interface ContaAzulCentroCustoResponse {
  items: ContaAzulCentroCusto[];
}

export interface ContaAzulAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

export interface ContaAzulProjectResponse {
  items: ContaAzulProject[];
}

export interface ContaAzulFinancialTotals {
  pago?: {
    valor: number;
  };
  a_pagar?: {
    valor: number;
  };
}

export interface ContaAzulFinanceiroResponse {
  totais: ContaAzulFinancialTotals;
}
