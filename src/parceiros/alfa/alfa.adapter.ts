import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import { EnvConfig } from '../../config/env.schema';
import { AtualizacaoSituacao } from '../../dominio/entidades/registro-canonico';
import { ParceiroAdapter, PaginaColetada } from '../../dominio/portas/parceiro-adapter.port';
import { MetricsService } from '../../infra/observabilidade/metrics.service';
import { ItemAlfaAchatado, paginaAlfaSchema, itemAlfaSchema } from './alfa.dto';
import { normalizarAlfa, traduzirSituacaoParaAlfa } from './alfa.mapper';

const ATRASO_ADAPTATIVO_INICIAL_MS = 500;
const ATRASO_ADAPTATIVO_MAXIMO_MS = 30_000;
const FATOR_CRESCIMENTO = 2;
const FATOR_DECAIMENTO = 0.5;

@Injectable()
export class AlfaAdapter implements ParceiroAdapter {
  readonly codigo = 'alfa';

  private readonly http: AxiosInstance;
  private readonly logger = new Logger(AlfaAdapter.name);

  /**
   * Throttle próprio, além do limiter fixo do BullMQ (ADR 0003): esse
   * aqui reage ao que o parceiro está de fato respondendo. Cresce
   * geometricamente a cada 429/500, decai pela metade a cada chamada
   * bem-sucedida -- não substitui o retry com backoff do job (que
   * continua acontecendo), só reduz a chance de precisar dele.
   */
  private atrasoAtualMs = 0;

  constructor(
    config: ConfigService<EnvConfig, true>,
    private readonly metrics: MetricsService,
  ) {
    this.http = axios.create({
      baseURL: config.get('PARCEIRO_ALFA_BASE_URL', { infer: true }),
      headers: { Authorization: `Bearer ${config.get('PARCEIRO_ALFA_TOKEN', { infer: true })}` },
      timeout: 10_000,
    });
  }

  private ajustarAtraso(status: number | undefined): void {
    if (status === 429 || status === 500) {
      this.atrasoAtualMs = Math.min(
        this.atrasoAtualMs === 0 ? ATRASO_ADAPTATIVO_INICIAL_MS : this.atrasoAtualMs * FATOR_CRESCIMENTO,
        ATRASO_ADAPTATIVO_MAXIMO_MS,
      );
      this.logger.warn(`Recebi ${status} do Alfa, aumentando atraso adaptativo para ${this.atrasoAtualMs}ms`);
    } else {
      this.atrasoAtualMs = Math.floor(this.atrasoAtualMs * FATOR_DECAIMENTO);
      if (this.atrasoAtualMs < 10) this.atrasoAtualMs = 0;
    }
    this.metrics.atrasoAdaptativo.set({ parceiro: this.codigo }, this.atrasoAtualMs);
  }

  private async medir<T>(operacao: string, chamada: () => Promise<T>): Promise<T> {
    if (this.atrasoAtualMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.atrasoAtualMs));
    }

    const inicio = Date.now();
    try {
      const resultado = await chamada();
      this.ajustarAtraso(undefined);
      return resultado;
    } catch (erro) {
      this.ajustarAtraso(isAxiosError(erro) ? erro.response?.status : undefined);
      throw erro;
    } finally {
      this.metrics.duracaoChamadaExterna.observe({ parceiro: this.codigo, operacao }, Date.now() - inicio);
    }
  }

  async coletarPagina(cursor: string | null): Promise<PaginaColetada> {
    const resposta = await this.medir('coletar', () =>
      this.http.get('/v1/portfolio', { params: { cursor: cursor ?? undefined, limit: 100 } }),
    );

    const bruto = Buffer.from(JSON.stringify(resposta.data), 'utf-8');
    const pagina = paginaAlfaSchema.parse(resposta.data);

    const itens: ItemAlfaAchatado[] = [];
    for (const itemNaoValidado of pagina.data) {
      const validacao = itemAlfaSchema.safeParse(itemNaoValidado);
      if (!validacao.success) {
        this.logger.warn(
          `Item do Parceiro Alfa descartado por não casar com o schema: ${validacao.error.message}`,
        );
        continue;
      }
      const item = validacao.data;
      if (item.contracts.length === 0) {
        itens.push({
          externalId: item.externalId,
          taxId: item.taxId,
          customerName: item.customerName,
          contract: null,
          phones: item.contacts.phones,
          emails: item.contacts.emails,
        });
        continue;
      }
      for (const contract of item.contracts) {
        itens.push({
          externalId: item.externalId,
          taxId: item.taxId,
          customerName: item.customerName,
          contract,
          phones: item.contacts.phones,
          emails: item.contacts.emails,
        });
      }
    }

    return { itens, proximoCursor: pagina.hasMore ? pagina.nextCursor : null, bruto, extensao: 'json' };
  }

  normalizar(itemBruto: unknown) {
    return normalizarAlfa(itemBruto);
  }

  async enviarAtualizacao(atualizacao: AtualizacaoSituacao): Promise<void> {
    await this.medir('enviar-atualizacao', () =>
      this.http.post(`/v1/portfolio/${atualizacao.identificadorExterno}/status`, {
        contractNumber: atualizacao.numeroContrato,
        newStatus: traduzirSituacaoParaAlfa(atualizacao.novaSituacao),
        occurredAt: atualizacao.ocorridoEm.toISOString(),
      }),
    );
  }
}
