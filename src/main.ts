import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggerJsonService } from './infra/observabilidade/logger-json.service';

async function bootstrap() {
  const logger = new LoggerJsonService();
  const app = await NestFactory.create(AppModule, { logger });

  const config = new DocumentBuilder()
    .setTitle('Hub de Integrações com Parceiros')
    .setDescription(
      'API do hub que normaliza carteiras de cobrança de parceiros distintos. ' +
        'Faça login em POST /auth/login e clique em "Authorize" com o token recebido para testar as rotas protegidas.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.APP_PORT ?? 3000;
  await app.listen(port);
  logger.log(`Hub de integrações ouvindo na porta ${port}`, 'Bootstrap');
  logger.log(`Documentação Swagger em http://localhost:${port}/docs`, 'Bootstrap');
}

bootstrap();
