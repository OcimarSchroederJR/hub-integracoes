import { deBrasileiro, deIso } from './data';
import { DataInvalidaError } from '../erros/erro-de-dado';

describe('deIso', () => {
  it('converte data ISO para UTC à meia-noite', () => {
    const data = deIso('2024-03-15');
    expect(data.toISOString()).toBe('2024-03-15T00:00:00.000Z');
  });

  it('aceita timestamp completo e trunca para o dia', () => {
    const data = deIso('2024-03-15T14:03:00Z');
    expect(data.toISOString()).toBe('2024-03-15T00:00:00.000Z');
  });

  it('rejeita formato não reconhecido', () => {
    expect(() => deIso('15/03/2024')).toThrow(DataInvalidaError);
  });
});

describe('deBrasileiro', () => {
  it('converte dd/mm/aaaa para UTC à meia-noite', () => {
    const data = deBrasileiro('15/03/2024');
    expect(data.toISOString()).toBe('2024-03-15T00:00:00.000Z');
  });

  it('rejeita data sintaticamente válida mas inexistente', () => {
    expect(() => deBrasileiro('31/02/2024')).toThrow(DataInvalidaError);
  });

  it('rejeita formato não reconhecido', () => {
    expect(() => deBrasileiro('2024-03-15')).toThrow(DataInvalidaError);
  });
});
