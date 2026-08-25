import { ValorMonetarioInvalidoError } from '../erros/erro-de-dado';

export class Dinheiro {
  private constructor(private readonly centavos: number) {}

  static deCentavos(valor: number): Dinheiro {
    if (!Number.isFinite(valor) || !Number.isInteger(valor)) {
      throw new ValorMonetarioInvalidoError(String(valor));
    }
    return new Dinheiro(valor);
  }

  static deTextoBrasileiro(texto: string): Dinheiro {
    const limpo = (texto ?? '').trim().replace(/\./g, '').replace(',', '.');
    const numero = Number(limpo);
    if (limpo === '' || !Number.isFinite(numero)) {
      throw new ValorMonetarioInvalidoError(texto);
    }
    return new Dinheiro(Math.round(numero * 100));
  }

  get emCentavos(): number {
    return this.centavos;
  }
}
