import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RegistroAdaptadores } from '../../parceiros/registro-adaptadores';
import { executarComCorrelationId } from '../../infra/observabilidade/contexto-correlacao';
import { EventosOutboxService } from './eventos-outbox.service';
import { FILA_ENVIO, JobEnvio } from './constantes';

@Processor(FILA_ENVIO, { concurrency: 5 })
export class EnvioProcessor extends WorkerHost {
  private readonly logger = new Logger(EnvioProcessor.name);

  constructor(
    private readonly registroAdaptadores: RegistroAdaptadores,
    private readonly eventosOutbox: EventosOutboxService,
  ) {
    super();
  }

  async process(job: Job<JobEnvio>): Promise<void> {
    return executarComCorrelationId(job.data.correlationId, () => this.processar(job));
  }

  private async processar(job: Job<JobEnvio>): Promise<void> {
    const { execucaoId, correlationId, registroId, parceiroCodigo, atualizacao } = job.data;
    const adaptador = this.registroAdaptadores.obter(parceiroCodigo);

    await adaptador.enviarAtualizacao({
      ...atualizacao,
      ocorridoEm: new Date(atualizacao.ocorridoEm),
    });

    this.logger.log(
      `Atualização de situação enviada a "${parceiroCodigo}": contrato ${atualizacao.numeroContrato} -> ${atualizacao.novaSituacao}`,
    );

    await this.eventosOutbox.publicar({
      registroId,
      execucaoId,
      correlationId,
      tipo: 'ATUALIZACAO_ENVIADA',
      ocorridoEm: new Date().toISOString(),
      detalhe: {
        parceiroCodigo,
        numeroContrato: atualizacao.numeroContrato,
        novaSituacao: atualizacao.novaSituacao,
      },
    });
  }
}
