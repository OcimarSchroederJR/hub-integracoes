import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Gauge } from 'prom-client';
import { MetricsService } from '../../infra/observabilidade/metrics.service';
import { FILA_COLETA, FILA_ENVIO, FILA_NORMALIZACAO } from './constantes';

/**
 * Profundidade de fila e fila de mortos são medidas sob demanda, no
 * momento do scrape (collect assíncrono do prom-client), em vez de
 * mantidas em uma variável atualizada a cada job -- a fonte da verdade
 * é o próprio Redis via BullMQ, não um contador que pode dessincronizar.
 */
@Injectable()
export class FilaMetricsService implements OnModuleInit {
  private readonly filas: Record<string, Queue>;

  constructor(
    private readonly metrics: MetricsService,
    @InjectQueue(FILA_COLETA) filaColeta: Queue,
    @InjectQueue(FILA_NORMALIZACAO) filaNormalizacao: Queue,
    @InjectQueue(FILA_ENVIO) filaEnvio: Queue,
  ) {
    this.filas = { coleta: filaColeta, normalizacao: filaNormalizacao, envio: filaEnvio };
  }

  onModuleInit(): void {
    const filas = this.filas;

    new Gauge({
      name: 'hub_fila_profundidade',
      help: 'Jobs aguardando, ativos ou atrasados em cada fila',
      labelNames: ['fila'] as const,
      registers: [this.metrics.registry],
      async collect() {
        for (const [nome, fila] of Object.entries(filas)) {
          const contagens = await fila.getJobCounts('waiting', 'active', 'delayed');
          this.set({ fila: nome }, contagens.waiting + contagens.active + contagens.delayed);
        }
      },
    });

    new Gauge({
      name: 'hub_dead_letter_total',
      help: 'Jobs que esgotaram as tentativas em cada fila',
      labelNames: ['fila'] as const,
      registers: [this.metrics.registry],
      async collect() {
        for (const [nome, fila] of Object.entries(filas)) {
          this.set({ fila: nome }, await fila.getFailedCount());
        }
      },
    });
  }
}
