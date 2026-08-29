import { AtualizacaoSituacao } from '../../dominio/entidades/registro-canonico';

export const FILA_COLETA = 'coleta';
export const FILA_NORMALIZACAO = 'normalizacao';
export const FILA_ENVIO = 'envio';

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

export interface JobEnvio {
  parceiroCodigo: string;
  atualizacao: Omit<AtualizacaoSituacao, 'ocorridoEm'> & { ocorridoEm: string };
}
