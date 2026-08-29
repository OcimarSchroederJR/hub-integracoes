import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateBucketCommand, PutObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import { EnvConfig } from '../../config/env.schema';
import { ArquivoBruto } from '../../dominio/portas/arquivo-bruto.port';

@Injectable()
export class S3ArquivoBrutoService implements ArquivoBruto, OnModuleInit {
  private readonly logger = new Logger(S3ArquivoBrutoService.name);
  private readonly cliente: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<EnvConfig, true>) {
    this.bucket = config.get('S3_BUCKET_RAW', { infer: true });
    const endpoint = config.get('AWS_ENDPOINT', { infer: true });

    this.cliente = new S3Client({
      region: config.get('AWS_REGION', { infer: true }),
      endpoint,
      // path-style e credenciais fixas só fazem sentido contra um endpoint
      // local (LocalStack/MinIO); S3 de verdade usa virtual-hosted style e
      // credenciais reais (IAM role, variáveis de ambiente da AWS etc.).
      ...(endpoint
        ? { forcePathStyle: true, credentials: { accessKeyId: 'local', secretAccessKey: 'local' } }
        : {}),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.cliente.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" criado`);
    } catch (erro) {
      const jaExiste =
        erro instanceof S3ServiceException &&
        ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(erro.name);
      if (!jaExiste) {
        this.logger.error(`Falha ao garantir o bucket "${this.bucket}": ${(erro as Error).message}`);
      }
    }
  }

  async arquivar(chave: string, conteudo: Buffer): Promise<void> {
    await this.cliente.send(new PutObjectCommand({ Bucket: this.bucket, Key: chave, Body: conteudo }));
  }

  async verificarSaude(): Promise<boolean> {
    try {
      await this.arquivar('_healthcheck', Buffer.from('ok'));
      return true;
    } catch {
      return false;
    }
  }
}
