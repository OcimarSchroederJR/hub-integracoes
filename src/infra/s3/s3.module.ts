import { Global, Module } from '@nestjs/common';
import { ARQUIVO_BRUTO } from '../../dominio/portas/arquivo-bruto.port';
import { S3ArquivoBrutoService } from './s3-arquivo-bruto.service';

@Global()
@Module({
  providers: [S3ArquivoBrutoService, { provide: ARQUIVO_BRUTO, useExisting: S3ArquivoBrutoService }],
  exports: [ARQUIVO_BRUTO, S3ArquivoBrutoService],
})
export class S3Module {}
