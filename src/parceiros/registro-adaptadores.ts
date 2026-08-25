import { Inject, Injectable } from '@nestjs/common';
import { ParceiroAdapter, PARCEIRO_ADAPTER } from '../dominio/portas/parceiro-adapter.port';

export class ParceiroDesconhecidoError extends Error {
  constructor(codigo: string) {
    super(`Parceiro desconhecido: "${codigo}"`);
  }
}

@Injectable()
export class RegistroAdaptadores {
  private readonly adaptadores = new Map<string, ParceiroAdapter>();

  constructor(@Inject(PARCEIRO_ADAPTER) adaptadores: ParceiroAdapter[]) {
    for (const adaptador of adaptadores) {
      this.adaptadores.set(adaptador.codigo, adaptador);
    }
  }

  obter(codigo: string): ParceiroAdapter {
    const adaptador = this.adaptadores.get(codigo);
    if (!adaptador) {
      throw new ParceiroDesconhecidoError(codigo);
    }
    return adaptador;
  }
}
