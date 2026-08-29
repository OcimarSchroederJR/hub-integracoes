export type TipoEvento =
  'REGISTRO_PERSISTIDO' | 'REGISTRO_REJEITADO' | 'REGISTRO_FALHOU' | 'ATUALIZACAO_ENVIADA';

export interface EventoTrilha {
  registroId: string;
  execucaoId: string;
  correlationId: string;
  tipo: TipoEvento;
  ocorridoEm: string;
  detalhe: Record<string, unknown>;
}

export interface TrilhaEventos {
  registrar(evento: EventoTrilha): Promise<void>;
  listarPorRegistro(registroId: string): Promise<EventoTrilha[]>;
}

export const TRILHA_EVENTOS = 'TRILHA_EVENTOS';
