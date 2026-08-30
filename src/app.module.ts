import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarEnv } from './config/env.schema';
import { PrismaModule } from './infra/prisma/prisma.module';
import { S3Module } from './infra/s3/s3.module';
import { DynamoModule } from './infra/dynamo/dynamo.module';
import { ObservabilidadeModule } from './infra/observabilidade/observabilidade.module';
import { ParceirosModule } from './parceiros/parceiros.module';
import { IntegracaoModule } from './integracao/integracao.module';
import { ExecucoesController } from './api/controllers/execucoes.controller';
import { HealthController } from './api/controllers/health.controller';
import { MetricsController } from './api/controllers/metrics.controller';
import { DevedoresController } from './api/controllers/devedores.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    PrismaModule,
    S3Module,
    DynamoModule,
    ObservabilidadeModule,
    ParceirosModule,
    IntegracaoModule,
  ],
  controllers: [ExecucoesController, HealthController, MetricsController, DevedoresController],
})
export class AppModule {}
