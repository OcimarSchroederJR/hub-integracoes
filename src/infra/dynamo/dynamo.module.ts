import { Global, Module } from '@nestjs/common';
import { TRILHA_EVENTOS } from '../../dominio/portas/trilha-eventos.port';
import { DynamoTrilhaEventosService } from './dynamo-trilha-eventos.service';

@Global()
@Module({
  providers: [
    DynamoTrilhaEventosService,
    { provide: TRILHA_EVENTOS, useExisting: DynamoTrilhaEventosService },
  ],
  exports: [TRILHA_EVENTOS, DynamoTrilhaEventosService],
})
export class DynamoModule {}
