import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RegistroAdaptadores } from '../../parceiros/registro-adaptadores';
import { ErroDeDado } from '../../dominio/erros/erro-de-dado';
import { RegistroCanonico } from '../../dominio/entidades/registro-canonico';
import { calcularChaveIdempotencia } from '../../dominio/servicos/chave-idempotencia';
import { executarComCorrelationId } from '../../infra/observabilidade/contexto-correlacao';
import { MetricsService } from '../../infra/observabilidade/metrics.service';
import { TrilhaEventos, TRILHA_EVENTOS } from '../../dominio/portas/trilha-eventos.port';
import { FILA_ENVIO, FILA_NORMALIZACAO, JobEnvio, JobNormalizacao } from './constantes';
import { AvaliadorConclusaoService } from './avaliador-conclusao.service';

const CONCORRENCIA_NORMALIZACAO = Number(process.env.FILA_CONCORRENCIA_NORMALIZACAO) || 10;

function identificadorParaLog(itemBruto: unknown): string {
  if (itemBruto && typeof itemBruto === 'object' && 'externalId' in itemBruto) {
    return String((itemBruto as { externalId: unknown }).externalId);
  }
  return 'desconhecido';
}

@Processor(FILA_NORMALIZACAO, { concurrency: CONCORRENCIA_NORMALIZACAO })
export class NormalizacaoProcessor extends WorkerHost {
  private readonly logger = new Logger(NormalizacaoProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registroAdaptadores: RegistroAdaptadores,
    private readonly avaliadorConclusao: AvaliadorConclusaoService,
    @Inject(TRILHA_EVENTOS) private readonly trilhaEventos: TrilhaEventos,
    private readonly metrics: MetricsService,
    @InjectQueue(FILA_ENVIO) private readonly filaEnvio: Queue<JobEnvio>,
  ) {
    super();
  }

  async process(job: Job<JobNormalizacao>): Promise<void> {
    return executarComCorrelationId(job.data.correlationId, () => this.processar(job));
  }

  private async processar(job: Job<JobNormalizacao>): Promise<void> {
    const { execucaoId, correlationId, parceiroCodigo, itemBruto } = job.data;
    const adaptador = this.registroAdaptadores.obter(parceiroCodigo);

    try {
      const canonico = adaptador.normalizar(itemBruto);
      await this.persistir(execucaoId, correlationId, parceiroCodigo, canonico, itemBruto);
    } catch (erro) {
      if (!(erro instanceof ErroDeDado)) {
        throw erro;
      }
      this.logger.warn(`Registro rejeitado (${identificadorParaLog(itemBruto)}): ${erro.message}`);
      await this.registrarRejeicao(execucaoId, correlationId, parceiroCodigo, itemBruto, erro.message);
    }

    await this.avaliadorConclusao.avaliar(execucaoId);
  }

  /**
   * Falha de infraestrutura relançada em process() volta para o retry do
   * BullMQ (ADR 0005). Só quando a última tentativa se esgota é que o
   * registro vira FALHA de verdade, com o payload bruto preservado para
   * reprocessamento manual (RF08/RF09).
   */
  @OnWorkerEvent('failed')
  async aoEsgotarTentativas(job: Job<JobNormalizacao> | undefined, erro: Error): Promise<void> {
    if (!job) return;
    await executarComCorrelationId(job.data.correlationId, () => this.tratarFalhaFinal(job, erro));
  }

  private async tratarFalhaFinal(job: Job<JobNormalizacao>, erro: Error): Promise<void> {
    const tentativasMaximas = job.opts.attempts ?? 1;
    if (job.attemptsMade < tentativasMaximas) {
      return;
    }

    const { execucaoId, correlationId, parceiroCodigo, itemBruto } = job.data;
    this.logger.error(
      `Registro em falha após ${job.attemptsMade} tentativas (${identificadorParaLog(itemBruto)}): ${erro.message}`,
    );

    const registro = await this.prisma.registroIntegracao.create({
      data: {
        execucaoId,
        identificadorExterno: identificadorParaLog(itemBruto),
        situacao: 'FALHA',
        motivoRejeicao: erro.message,
        tentativas: job.attemptsMade,
        payloadBruto: JSON.stringify(itemBruto),
      },
    });

    await this.prisma.execucaoIntegracao.update({
      where: { id: execucaoId },
      data: { totalFalhas: { increment: 1 } },
    });

    await this.trilhaEventos.registrar({
      registroId: registro.id,
      execucaoId,
      correlationId,
      tipo: 'REGISTRO_FALHOU',
      ocorridoEm: new Date().toISOString(),
      detalhe: { motivo: erro.message, tentativas: job.attemptsMade },
    });

    this.metrics.registrosProcessados.inc({ parceiro: parceiroCodigo, resultado: 'falha' });

    await this.avaliadorConclusao.avaliar(execucaoId);
  }

  private async persistir(
    execucaoId: string,
    correlationId: string,
    parceiroCodigo: string,
    canonico: RegistroCanonico,
    itemBruto: unknown,
  ): Promise<void> {
    const [devedor, parceiro, dividaAnterior] = await Promise.all([
      this.prisma.devedor.upsert({
        where: { documento: canonico.documento },
        update: { nome: canonico.nome, telefones: canonico.telefones, emails: canonico.emails },
        create: {
          documento: canonico.documento,
          nome: canonico.nome,
          telefones: canonico.telefones,
          emails: canonico.emails,
        },
      }),
      this.prisma.parceiro.findUniqueOrThrow({ where: { codigo: parceiroCodigo } }),
      this.prisma.divida.findUnique({
        where: {
          chaveIdempotencia: calcularChaveIdempotencia(
            parceiroCodigo,
            canonico.identificadorExterno,
            canonico.numeroContrato,
          ),
        },
      }),
    ]);

    const chaveIdempotencia = calcularChaveIdempotencia(
      parceiroCodigo,
      canonico.identificadorExterno,
      canonico.numeroContrato,
    );

    const divida = await this.prisma.divida.upsert({
      where: { chaveIdempotencia },
      update: {
        valorOriginal: canonico.valorOriginal,
        valorAtualizado: canonico.valorAtualizado,
        dataVencimento: canonico.dataVencimento,
        situacao: canonico.situacao,
      },
      create: {
        devedorId: devedor.id,
        parceiroId: parceiro.id,
        numeroContrato: canonico.numeroContrato,
        valorOriginal: canonico.valorOriginal,
        valorAtualizado: canonico.valorAtualizado,
        dataVencimento: canonico.dataVencimento,
        situacao: canonico.situacao,
        chaveIdempotencia,
      },
    });

    const registro = await this.prisma.registroIntegracao.create({
      data: {
        execucaoId,
        dividaId: divida.id,
        identificadorExterno: canonico.identificadorExterno,
        situacao: 'PERSISTIDO',
        payloadBruto: JSON.stringify(itemBruto),
      },
    });

    await this.prisma.execucaoIntegracao.update({
      where: { id: execucaoId },
      data: { totalPersistidos: { increment: 1 } },
    });

    await this.trilhaEventos.registrar({
      registroId: registro.id,
      execucaoId,
      correlationId,
      tipo: 'REGISTRO_PERSISTIDO',
      ocorridoEm: new Date().toISOString(),
      detalhe: {
        dividaId: divida.id,
        numeroContrato: canonico.numeroContrato,
        situacao: canonico.situacao,
      },
    });

    this.metrics.registrosProcessados.inc({ parceiro: parceiroCodigo, resultado: 'persistido' });

    if (dividaAnterior && dividaAnterior.situacao !== canonico.situacao) {
      await this.filaEnvio.add('enviar-atualizacao', {
        execucaoId,
        correlationId,
        registroId: registro.id,
        parceiroCodigo,
        atualizacao: {
          identificadorExterno: canonico.identificadorExterno,
          numeroContrato: canonico.numeroContrato,
          novaSituacao: canonico.situacao,
          ocorridoEm: new Date().toISOString(),
        },
      } satisfies JobEnvio);
    }
  }

  private async registrarRejeicao(
    execucaoId: string,
    correlationId: string,
    parceiroCodigo: string,
    itemBruto: unknown,
    motivo: string,
  ): Promise<void> {
    const registro = await this.prisma.registroIntegracao.create({
      data: {
        execucaoId,
        identificadorExterno: identificadorParaLog(itemBruto),
        situacao: 'REJEITADO',
        motivoRejeicao: motivo,
        payloadBruto: JSON.stringify(itemBruto),
      },
    });

    await this.prisma.execucaoIntegracao.update({
      where: { id: execucaoId },
      data: { totalRejeitados: { increment: 1 } },
    });

    await this.trilhaEventos.registrar({
      registroId: registro.id,
      execucaoId,
      correlationId,
      tipo: 'REGISTRO_REJEITADO',
      ocorridoEm: new Date().toISOString(),
      detalhe: { motivo },
    });

    this.metrics.registrosProcessados.inc({ parceiro: parceiroCodigo, resultado: 'rejeitado' });
  }
}
