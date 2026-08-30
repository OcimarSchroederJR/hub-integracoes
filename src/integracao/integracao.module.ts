import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvConfig } from '../config/env.schema';
import { ParceirosModule } from '../parceiros/parceiros.module';
import { FILA_COLETA, FILA_ENVIO, FILA_EVENTOS_SAIDA, FILA_NORMALIZACAO } from './filas/constantes';
import { ColetaProcessor } from './filas/coleta.processor';
import { NormalizacaoProcessor } from './filas/normalizacao.processor';
import { EnvioProcessor } from './filas/envio.processor';
import { EventosOutboxService } from './filas/eventos-outbox.service';
import { EventosOutboxAssinanteProcessor } from './filas/eventos-outbox-assinante.processor';
import { AvaliadorConclusaoService } from './filas/avaliador-conclusao.service';
import { FilaMetricsService } from './filas/fila-metrics.service';
import { ExecucaoService } from './execucao.service';
import { ReprocessamentoService } from './reprocessamento.service';

const TENTATIVAS_MAXIMAS = Number(process.env.FILA_TENTATIVAS_MAXIMAS) || 5;

const OPCOES_PADRAO_JOB = {
  attempts: TENTATIVAS_MAXIMAS,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { age: 86_400 },
  removeOnFail: false,
};

@Module({
  imports: [
    ParceirosModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        connection: {
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: FILA_COLETA, defaultJobOptions: OPCOES_PADRAO_JOB },
      { name: FILA_NORMALIZACAO, defaultJobOptions: OPCOES_PADRAO_JOB },
      { name: FILA_ENVIO, defaultJobOptions: OPCOES_PADRAO_JOB },
      { name: FILA_EVENTOS_SAIDA, defaultJobOptions: OPCOES_PADRAO_JOB },
    ),
  ],
  providers: [
    ColetaProcessor,
    NormalizacaoProcessor,
    EnvioProcessor,
    EventosOutboxService,
    EventosOutboxAssinanteProcessor,
    AvaliadorConclusaoService,
    FilaMetricsService,
    ExecucaoService,
    ReprocessamentoService,
  ],
  exports: [ExecucaoService, ReprocessamentoService],
})
export class IntegracaoModule {}
