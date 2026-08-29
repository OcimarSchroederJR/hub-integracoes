import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RegistroAdaptadores } from '../../parceiros/registro-adaptadores';
import { FILA_ENVIO, JobEnvio } from './constantes';

@Processor(FILA_ENVIO, { concurrency: 5 })
export class EnvioProcessor extends WorkerHost {
  private readonly logger = new Logger(EnvioProcessor.name);

  constructor(private readonly registroAdaptadores: RegistroAdaptadores) {
    super();
  }

  async process(job: Job<JobEnvio>): Promise<void> {
    const { parceiroCodigo, atualizacao } = job.data;
    const adaptador = this.registroAdaptadores.obter(parceiroCodigo);

    await adaptador.enviarAtualizacao({
      ...atualizacao,
      ocorridoEm: new Date(atualizacao.ocorridoEm),
    });

    this.logger.log(
      `Atualização de situação enviada a "${parceiroCodigo}": contrato ${atualizacao.numeroContrato} -> ${atualizacao.novaSituacao}`,
    );
  }
}
