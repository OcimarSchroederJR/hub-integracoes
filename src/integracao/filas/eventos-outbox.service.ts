import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventoTrilha, TrilhaEventos, TRILHA_EVENTOS } from '../../dominio/portas/trilha-eventos.port';
import { FILA_EVENTOS_SAIDA } from './constantes';

/**
 * Grava na trilha (fonte da verdade, consultável por registro) e
 * publica o mesmo evento numa fila para quem mais, dentro do próprio
 * hub, quiser reagir sem consultar o DynamoDB diretamente -- um
 * outbox simples, não transacional: a escrita na trilha e a
 * publicação na fila não são atômicas entre si, então uma falha bem
 * no meio pode gravar sem publicar. Aceitável aqui porque a trilha
 * continua sendo a fonte da verdade; o outbox é conveniência para
 * assinantes internos, não o único registro do que aconteceu.
 */
@Injectable()
export class EventosOutboxService {
  constructor(
    @Inject(TRILHA_EVENTOS) private readonly trilhaEventos: TrilhaEventos,
    @InjectQueue(FILA_EVENTOS_SAIDA) private readonly filaSaida: Queue<EventoTrilha>,
  ) {}

  async publicar(evento: EventoTrilha): Promise<void> {
    await this.trilhaEventos.registrar(evento);
    await this.filaSaida.add(evento.tipo, evento);
  }
}
