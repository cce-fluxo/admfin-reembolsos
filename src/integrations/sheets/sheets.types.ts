export interface SheetRowData {
  competencia: string;
  vencimento: string;
  pagamento: string;
  valor: string;
  categoria: string;
  descricao: string;
  clienteFornecedor: string;
  cnpjCpf: string;
  centroCusto: string;
  observacoes: string;
}

export type AppsScriptAction = 'insert' | 'remove';

export interface AppsScriptRequest {
  action: AppsScriptAction;
  cardId: string;
  data?: SheetRowData;
}
