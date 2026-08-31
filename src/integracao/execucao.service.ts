import { randomUUID } from 'crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, SituacaoRegistro } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { RegistroAdaptadores, ParceiroDesconhecidoError } from '../parceiros/registro-adaptadores';
import { TrilhaEventos, TRILHA_EVENTOS } from '../dominio/portas/trilha-eventos.port';
import { FILA_COLETA, JobColeta } from './filas/constantes';

@Injectable()
export class ExecucaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registroAdaptadores: RegistroAdaptadores,
    @Inject(TRILHA_EVENTOS) private readonly trilhaEventos: TrilhaEventos,
    @InjectQueue(FILA_COLETA) private readonly filaColeta: Queue<JobColeta>,
  ) {}

  async dispararExecucao(parceiroCodigo: string) {
    try {
      this.registroAdaptadores.obter(parceiroCodigo);
    } catch (erro) {
      if (erro instanceof ParceiroDesconhecidoError) {
        throw new NotFoundException(erro.message);
      }
      throw erro;
    }

    const parceiro = await this.prisma.parceiro.upsert({
      where: { codigo: parceiroCodigo },
      update: {},
      create: { codigo: parceiroCodigo, nome: parceiroCodigo },
    });

    try {
      await this.prisma.execucaoAtiva.create({ data: { parceiroId: parceiro.id } });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new ConflictException(
          `Já existe uma execução em andamento para o parceiro "${parceiroCodigo}"`,
        );
      }
      throw erro;
    }

    const execucao = await this.prisma.execucaoIntegracao.create({
      data: { parceiroId: parceiro.id, correlationId: randomUUID() },
    });

    await this.filaColeta.add('coletar-pagina', {
      execucaoId: execucao.id,
      correlationId: execucao.correlationId,
      parceiroCodigo,
      cursor: null,
      sequencial: 0,
    } satisfies JobColeta);

    return { id: execucao.id, correlationId: execucao.correlationId, situacao: execucao.situacao };
  }

  async listarExecucoes(parceiroCodigo?: string, limite = 50) {
    return this.prisma.execucaoIntegracao.findMany({
      where: parceiroCodigo ? { parceiro: { codigo: parceiroCodigo } } : undefined,
      include: { parceiro: true },
      orderBy: { iniciadaEm: 'desc' },
      take: Math.min(limite, 200),
    });
  }

  async consultarExecucao(id: string) {
    const execucao = await this.prisma.execucaoIntegracao.findUnique({
      where: { id },
      include: { parceiro: true },
    });
    if (!execucao) {
      throw new NotFoundException(`Execução "${id}" não encontrada`);
    }
    return execucao;
  }

  async listarRegistros(execucaoId: string, situacao?: SituacaoRegistro) {
    await this.consultarExecucao(execucaoId);
    return this.prisma.registroIntegracao.findMany({
      where: { execucaoId, ...(situacao ? { situacao } : {}) },
      orderBy: { criadoEm: 'asc' },
    });
  }

  async listarEventosDoRegistro(registroId: string) {
    const registro = await this.prisma.registroIntegracao.findUnique({ where: { id: registroId } });
    if (!registro) {
      throw new NotFoundException(`Registro "${registroId}" não encontrado`);
    }
    return this.trilhaEventos.listarPorRegistro(registroId);
  }
}
