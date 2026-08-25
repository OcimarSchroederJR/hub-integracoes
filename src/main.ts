import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.APP_PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Hub de integrações ouvindo na porta ${port}`);
}

bootstrap();
