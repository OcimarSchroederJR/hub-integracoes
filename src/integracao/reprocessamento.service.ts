import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SituacaoRegistro } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { FILA_NORMALIZACAO, JobNormalizacao } from './filas/constantes';

const SITUACOES_REPROCESSAVEIS: SituacaoRegistro[] = ['FALHA', 'REJEITADO'];

@Injectable()
export class ReprocessamentoService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(FILA_NORMALIZACAO) private readonly filaNormalizacao: Queue<JobNormalizacao>,
  ) {}

  async reprocessarExecucao(execucaoId: string) {
    const execucao = await this.prisma.execucaoIntegracao.findUnique({
      where: { id: execucaoId },
      include: { parceiro: true },
    });
    if (!execucao) {
      throw new NotFoundException(`Execução "${execucaoId}" não encontrada`);
    }

    const registros = await this.prisma.registroIntegracao.findMany({
      where: { execucaoId, situacao: { in: SITUACOES_REPROCESSAVEIS } },
    });
    if (registros.length === 0) {
      return { reprocessados: 0 };
    }

    const totalFalhas = registros.filter((r) => r.situacao === 'FALHA').length;
    const totalRejeitados = registros.filter((r) => r.situacao === 'REJEITADO').length;

    await this.prisma.$transaction([
      this.prisma.registroIntegracao.deleteMany({
        where: { id: { in: registros.map((r) => r.id) } },
      }),
      this.prisma.execucaoIntegracao.update({
        where: { id: execucaoId },
        data: {
          situacao: 'PROCESSANDO',
          concluidaEm: null,
          duracaoMs: null,
          totalFalhas: { decrement: totalFalhas },
          totalRejeitados: { decrement: totalRejeitados },
        },
      }),
      this.prisma.execucaoAtiva.upsert({
        where: { parceiroId: execucao.parceiroId },
        update: {},
        create: { parceiroId: execucao.parceiroId },
      }),
    ]);

    await this.enfileirar(
      execucao.parceiro.codigo,
      execucaoId,
      execucao.correlationId,
      registros.map((r) => r.payloadBruto),
    );

    return { reprocessados: registros.length };
  }

  async reprocessarRegistro(registroId: string) {
    const registro = await this.prisma.registroIntegracao.findUnique({
      where: { id: registroId },
      include: { execucao: { include: { parceiro: true } } },
    });
    if (!registro) {
      throw new NotFoundException(`Registro "${registroId}" não encontrado`);
    }
    if (!SITUACOES_REPROCESSAVEIS.includes(registro.situacao)) {
      throw new BadRequestException(
        `Registro "${registroId}" está com situação "${registro.situacao}" e não pode ser reprocessado`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.registroIntegracao.delete({ where: { id: registroId } }),
      this.prisma.execucaoIntegracao.update({
        where: { id: registro.execucaoId },
        data: {
          situacao: 'PROCESSANDO',
          concluidaEm: null,
          duracaoMs: null,
          ...(registro.situacao === 'FALHA' ? { totalFalhas: { decrement: 1 } } : {}),
          ...(registro.situacao === 'REJEITADO' ? { totalRejeitados: { decrement: 1 } } : {}),
        },
      }),
      this.prisma.execucaoAtiva.upsert({
        where: { parceiroId: registro.execucao.parceiroId },
        update: {},
        create: { parceiroId: registro.execucao.parceiroId },
      }),
    ]);

    await this.enfileirar(
      registro.execucao.parceiro.codigo,
      registro.execucaoId,
      registro.execucao.correlationId,
      [registro.payloadBruto],
    );

    return { reprocessados: 1 };
  }

  private async enfileirar(
    parceiroCodigo: string,
    execucaoId: string,
    correlationId: string,
    payloadsBrutos: string[],
  ): Promise<void> {
    for (const payloadBruto of payloadsBrutos) {
      await this.filaNormalizacao.add('normalizar-item', {
        execucaoId,
        correlationId,
        parceiroCodigo,
        itemBruto: JSON.parse(payloadBruto),
      } satisfies JobNormalizacao);
    }
  }
}
