import { Dinheiro } from './dinheiro';
import { ValorMonetarioInvalidoError } from '../erros/erro-de-dado';

describe('Dinheiro', () => {
  it('aceita centavos como inteiro', () => {
    expect(Dinheiro.deCentavos(158000).emCentavos).toBe(158000);
  });

  it('rejeita centavos não inteiro', () => {
    expect(() => Dinheiro.deCentavos(158000.5)).toThrow(ValorMonetarioInvalidoError);
  });

  it('converte texto brasileiro para centavos sem erro de ponto flutuante', () => {
    expect(Dinheiro.deTextoBrasileiro('1.580,00').emCentavos).toBe(158000);
    expect(Dinheiro.deTextoBrasileiro('1.002,30').emCentavos).toBe(100230);
  });

  it('rejeita texto não numérico', () => {
    expect(() => Dinheiro.deTextoBrasileiro('abc')).toThrow(ValorMonetarioInvalidoError);
    expect(() => Dinheiro.deTextoBrasileiro('')).toThrow(ValorMonetarioInvalidoError);
  });
});
