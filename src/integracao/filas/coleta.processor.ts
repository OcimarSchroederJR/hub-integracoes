import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RegistroAdaptadores } from '../../parceiros/registro-adaptadores';
import { ArquivoBruto, ARQUIVO_BRUTO, chaveArquivoBruto } from '../../dominio/portas/arquivo-bruto.port';
import { FILA_COLETA, FILA_NORMALIZACAO, JobColeta, JobNormalizacao } from './constantes';
import { AvaliadorConclusaoService } from './avaliador-conclusao.service';

const LIMITE_ALFA_POR_MINUTO = Number(process.env.PARCEIRO_ALFA_RATE_LIMIT_POR_MINUTO) || 60;

@Processor(FILA_COLETA, {
  concurrency: 1,
  limiter: { max: LIMITE_ALFA_POR_MINUTO, duration: 60_000 },
})
export class ColetaProcessor extends WorkerHost {
  private readonly logger = new Logger(ColetaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registroAdaptadores: RegistroAdaptadores,
    private readonly avaliadorConclusao: AvaliadorConclusaoService,
    @Inject(ARQUIVO_BRUTO) private readonly arquivoBruto: ArquivoBruto,
    @InjectQueue(FILA_COLETA) private readonly filaColeta: Queue<JobColeta>,
    @InjectQueue(FILA_NORMALIZACAO) private readonly filaNormalizacao: Queue<JobNormalizacao>,
  ) {
    super();
  }

  async process(job: Job<JobColeta>): Promise<void> {
    const { execucaoId, parceiroCodigo, cursor, sequencial } = job.data;
    const adaptador = this.registroAdaptadores.obter(parceiroCodigo);

    await this.prisma.execucaoIntegracao.updateMany({
      where: { id: execucaoId, situacao: 'PENDENTE' },
      data: { situacao: 'PROCESSANDO' },
    });

    const pagina = await adaptador.coletarPagina(cursor);
    this.logger.log(
      `Página coletada de "${parceiroCodigo}": ${pagina.itens.length} itens, cursor="${cursor}"`,
    );

    await this.arquivoBruto.arquivar(
      chaveArquivoBruto(parceiroCodigo, execucaoId, sequencial, pagina.extensao),
      pagina.bruto,
    );

    await this.prisma.execucaoIntegracao.update({
      where: { id: execucaoId },
      data: { totalRecebidos: { increment: pagina.itens.length } },
    });

    for (const item of pagina.itens) {
      await this.filaNormalizacao.add('normalizar-item', {
        execucaoId,
        parceiroCodigo,
        itemBruto: item,
      } satisfies JobNormalizacao);
    }

    if (pagina.proximoCursor) {
      await this.filaColeta.add('coletar-pagina', {
        execucaoId,
        parceiroCodigo,
        cursor: pagina.proximoCursor,
        sequencial: sequencial + 1,
      } satisfies JobColeta);
      return;
    }

    await this.prisma.execucaoIntegracao.update({
      where: { id: execucaoId },
      data: { coletaConcluida: true },
    });
    await this.avaliadorConclusao.avaliar(execucaoId);
  }

  /**
   * Só loga: uma falha de coleta é retentada pelo BullMQ como qualquer
   * outra (nada foi persistido ainda para essa página). Se as tentativas
   * se esgotarem, a execução fica parada em PROCESSANDO -- o cenário que
   * o RUNBOOK.md descreve em "execução parada em PROCESSANDO".
   */
  @OnWorkerEvent('failed')
  logarFalhaDeColeta(job: Job<JobColeta> | undefined, erro: Error): void {
    if (!job) return;
    this.logger.warn(
      `Falha ao coletar página de "${job.data.parceiroCodigo}" (tentativa ${job.attemptsMade}/${job.opts.attempts}): ${erro.message}`,
    );
  }
}
