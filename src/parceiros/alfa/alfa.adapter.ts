import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { EnvConfig } from '../../config/env.schema';
import { AtualizacaoSituacao } from '../../dominio/entidades/registro-canonico';
import { ParceiroAdapter, PaginaColetada } from '../../dominio/portas/parceiro-adapter.port';
import { ItemAlfaAchatado, paginaAlfaSchema, itemAlfaSchema } from './alfa.dto';
import { normalizarAlfa, traduzirSituacaoParaAlfa } from './alfa.mapper';

@Injectable()
export class AlfaAdapter implements ParceiroAdapter {
  readonly codigo = 'alfa';

  private readonly http: AxiosInstance;
  private readonly logger = new Logger(AlfaAdapter.name);

  constructor(config: ConfigService<EnvConfig, true>) {
    this.http = axios.create({
      baseURL: config.get('PARCEIRO_ALFA_BASE_URL', { infer: true }),
      headers: { Authorization: `Bearer ${config.get('PARCEIRO_ALFA_TOKEN', { infer: true })}` },
      timeout: 10_000,
    });
  }

  async coletarPagina(cursor: string | null): Promise<PaginaColetada> {
    const resposta = await this.http.get('/v1/portfolio', {
      params: { cursor: cursor ?? undefined, limit: 100 },
    });

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
    await this.http.post(`/v1/portfolio/${atualizacao.identificadorExterno}/status`, {
      contractNumber: atualizacao.numeroContrato,
      newStatus: traduzirSituacaoParaAlfa(atualizacao.novaSituacao),
      occurredAt: atualizacao.ocorridoEm.toISOString(),
    });
  }
}
