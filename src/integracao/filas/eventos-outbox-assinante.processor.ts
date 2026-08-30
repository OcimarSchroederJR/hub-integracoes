import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EventoTrilha } from '../../dominio/portas/trilha-eventos.port';
import { FILA_EVENTOS_SAIDA } from './constantes';

/**
 * Fica no lugar de "outro sistema interno" assinando o outbox --
 * prova que a fila de saída realmente entrega os eventos publicados
 * por EventosOutboxService, sem o hub precisar saber quem, de fato,
 * vai consumir isso um dia (faturamento, um data warehouse, outro
 * time). Em produção, este processor seria removido e substituído
 * pelos consumidores reais.
 */
@Processor(FILA_EVENTOS_SAIDA, { concurrency: 5 })
export class EventosOutboxAssinanteProcessor extends WorkerHost {
  private readonly logger = new Logger('AssinanteInterno');

  async process(job: Job<EventoTrilha>): Promise<void> {
    const evento = job.data;
    this.logger.log(
      `Evento recebido pelo assinante interno: ${evento.tipo} (registro ${evento.registroId}, execução ${evento.execucaoId})`,
    );
  }
}
