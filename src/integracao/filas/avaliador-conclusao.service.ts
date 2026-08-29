import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class AvaliadorConclusaoService {
  constructor(private readonly prisma: PrismaService) {}

  async avaliar(execucaoId: string): Promise<void> {
    const execucao = await this.prisma.execucaoIntegracao.findUniqueOrThrow({
      where: { id: execucaoId },
    });

    if (!execucao.coletaConcluida || execucao.situacao === 'CONCLUIDA') {
      return;
    }

    const resolvidos = execucao.totalPersistidos + execucao.totalRejeitados + execucao.totalFalhas;
    if (resolvidos < execucao.totalRecebidos) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.execucaoIntegracao.update({
        where: { id: execucaoId },
        data: {
          situacao: 'CONCLUIDA',
          concluidaEm: new Date(),
          duracaoMs: Date.now() - execucao.iniciadaEm.getTime(),
        },
      }),
      this.prisma.execucaoAtiva.deleteMany({ where: { parceiroId: execucao.parceiroId } }),
    ]);
  }
}
