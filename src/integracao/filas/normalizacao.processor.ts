import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RegistroAdaptadores } from '../../parceiros/registro-adaptadores';
import { ErroDeDado } from '../../dominio/erros/erro-de-dado';
import { RegistroCanonico } from '../../dominio/entidades/registro-canonico';
import { calcularChaveIdempotencia } from '../../dominio/servicos/chave-idempotencia';
import { FILA_NORMALIZACAO, JobNormalizacao } from './constantes';
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
  ) {
    super();
  }

  async process(job: Job<JobNormalizacao>): Promise<void> {
    const { execucaoId, parceiroCodigo, itemBruto } = job.data;
    const adaptador = this.registroAdaptadores.obter(parceiroCodigo);

    try {
      const canonico = adaptador.normalizar(itemBruto);
      await this.persistir(execucaoId, parceiroCodigo, canonico, itemBruto);
    } catch (erro) {
      if (!(erro instanceof ErroDeDado)) {
        throw erro;
      }
      this.logger.warn(`Registro rejeitado (${identificadorParaLog(itemBruto)}): ${erro.message}`);
      await this.registrarRejeicao(execucaoId, itemBruto, erro.message);
    }

    await this.avaliadorConclusao.avaliar(execucaoId);
  }

  private async persistir(
    execucaoId: string,
    parceiroCodigo: string,
    canonico: RegistroCanonico,
    itemBruto: unknown,
  ): Promise<void> {
    const [devedor, parceiro] = await Promise.all([
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

    await this.prisma.registroIntegracao.create({
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
  }

  private async registrarRejeicao(execucaoId: string, itemBruto: unknown, motivo: string): Promise<void> {
    await this.prisma.registroIntegracao.create({
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
  }
}
