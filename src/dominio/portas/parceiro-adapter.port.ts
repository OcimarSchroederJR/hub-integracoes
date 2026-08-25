import { AtualizacaoSituacao, RegistroCanonico } from '../entidades/registro-canonico';

export interface PaginaColetada {
  itens: unknown[];
  proximoCursor: string | null;
  bruto: Buffer;
}

export interface ParceiroAdapter {
  readonly codigo: string;
  coletarPagina(cursor: string | null): Promise<PaginaColetada>;
  normalizar(itemBruto: unknown): RegistroCanonico;
  enviarAtualizacao(atualizacao: AtualizacaoSituacao): Promise<void>;
}

export const PARCEIRO_ADAPTER = 'PARCEIRO_ADAPTER';
