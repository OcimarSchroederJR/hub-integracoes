import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { EnvConfig } from '../../config/env.schema';
import { AtualizacaoSituacao } from '../../dominio/entidades/registro-canonico';
import { ParceiroAdapter, PaginaColetada } from '../../dominio/portas/parceiro-adapter.port';
import { MetricsService } from '../../infra/observabilidade/metrics.service';
import { linhaBetaSchema } from './beta.dto';
import { normalizarBeta, traduzirSituacaoParaBeta } from './beta.mapper';

function parseCsv(texto: string): Record<string, string>[] {
  const linhas = texto.split(/\r?\n/).filter((linha) => linha.trim() !== '');
  if (linhas.length === 0) return [];

  const cabecalho = linhas[0].split(';').map((campo) => campo.trim());
  return linhas.slice(1).map((linha) => {
    const valores = linha.split(';');
    const registro: Record<string, string> = {};
    cabecalho.forEach((campo, indice) => {
      registro[campo] = (valores[indice] ?? '').trim();
    });
    return registro;
  });
}

function formatarDataEventoBrasileira(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const horas = String(data.getUTCHours()).padStart(2, '0');
  const minutos = String(data.getUTCMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${data.getUTCFullYear()} ${horas}:${minutos}`;
}

@Injectable()
export class BetaAdapter implements ParceiroAdapter {
  readonly codigo = 'beta';

  private readonly http: AxiosInstance;
  private readonly logger = new Logger(BetaAdapter.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly metrics: MetricsService,
  ) {
    this.http = axios.create({ timeout: 10_000 });
  }

  private async medir<T>(operacao: string, chamada: () => Promise<T>): Promise<T> {
    const inicio = Date.now();
    try {
      return await chamada();
    } finally {
      this.metrics.duracaoChamadaExterna.observe({ parceiro: this.codigo, operacao }, Date.now() - inicio);
    }
  }

  async coletarPagina(cursor: string | null): Promise<PaginaColetada> {
    if (cursor) {
      return { itens: [], proximoCursor: null, bruto: Buffer.alloc(0), extensao: 'csv' };
    }

    const url = this.config.get('PARCEIRO_BETA_CSV_URL', { infer: true });
    const resposta = await this.medir('coletar', () =>
      this.http.get<ArrayBuffer>(url, { responseType: 'arraybuffer' }),
    );
    const bruto = Buffer.from(resposta.data);
    const texto = bruto.toString('latin1');

    const itens: Record<string, string>[] = [];
    for (const linha of parseCsv(texto)) {
      const validacao = linhaBetaSchema.safeParse(linha);
      if (!validacao.success) {
        this.logger.warn(
          `Linha do Parceiro Beta descartada por não casar com o schema: ${validacao.error.message}`,
        );
        continue;
      }
      itens.push(validacao.data);
    }

    return { itens, proximoCursor: null, bruto, extensao: 'csv' };
  }

  normalizar(itemBruto: unknown) {
    return normalizarBeta(itemBruto);
  }

  async enviarAtualizacao(atualizacao: AtualizacaoSituacao): Promise<void> {
    const url = this.config.get('PARCEIRO_BETA_WEBHOOK_URL', { infer: true });
    await this.medir('enviar-atualizacao', () =>
      this.http.post(url, {
        numContrato: atualizacao.numeroContrato,
        situacao: traduzirSituacaoParaBeta(atualizacao.novaSituacao),
        dataEvento: formatarDataEventoBrasileira(atualizacao.ocorridoEm),
      }),
    );
  }
}
