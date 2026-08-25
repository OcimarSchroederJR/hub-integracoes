import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PARCEIRO_ADAPTER } from '../dominio/portas/parceiro-adapter.port';
import { AlfaAdapter } from './alfa/alfa.adapter';
import { RegistroAdaptadores } from './registro-adaptadores';

@Module({
  imports: [ConfigModule],
  providers: [
    AlfaAdapter,
    {
      provide: PARCEIRO_ADAPTER,
      useFactory: (alfa: AlfaAdapter) => [alfa],
      inject: [AlfaAdapter],
    },
    RegistroAdaptadores,
  ],
  exports: [RegistroAdaptadores],
})
export class ParceirosModule {}
