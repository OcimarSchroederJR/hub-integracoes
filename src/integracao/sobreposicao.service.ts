import { Injectable, Logger } from '@nestjs/common';
import { SituacaoDivida } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';

const SITUACOES_ATIVAS: SituacaoDivida[] = ['EM_ATRASO', 'EM_NEGOCIACAO'];
const TOLERANCIA_RELATIVA = 0.1;

export interface DividaParaChecagem {
  id: string;
  devedorId: string;
  parceiroId: string;
  parceiroCodigo: string;
  numeroContrato: string;
  valorAtualizado: number;
  situacao: SituacaoDivida;
}

/**
 * Sinaliza, não decide: duas dívidas ativas do mesmo devedor, de
 * parceiros diferentes, com valor parecido, viram uma linha pra
 * revisão manual. Não é motor de negociação (fora de escopo) -- é
 * puramente analítico, não muda nenhuma dívida nem impede nada de
 * continuar processando.
 */
@Injectable()
export class SobreposicaoService {
  private readonly logger = new Logger(SobreposicaoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async verificar(atual: DividaParaChecagem): Promise<void> {
    if (!SITUACOES_ATIVAS.includes(atual.situacao)) {
      return;
    }

    const candidatas = await this.prisma.divida.findMany({
      where: {
        devedorId: atual.devedorId,
        parceiroId: { not: atual.parceiroId },
        situacao: { in: SITUACOES_ATIVAS },
      },
      include: { parceiro: true },
    });

    for (const outra of candidatas) {
      const maiorValor = Math.max(atual.valorAtualizado, outra.valorAtualizado, 1);
      const diferencaRelativa = Math.abs(atual.valorAtualizado - outra.valorAtualizado) / maiorValor;
      if (diferencaRelativa > TOLERANCIA_RELATIVA) {
        continue;
      }

      const [dividaAId, dividaBId] = [atual.id, outra.id].sort();
      const ehAtualA = dividaAId === atual.id;

      await this.prisma.sobreposicaoDetectada.upsert({
        where: { dividaAId_dividaBId: { dividaAId, dividaBId } },
        update: {},
        create: {
          devedorId: atual.devedorId,
          dividaAId,
          dividaBId,
          parceiroACodigo: ehAtualA ? atual.parceiroCodigo : outra.parceiro.codigo,
          parceiroBCodigo: ehAtualA ? outra.parceiro.codigo : atual.parceiroCodigo,
          numeroContratoA: ehAtualA ? atual.numeroContrato : outra.numeroContrato,
          numeroContratoB: ehAtualA ? outra.numeroContrato : atual.numeroContrato,
          valorAtualizadoA: ehAtualA ? atual.valorAtualizado : outra.valorAtualizado,
          valorAtualizadoB: ehAtualA ? outra.valorAtualizado : atual.valorAtualizado,
        },
      });

      this.logger.warn(
        `Sobreposição detectada: devedor ${atual.devedorId} tem dívidas parecidas em ` +
          `"${atual.parceiroCodigo}" (${atual.numeroContrato}) e "${outra.parceiro.codigo}" (${outra.numeroContrato})`,
      );
    }
  }

  async listar() {
    return this.prisma.sobreposicaoDetectada.findMany({
      include: { devedor: true },
      orderBy: { detectadoEm: 'desc' },
    });
  }
}
