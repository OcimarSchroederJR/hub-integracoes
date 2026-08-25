import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarEnv } from './config/env.schema';
import { PrismaModule } from './infra/prisma/prisma.module';
import { ParceirosModule } from './parceiros/parceiros.module';
import { IntegracaoModule } from './integracao/integracao.module';
import { ExecucoesController } from './api/controllers/execucoes.controller';
import { HealthController } from './api/controllers/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    PrismaModule,
    ParceirosModule,
    IntegracaoModule,
  ],
  controllers: [ExecucoesController, HealthController],
})
export class AppModule {}
