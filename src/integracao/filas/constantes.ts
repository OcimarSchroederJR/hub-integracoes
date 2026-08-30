import { AtualizacaoSituacao } from '../../dominio/entidades/registro-canonico';

export const FILA_COLETA = 'coleta';
export const FILA_NORMALIZACAO = 'normalizacao';
export const FILA_ENVIO = 'envio';
export const FILA_EVENTOS_SAIDA = 'eventos-saida';

export interface JobColeta {
  execucaoId: string;
  correlationId: string;
  parceiroCodigo: string;
  cursor: string | null;
  sequencial: number;
}

export interface JobNormalizacao {
  execucaoId: string;
  correlationId: string;
  parceiroCodigo: string;
  itemBruto: unknown;
}

export interface JobEnvio {
  execucaoId: string;
  correlationId: string;
  registroId: string;
  parceiroCodigo: string;
  atualizacao: Omit<AtualizacaoSituacao, 'ocorridoEm'> & { ocorridoEm: string };
}
