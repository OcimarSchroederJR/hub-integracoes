import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvConfig } from '../../config/env.schema';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { S3ArquivoBrutoService } from '../../infra/s3/s3-arquivo-bruto.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly arquivoBruto: S3ArquivoBrutoService,
  ) {}

  @Get()
  async verificar() {
    const [banco, redis, armazenamento] = await Promise.all([
      this.verificarBanco(),
      this.verificarRedis(),
      this.verificarArmazenamento(),
    ]);

    const saudavel = banco.ok && redis.ok && armazenamento.ok;
    const resultado = { status: saudavel ? 'ok' : 'degradado', banco, redis, armazenamento };

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

  private async verificarArmazenamento(): Promise<{ ok: boolean; erro?: string }> {
    try {
      const ok = await this.arquivoBruto.verificarSaude();
      return ok ? { ok: true } : { ok: false, erro: 'falha ao gravar objeto de teste' };
    } catch (erro) {
      return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
    }
  }
}
