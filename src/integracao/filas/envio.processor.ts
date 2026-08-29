import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { RegistroAdaptadores } from '../../parceiros/registro-adaptadores';
import { executarComCorrelationId } from '../../infra/observabilidade/contexto-correlacao';
import { TrilhaEventos, TRILHA_EVENTOS } from '../../dominio/portas/trilha-eventos.port';
import { FILA_ENVIO, JobEnvio } from './constantes';

@Processor(FILA_ENVIO, { concurrency: 5 })
export class EnvioProcessor extends WorkerHost {
  private readonly logger = new Logger(EnvioProcessor.name);

  constructor(
    private readonly registroAdaptadores: RegistroAdaptadores,
    @Inject(TRILHA_EVENTOS) private readonly trilhaEventos: TrilhaEventos,
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

    await this.trilhaEventos.registrar({
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
