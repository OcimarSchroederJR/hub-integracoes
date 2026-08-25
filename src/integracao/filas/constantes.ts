export const FILA_COLETA = 'coleta';
export const FILA_NORMALIZACAO = 'normalizacao';

export interface JobColeta {
  execucaoId: string;
  parceiroCodigo: string;
  cursor: string | null;
}

export interface JobNormalizacao {
  execucaoId: string;
  parceiroCodigo: string;
  itemBruto: unknown;
}
