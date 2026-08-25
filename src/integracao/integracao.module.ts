import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvConfig } from '../config/env.schema';
import { ParceirosModule } from '../parceiros/parceiros.module';
import { FILA_COLETA, FILA_NORMALIZACAO } from './filas/constantes';
import { ColetaProcessor } from './filas/coleta.processor';
import { NormalizacaoProcessor } from './filas/normalizacao.processor';
import { AvaliadorConclusaoService } from './filas/avaliador-conclusao.service';
import { ExecucaoService } from './execucao.service';

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
      {
        name: FILA_COLETA,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { age: 86_400 },
          removeOnFail: false,
        },
      },
      {
        name: FILA_NORMALIZACAO,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { age: 86_400 },
          removeOnFail: false,
        },
      },
    ),
  ],
  providers: [ColetaProcessor, NormalizacaoProcessor, AvaliadorConclusaoService, ExecucaoService],
  exports: [ExecucaoService],
})
export class IntegracaoModule {}
