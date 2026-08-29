import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerJsonService } from './infra/observabilidade/logger-json.service';

async function bootstrap() {
  const logger = new LoggerJsonService();
  const app = await NestFactory.create(AppModule, { logger });
  const port = process.env.APP_PORT ?? 3000;
  await app.listen(port);
  logger.log(`Hub de integrações ouvindo na porta ${port}`, 'Bootstrap');
}

bootstrap();
