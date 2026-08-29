import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PARCEIRO_ADAPTER } from '../dominio/portas/parceiro-adapter.port';
import { AlfaAdapter } from './alfa/alfa.adapter';
import { BetaAdapter } from './beta/beta.adapter';
import { RegistroAdaptadores } from './registro-adaptadores';

@Module({
  imports: [ConfigModule],
  providers: [
    AlfaAdapter,
    BetaAdapter,
    {
      provide: PARCEIRO_ADAPTER,
      useFactory: (alfa: AlfaAdapter, beta: BetaAdapter) => [alfa, beta],
      inject: [AlfaAdapter, BetaAdapter],
    },
    RegistroAdaptadores,
  ],
  exports: [RegistroAdaptadores],
})
export class ParceirosModule {}
