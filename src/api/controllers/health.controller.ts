import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvConfig } from '../../config/env.schema';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @Get()
  async verificar() {
    const [banco, redis] = await Promise.all([this.verificarBanco(), this.verificarRedis()]);

    const saudavel = banco.ok && redis.ok;
    const resultado = { status: saudavel ? 'ok' : 'degradado', banco, redis };

    if (!saudavel) {
      throw new HttpException(resultado, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return resultado;
  }

  private async verificarBanco(): Promise<{ ok: boolean; erro?: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (erro) {
      return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
    }
  }

  private async verificarRedis(): Promise<{ ok: boolean; erro?: string }> {
    const client = new Redis({
      host: this.config.get('REDIS_HOST', { infer: true }),
      port: this.config.get('REDIS_PORT', { infer: true }),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await client.connect();
      await client.ping();
      return { ok: true };
    } catch (erro) {
      return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
    } finally {
      client.disconnect();
    }
  }
}
