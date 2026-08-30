import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validarEnv } from './config/env.schema';
import { PrismaModule } from './infra/prisma/prisma.module';
import { S3Module } from './infra/s3/s3.module';
import { DynamoModule } from './infra/dynamo/dynamo.module';
import { ObservabilidadeModule } from './infra/observabilidade/observabilidade.module';
import { ParceirosModule } from './parceiros/parceiros.module';
import { IntegracaoModule } from './integracao/integracao.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
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
    AuthModule,
  ],
  controllers: [ExecucoesController, HealthController, MetricsController, DevedoresController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
