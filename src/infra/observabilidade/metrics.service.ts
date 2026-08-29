import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly registrosProcessados = new Counter({
    name: 'hub_registros_processados_total',
    help: 'Total de registros processados, por parceiro e resultado',
    labelNames: ['parceiro', 'resultado'] as const,
    registers: [this.registry],
  });

  readonly duracaoChamadaExterna = new Histogram({
    name: 'hub_chamada_externa_duracao_ms',
    help: 'Duração das chamadas HTTP a parceiros externos, em milissegundos',
    labelNames: ['parceiro', 'operacao'] as const,
    buckets: [50, 100, 250, 500, 1_000, 2_000, 3_000, 5_000, 10_000],
    registers: [this.registry],
  });

  readonly atrasoAdaptativo = new Gauge({
    name: 'hub_atraso_adaptativo_ms',
    help: 'Atraso extra que o adaptador está aplicando antes de cada chamada, por ter apanhado de 429/500 recentemente',
    labelNames: ['parceiro'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'hub_processo_' });
  }
}
