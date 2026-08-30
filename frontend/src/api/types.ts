export interface Parceiro {
  id: string;
  codigo: string;
  nome: string;
}

export type SituacaoExecucao = 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDA' | 'FALHA';
export type SituacaoRegistro = 'PENDENTE' | 'PERSISTIDO' | 'REJEITADO' | 'FALHA';

export interface Execucao {
  id: string;
  parceiroId: string;
  parceiro?: Parceiro;
  correlationId: string;
  situacao: SituacaoExecucao;
  coletaConcluida: boolean;
  totalRecebidos: number;
  totalPersistidos: number;
  totalRejeitados: number;
  totalFalhas: number;
  iniciadaEm: string;
  concluidaEm: string | null;
  duracaoMs: number | null;
}

export interface Registro {
  id: string;
  execucaoId: string;
  dividaId: string | null;
  identificadorExterno: string;
  situacao: SituacaoRegistro;
  motivoRejeicao: string | null;
  tentativas: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EventoTrilha {
  registroId: string;
  execucaoId: string;
  correlationId: string;
  tipo: string;
  ocorridoEm: string;
  detalhe?: Record<string, unknown>;
}

export interface Sobreposicao {
  id: string;
  devedorId: string;
  dividaAId: string;
  dividaBId: string;
  parceiroACodigo: string;
  parceiroBCodigo: string;
  numeroContratoA: string;
  numeroContratoB: string;
  valorAtualizadoA: number;
  valorAtualizadoB: number;
  detectadoEm: string;
  devedor?: { nome: string; documento: string };
}
