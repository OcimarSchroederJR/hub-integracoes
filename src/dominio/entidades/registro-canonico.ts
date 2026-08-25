export type SituacaoDivida = 'EM_ATRASO' | 'EM_NEGOCIACAO' | 'QUITADA' | 'CANCELADA';

export interface RegistroCanonico {
  identificadorExterno: string;
  documento: string;
  nome: string;
  telefones: string[];
  emails: string[];
  numeroContrato: string;
  valorOriginal: number;
  valorAtualizado: number;
  dataVencimento: Date;
  situacao: SituacaoDivida;
}

export interface AtualizacaoSituacao {
  identificadorExterno: string;
  numeroContrato: string;
  novaSituacao: SituacaoDivida;
  ocorridoEm: Date;
}
